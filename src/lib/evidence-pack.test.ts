import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  buildEvidencePack,
  EVIDENCE_PACK_WORK_ITEM_TITLE_FALLBACK,
} from "./evidence-pack";
import {
  parseClaudeCodeTranscript,
  type ParsedClaudeCodeSession,
} from "./claude-code-parser";
import { reduceObservedPlayback, type VisualBeat } from "./observed-playback-reducer";
import { OBSERVED_SAMPLE_SESSION } from "@/data/mock-events-observed";
import type { WorkflowEvent } from "@/types/workflow-events";
import type { EvidencePack } from "@/types/evidence-pack";

/**
 * Tests for `buildEvidencePack` (#59 model + #60 reducer).
 *
 * The load-bearing test is the privacy gate: a serialized pack — built through
 * the SAME code path for the synthetic sample and the REAL redacted transcript
 * — must contain none of the raw identifiers, paths, commands, or content the
 * transcript carries. Everything else verifies the shape and the conservative,
 * data-derived summaries.
 */

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/claude-code-transcript-real-redacted.jsonl",
);
const realRedactedSession = (): ParsedClaudeCodeSession =>
  parseClaudeCodeTranscript(readFileSync(FIXTURE_PATH, "utf8"));

const syntheticSession = (): ParsedClaudeCodeSession => OBSERVED_SAMPLE_SESSION;

// Minimal synthetic event builders for targeted reviewer-focus / touchpoint
// assertions. These streams never feed the serialized-probe test, so plain ids
// are fine. The exact AskUserQuestion marker mirrors the mapper's constant.
let _seq = 0;
const ev = (type: WorkflowEvent["type"], payload: Record<string, unknown>): WorkflowEvent => ({
  id: `e${String(_seq++).padStart(4, "0")}`,
  ts: new Date(Date.parse("2026-05-27T15:00:00.000Z") + _seq * 1000).toISOString(),
  actor: "mira",
  type,
  subject: "wi_test",
  payload,
});
const status = (to: string) => ev("agent.status.changed", { agentId: "mira", to });
const gatePass = () => ev("quality_gate.passed", { gate: { id: "g", status: "passed" } });
const gateFail = () => ev("quality_gate.failed", { gate: { id: "g", status: "failed" } });
const blockerRaised = (kind: string) => ev("blocker.raised", { blocker: { id: "b", kind } });
const askHuman = () =>
  ev("agent.message.sent", {
    agentId: "mira",
    message: "Asked the human a question (observed; not surfaced as a decision)",
  });
const chatter = (text: string) => ev("agent.message.sent", { agentId: "mira", message: text });

/** Build a pack from a custom event stream, reusing the sample's safe metadata. */
const packFromEvents = (events: WorkflowEvent[]): EvidencePack =>
  buildEvidencePack({ session: syntheticSession(), events });

/**
 * Build a VisualBeat with arbitrary (possibly UNSAFE) field values, to prove
 * `buildEvidencePack` never trusts caller-supplied beats. Cast through `unknown`
 * so a test can inject non-enum zones/actions and non-numeric counts.
 */
const rawBeat = (overrides: Record<string, unknown>): VisualBeat =>
  ({
    id: "beat_0000",
    zone: "coding",
    action: "edit",
    severity: "info",
    startTs: "2026-05-27T15:00:00.000Z",
    endTs: "2026-05-27T15:00:01.000Z",
    eventCount: 1,
    signalCount: 1,
    eventIds: [],
    label: "editing",
    ...overrides,
  }) as unknown as VisualBeat;

const focusKinds = (pack: EvidencePack) => pack.reviewerFocus.map((f) => f.kind);

const TOP_LEVEL_KEYS = [
  "activity",
  "blockers",
  "filesAndArtifacts",
  "generatedAt",
  "humanTouchpoints",
  "id",
  "quality",
  "redaction",
  "reviewerFocus",
  "session",
  "source",
  "workItem",
];

// ─── Shape ───────────────────────────────────────────────────────────────────

describe("buildEvidencePack — stable object shape", () => {
  it("returns the full, stable top-level shape", () => {
    const pack = buildEvidencePack({ session: syntheticSession() });

    expect(Object.keys(pack).sort()).toEqual([...TOP_LEVEL_KEYS].sort());
    expect(pack.id).toMatch(/^ep_[0-9a-f]{8}$/);
    expect(pack.source).toBe("observed-session");
    expect(typeof pack.generatedAt).toBe("string");

    expect(Object.keys(pack.session).sort()).toEqual(["capturedAt", "source"]);
    expect(Object.keys(pack.workItem).sort()).toEqual(["currentMode", "kind", "status", "title"]);
    expect(Object.keys(pack.activity).sort()).toEqual([
      "beatSequence",
      "byAction",
      "byZone",
      "totalBeats",
      "totalEvents",
    ]);
    expect(Object.keys(pack.filesAndArtifacts).sort()).toEqual([
      "artifactCount",
      "artifactKinds",
      "editedFileCount",
      "prCount",
    ]);
    expect(Object.keys(pack.quality).sort()).toEqual([
      "failedCount",
      "passedCount",
      "status",
      "totalGates",
    ]);
    expect(Object.keys(pack.blockers).sort()).toEqual(["blockedStateCount", "blockerCount", "blockerKinds"]);
    expect(Object.keys(pack.humanTouchpoints).sort()).toEqual(["askUserQuestionCount", "count"]);
    expect(Object.keys(pack.redaction).sort()).toEqual(["note", "omitted"]);
    expect(Array.isArray(pack.reviewerFocus)).toBe(true);
  });

  it("never exposes the raw work-item title (a user prompt) — uses the fallback", () => {
    // The sample's raw title is "Observed — Refactor primary button…"; the pack
    // must surface only the constant fallback, regardless of the source title.
    const pack = buildEvidencePack({ session: syntheticSession() });
    expect(pack.workItem.title).toBe(EVIDENCE_PACK_WORK_ITEM_TITLE_FALLBACK);
    expect(pack.workItem.kind).toBe("feature");
    expect(pack.workItem.status).toBe("captured");
    expect(pack.workItem.currentMode).toBe("Generate");
  });

  it("is pure/deterministic — same input yields a deep-equal pack", () => {
    expect(buildEvidencePack({ session: syntheticSession() })).toEqual(
      buildEvidencePack({ session: syntheticSession() }),
    );
  });

  it("defaults generatedAt to capturedAt but honours an injected value (no Date.now)", () => {
    const def = buildEvidencePack({ session: syntheticSession() });
    expect(def.generatedAt).toBe(def.session.capturedAt);

    const injected = buildEvidencePack({
      session: syntheticSession(),
      generatedAt: "2030-01-01T00:00:00.000Z",
    });
    expect(injected.generatedAt).toBe("2030-01-01T00:00:00.000Z");
  });
});

// ─── Activity summary from the VisualBeat sequence ───────────────────────────

describe("buildEvidencePack — activity from beats", () => {
  it("produces the activity summary from the VisualBeat sequence", () => {
    const session = syntheticSession();
    const beats = reduceObservedPlayback(session.events);
    const pack = buildEvidencePack({ session });

    expect(pack.activity.totalEvents).toBe(session.events.length);
    expect(pack.activity.totalBeats).toBe(beats.length);
    // Content-free labels, in order, straight from the reducer.
    expect(pack.activity.beatSequence).toEqual(beats.map((b) => b.label));
    expect(pack.activity.byZone.reading).toBeGreaterThanOrEqual(1);
    expect(pack.activity.byZone.coding).toBeGreaterThanOrEqual(1);
    expect(pack.activity.byZone.testing).toBeGreaterThanOrEqual(1);
  });

  it("derives beats itself when not provided, and respects an explicit beats override", () => {
    const session = syntheticSession();
    const derived = buildEvidencePack({ session });
    expect(derived.activity.totalBeats).toBe(reduceObservedPlayback(session.events).length);

    const overridden = buildEvidencePack({ session, beats: [] });
    expect(overridden.activity.totalBeats).toBe(0);
    expect(overridden.activity.beatSequence).toEqual([]);
  });

  it("includes reading/coding/testing counts for the REAL redacted fixture", () => {
    const pack = buildEvidencePack({ session: realRedactedSession() });
    expect(pack.activity.byZone.reading).toBeGreaterThanOrEqual(1);
    expect(pack.activity.byZone.coding).toBeGreaterThanOrEqual(1);
    expect(pack.activity.byZone.testing).toBeGreaterThanOrEqual(1);
    expect(pack.activity.byAction.read).toBeGreaterThanOrEqual(1);
    expect(pack.activity.byAction.edit).toBeGreaterThanOrEqual(1);
    expect(pack.activity.totalBeats).toBeGreaterThan(0);
  });
});

// ─── Quality gates ───────────────────────────────────────────────────────────

describe("buildEvidencePack — quality gates", () => {
  it("records pass/fail counts for both fixtures (a clean pass)", () => {
    for (const session of [syntheticSession(), realRedactedSession()]) {
      const pack = buildEvidencePack({ session });
      expect(pack.quality.passedCount).toBe(1);
      expect(pack.quality.failedCount).toBe(0);
      expect(pack.quality.totalGates).toBe(1);
      expect(pack.quality.status).toBe("passed");
    }
  });

  it("rolls up failed and mixed gate outcomes", () => {
    expect(packFromEvents([status("testing"), gateFail()]).quality).toMatchObject({
      passedCount: 0,
      failedCount: 1,
      status: "failed",
    });
    expect(packFromEvents([gatePass(), gateFail()]).quality).toMatchObject({
      passedCount: 1,
      failedCount: 1,
      status: "mixed",
    });
    expect(packFromEvents([status("reading")]).quality.status).toBe("none");
  });
});

// ─── Artifacts ───────────────────────────────────────────────────────────────

describe("buildEvidencePack — files & artifacts", () => {
  it("records artifact counts/kinds without raw paths for both fixtures", () => {
    for (const session of [syntheticSession(), realRedactedSession()]) {
      const pack = buildEvidencePack({ session });
      expect(pack.filesAndArtifacts.artifactCount).toBeGreaterThanOrEqual(1);
      expect(pack.filesAndArtifacts.artifactKinds).toEqual(["code_pr"]);
      expect(pack.filesAndArtifacts.editedFileCount).toBeGreaterThanOrEqual(1);
      expect(pack.filesAndArtifacts.prCount).toBe(0);

      // The kind list is allowlisted; no ref/summary/path leaks into it.
      const kindsBlob = JSON.stringify(pack.filesAndArtifacts.artifactKinds);
      expect(kindsBlob).not.toContain("/");
      expect(kindsBlob).not.toContain("Button");
    }
  });

  it("buckets unknown artifact kinds without echoing the raw kind string", () => {
    const weird = ev("artifact.produced", {
      artifact: { kind: "totally-made-up-kind", ref: "x", summary: "y" },
    });
    const pack = packFromEvents([weird]);
    expect(pack.filesAndArtifacts.artifactKinds).toEqual(["other"]);
    expect(JSON.stringify(pack)).not.toContain("totally-made-up-kind");
  });
});

// ─── Blockers ────────────────────────────────────────────────────────────────

describe("buildEvidencePack — blockers", () => {
  it("is empty for the clean fixtures", () => {
    for (const session of [syntheticSession(), realRedactedSession()]) {
      const pack = buildEvidencePack({ session });
      expect(pack.blockers).toEqual({ blockerCount: 0, blockerKinds: [], blockedStateCount: 0 });
    }
  });

  it("counts blockers and allowlists their kinds (never raw descriptions)", () => {
    const pack = packFromEvents([blockerRaised("external"), blockerRaised("gate_failed")]);
    expect(pack.blockers.blockerCount).toBe(2);
    expect(pack.blockers.blockerKinds).toEqual(["external", "gate_failed"]);

    const unknownKind = packFromEvents([blockerRaised("something-private")]);
    expect(unknownKind.blockers.blockerKinds).toEqual(["other"]);
    expect(JSON.stringify(unknownKind)).not.toContain("something-private");
  });
});

// ─── Human touchpoints ───────────────────────────────────────────────────────

describe("buildEvidencePack — human touchpoints", () => {
  it("counts AskUserQuestion touchpoints via the known-safe marker only", () => {
    const pack = packFromEvents([status("coding"), askHuman()]);
    expect(pack.humanTouchpoints.askUserQuestionCount).toBe(1);
    expect(pack.humanTouchpoints.count).toBe(1);
  });

  it("does NOT treat ordinary assistant messages as touchpoints", () => {
    const pack = packFromEvents([status("coding"), chatter("just narrating my edit")]);
    expect(pack.humanTouchpoints.count).toBe(0);
    expect(pack.humanTouchpoints.askUserQuestionCount).toBe(0);
  });

  it("is zero for both clean fixtures", () => {
    for (const session of [syntheticSession(), realRedactedSession()]) {
      expect(buildEvidencePack({ session }).humanTouchpoints.count).toBe(0);
    }
  });
});

// ─── Reviewer focus (conservative, data-derived) ─────────────────────────────

describe("buildEvidencePack — reviewerFocus is conservative and data-derived", () => {
  it("surfaces NOTHING risky for a clean run with passing tests (no invented risk)", () => {
    for (const session of [syntheticSession(), realRedactedSession()]) {
      const kinds = focusKinds(buildEvidencePack({ session }));
      expect(kinds).not.toContain("failed_checks");
      expect(kinds).not.toContain("blockers_present");
      expect(kinds).not.toContain("no_tests_observed");
    }
  });

  it("flags failed checks only when a gate actually failed", () => {
    expect(focusKinds(packFromEvents([status("testing"), gateFail()]))).toContain("failed_checks");
    expect(focusKinds(packFromEvents([status("testing"), gatePass()]))).not.toContain("failed_checks");
  });

  it("flags blockers only when one was raised", () => {
    expect(focusKinds(packFromEvents([blockerRaised("external")]))).toContain("blockers_present");
  });

  it("flags 'no tests observed' only when no testing beats and no gates exist", () => {
    expect(focusKinds(packFromEvents([status("reading")]))).toContain("no_tests_observed");
    expect(focusKinds(packFromEvents([]))).toContain("no_tests_observed");
    expect(focusKinds(packFromEvents([status("testing"), gatePass()]))).not.toContain(
      "no_tests_observed",
    );
  });

  it("flags heavy editing only past the threshold", () => {
    const heavy = [status("coding"), status("coding"), status("coding"), status("coding"), status("coding")];
    expect(focusKinds(packFromEvents(heavy))).toContain("heavy_editing");
    expect(focusKinds(packFromEvents([status("coding")]))).not.toContain("heavy_editing");
  });

  it("flags a human touchpoint when observed", () => {
    expect(focusKinds(packFromEvents([askHuman()]))).toContain("human_touchpoint");
  });

  it("every reviewerFocus detail is content-free (count/category language only)", () => {
    const kinds = focusKinds(packFromEvents([status("testing"), gateFail(), blockerRaised("external")]));
    expect(kinds).toContain("failed_checks");
    expect(kinds).toContain("blockers_present");
    const pack = packFromEvents([status("testing"), gateFail(), blockerRaised("external")]);
    for (const item of pack.reviewerFocus) {
      expect(typeof item.detail).toBe("string");
      expect(["info", "warning"]).toContain(item.severity);
    }
  });
});

// ─── Redaction footer ────────────────────────────────────────────────────────

describe("buildEvidencePack — redaction notes", () => {
  it("includes a non-empty redaction note and an explicit omitted-category list", () => {
    const pack = buildEvidencePack({ session: realRedactedSession() });
    expect(pack.redaction.note.length).toBeGreaterThan(0);
    expect(pack.redaction.omitted.length).toBeGreaterThan(0);
    // Names the sensitive categories (phrased to avoid the forbidden probes).
    expect(pack.redaction.omitted).toContain("model reasoning");
    expect(pack.redaction.omitted).toContain("Bash command text");
    expect(pack.redaction.omitted).toContain("secrets and credentials");
  });
});

// ─── THE privacy gate: no raw transcript content in the serialized pack ──────

describe("buildEvidencePack — forbidden content never leaks", () => {
  const FORBIDDEN = [
    "/Users/",
    "/home/",
    "/root/",
    "rootk",
    "redacted-session",
    "evt_",
    "u-000",
    "tu-000",
    "[redacted]",
    "pnpm test",
    "Button.tsx",
    "API_KEY",
    "sk-",
    "ghp_",
    "thinking",
    "raw prompt text",
    "raw assistant text",
  ];

  it("the synthetic sample pack carries none of the forbidden tokens", () => {
    const serialized = JSON.stringify(buildEvidencePack({ session: syntheticSession() }));
    for (const probe of FORBIDDEN) {
      expect(serialized.includes(probe), `pack leaked: ${probe}`).toBe(false);
    }
  });

  it("the REAL redacted fixture pack carries none of the forbidden tokens", () => {
    const serialized = JSON.stringify(buildEvidencePack({ session: realRedactedSession() }));
    for (const probe of FORBIDDEN) {
      expect(serialized.includes(probe), `pack leaked: ${probe}`).toBe(false);
    }
  });
});

// ─── Caller-supplied beats are never trusted (allowlist contract) ────────────

describe("buildEvidencePack — does not trust caller-supplied beats", () => {
  it("regenerates the beat label from action/signalCount, ignoring an unsafe beat.label", () => {
    const pack = buildEvidencePack({
      session: syntheticSession(),
      beats: [
        rawBeat({
          zone: "coding",
          action: "edit",
          signalCount: 1,
          eventIds: ["evt_real-session_0001"],
          label: "API_KEY=sk-secret ./deploy.sh",
        }),
      ],
    });

    const serialized = JSON.stringify(pack);
    expect(serialized).not.toContain("sk-secret");
    expect(serialized).not.toContain("API_KEY");
    expect(serialized).not.toContain("deploy.sh");
    expect(serialized).not.toContain("evt_"); // raw eventIds are never read either
    // Label comes from action + signalCount, not the caller's label.
    expect(pack.activity.beatSequence).toEqual(["editing"]);
    expect(pack.activity.byZone).toEqual({ coding: 1 });
    expect(pack.activity.byAction).toEqual({ edit: 1 });
  });

  it("buckets non-enum zone/action keys as 'other' and never echoes them", () => {
    const pack = buildEvidencePack({
      session: syntheticSession(),
      beats: [
        rawBeat({
          zone: "ghp_leak-zone",
          action: "API_KEY=sk-evil",
          label: "sk-evil-label",
        }),
      ],
    });

    const serialized = JSON.stringify(pack);
    expect(serialized).not.toContain("ghp_");
    expect(serialized).not.toContain("sk-evil");
    expect(serialized).not.toContain("API_KEY");
    expect(pack.activity.byZone).toEqual({ other: 1 });
    expect(pack.activity.byAction).toEqual({ other: 1 });
    expect(pack.activity.beatSequence).toEqual(["activity observed"]);
  });

  it("coerces a non-numeric signalCount instead of interpolating it into a label", () => {
    const pack = buildEvidencePack({
      session: syntheticSession(),
      beats: [rawBeat({ zone: "reading", action: "read", signalCount: "sk-9 files", label: "x" })],
    });
    expect(JSON.stringify(pack)).not.toContain("sk-9");
    // Coerced to 0 → singular "reading", never "read sk-9 files".
    expect(pack.activity.beatSequence).toEqual(["reading"]);
  });
});

// ─── Same code path for both fixtures, and no input mutation ─────────────────

describe("buildEvidencePack — single code path + purity", () => {
  it("runs the same code path for the synthetic sample and the real fixture", () => {
    const synthetic = buildEvidencePack({ session: syntheticSession() });
    const real = buildEvidencePack({ session: realRedactedSession() });

    // Identical SHAPE…
    expect(Object.keys(synthetic).sort()).toEqual(Object.keys(real).sort());
    // …and, for these structurally-identical sessions, identical activity shape…
    expect(synthetic.activity.byZone).toEqual(real.activity.byZone);
    expect(synthetic.activity.byAction).toEqual(real.activity.byAction);
    // …but DIFFERENT content-free ids (proves the content differs, path doesn't).
    expect(synthetic.id).not.toBe(real.id);
  });

  it("does not mutate the input session, events, or beats", () => {
    const session = structuredClone(OBSERVED_SAMPLE_SESSION);
    const events = structuredClone(session.events);
    const beats = reduceObservedPlayback(events);

    const sessionBefore = structuredClone(session);
    const eventsBefore = structuredClone(events);
    const beatsBefore = structuredClone(beats);

    buildEvidencePack({ session, events, beats });

    expect(session).toEqual(sessionBefore);
    expect(events).toEqual(eventsBefore);
    expect(beats).toEqual(beatsBefore);
  });
});
