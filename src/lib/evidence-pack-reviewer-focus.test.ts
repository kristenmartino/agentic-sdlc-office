import { describe, expect, it } from "vitest";
import { buildEvidencePack } from "./evidence-pack";
import { renderEvidencePackMarkdown } from "./evidence-pack-markdown";
import { OBSERVED_SAMPLE_SESSION } from "@/data/mock-events-observed";
import type { WorkflowEvent } from "@/types/workflow-events";

/**
 * Reviewer-focus validation (test-only).
 *
 * The synthetic sample and the real redacted fixture are both *clean* runs, so
 * the Evidence Pack's "Reviewer focus" section is empty for them ("No focus
 * signals"). The value of the pack is clearest when a session has something to
 * review — so this test drives a deliberately RISKY synthetic observed stream
 * (failed gate, blocker, human touchpoint, heavy editing, a PR) through the
 * exact production path (`buildEvidencePack` → `renderEvidencePackMarkdown`) and
 * asserts the reviewer-focus section becomes genuinely useful.
 *
 * It is also an ADVERSARIAL privacy test: every raw payload below is stuffed
 * with content that must never surface (home paths, a `pnpm test` command,
 * stderr, an API key, a GitHub token, a private repo, raw `thinking`, raw
 * event/gate/blocker ids). The pack and its markdown must carry the safe
 * counts/categories while leaking none of it.
 *
 * TEST-ONLY: no scenario registration, no UI, no fixture file — synthetic
 * events built inline.
 */

// ─── A risky synthetic observed stream, with spicy raw content embedded ──────

let _seq = 0;
const ev = (type: WorkflowEvent["type"], payload: Record<string, unknown>): WorkflowEvent => ({
  // Mapper-style id that embeds a session id — must never be read/emitted.
  id: `evt_redacted-session-stress_${String(++_seq).padStart(4, "0")}`,
  ts: new Date(Date.parse("2026-05-27T15:00:00.000Z") + _seq * 1000).toISOString(),
  actor: "mira",
  type,
  subject: "wi_stress",
  // Status messages carry a raw path; the reducer reads only `to`, never this.
  payload,
});

// Status changes carry a spicy `message` (a raw path) the reducer must ignore.
const status = (to: string) =>
  ev("agent.status.changed", { agentId: "mira", to, message: "/Users/dev/proj/src/Button.tsx" });

const message = (text: string) => ev("agent.message.sent", { agentId: "mira", message: text });

// The single known-safe marker the mapper emits for an observed AskUserQuestion.
const askHuman = () => message("Asked the human a question (observed; not surfaced as a decision)");

// A non-marker assistant message dripping with forbidden tokens — attached as
// detail, never read into a label or count.
const spicyChatter = () =>
  message("thinking: refactor Button.tsx; ran `pnpm test`; API_KEY=sk-live-9f8e7d; token ghp_abcd1234efgh5678");

const gateFail = () =>
  ev("quality_gate.failed", {
    gate: {
      id: "gate_redacted-session_0001",
      workItemId: "wi_stress",
      name: "Bash: pnpm test", // raw command in the gate name
      owner: "mira",
      status: "failed",
      notes: "FAIL src/Button.test.tsx\nstderr: Error at /Users/dev/proj (API_KEY=sk-live-9f8e7d)",
    },
  });

const gatePass = () =>
  ev("quality_gate.passed", {
    gate: { id: "gate_redacted-session_0002", name: "Bash: pnpm test", status: "passed", notes: "ok" },
  });

const blocker = () =>
  ev("blocker.raised", {
    blocker: {
      id: "blk_redacted-session_0001",
      workItemId: "wi_stress",
      raisedBy: "mira",
      kind: "gate_failed",
      description: "pre-commit hook blocked: /Users/dev/.husky (leaked ghp_abcd1234efgh5678)",
      resolution: null,
      resolvedAt: null,
    },
  });

const editArtifact = () =>
  ev("artifact.produced", {
    artifact: {
      id: "art_redacted-session_0001",
      workItemId: "wi_stress",
      producedBy: "mira",
      kind: "code_pr",
      ref: "/Users/dev/proj/src/Button.tsx", // raw path
      summary: "Edit: Button.tsx — 3 hunks",
      ts: "2026-05-27T15:00:10.000Z",
    },
  });

const prArtifact = () =>
  ev("artifact.produced", {
    artifact: {
      id: "art_redacted-session_0002",
      workItemId: "wi_stress",
      producedBy: "mira",
      kind: "code_pr",
      ref: "https://github.com/acme/secret-repo/pull/7", // private repo URL
      summary: "PR #7 opened in acme/secret-repo",
      ts: "2026-05-27T15:00:20.000Z",
    },
  });

/** A realistic risky session: reads, asks a human, edits heavily, a gate fails,
 *  a blocker is raised, then a retry passes and a PR is opened. */
function riskyStream(): WorkflowEvent[] {
  return [
    ev("run.started", {}),
    ev("work_item.created", { title: "Refactor /Users/dev/proj/src/Button.tsx" }),
    ev("work_item.owner.changed", { workItemId: "wi_stress", from: null, to: "mira" }),
    ev("work_item.mode.changed", { workItemId: "wi_stress", from: null, to: "Generate" }),
    status("reading"),
    status("reading"),
    askHuman(),
    // Heavy editing — 6 coding signals coalesce into one beat (signalCount 6).
    status("coding"),
    status("coding"),
    status("coding"),
    status("coding"),
    status("coding"),
    status("coding"),
    spicyChatter(),
    editArtifact(),
    status("testing"),
    gateFail(),
    blocker(),
    status("coding"),
    status("testing"),
    gatePass(),
    prArtifact(),
    ev("work_item.completed", { workItemId: "wi_stress" }),
    ev("run.completed", {}),
  ];
}

const riskyPack = () => buildEvidencePack({ session: OBSERVED_SAMPLE_SESSION, events: riskyStream() });

// ─── Reviewer focus becomes useful ───────────────────────────────────────────

describe("Evidence Pack — reviewer focus on a risky session", () => {
  it("surfaces the review-worthy signals (not just 'No focus signals')", () => {
    const focus = riskyPack().reviewerFocus;
    const kinds = focus.map((f) => f.kind);
    expect(kinds).toContain("failed_checks");
    expect(kinds).toContain("blockers_present");
    expect(kinds).toContain("human_touchpoint");
    expect(kinds).toContain("heavy_editing");
    // Conservative: a session with tests does NOT also claim "no tests observed".
    expect(kinds).not.toContain("no_tests_observed");
  });

  it("rolls up the underlying summaries correctly", () => {
    const pack = riskyPack();
    expect(pack.quality).toMatchObject({ passedCount: 1, failedCount: 1, status: "mixed" });
    expect(pack.blockers).toEqual({ blockerCount: 1, blockerKinds: ["gate_failed"], blockedStateCount: 1 });
    expect(pack.humanTouchpoints).toEqual({ count: 1, askUserQuestionCount: 1 });
    expect(pack.filesAndArtifacts.prCount).toBe(1);
    expect(pack.filesAndArtifacts.editedFileCount).toBe(1);
    expect(pack.filesAndArtifacts.artifactKinds).toEqual(["code_pr"]);
  });

  it("surfaces a failed-status block even with NO governance blocker raised (kills the contradiction)", () => {
    // `status -> failed` produces a `blocked` beat but emits no `blocker.raised`.
    // The pack must not say "Blockers: None" while a `blocked` beat exists.
    const pack = buildEvidencePack({
      session: OBSERVED_SAMPLE_SESSION,
      events: [status("coding"), status("failed")],
    });
    expect(pack.blockers.blockerCount).toBe(0); // no governance blocker raised
    expect(pack.blockers.blockedStateCount).toBe(1); // but a blocked/failed state occurred
    expect(pack.reviewerFocus.map((f) => f.kind)).toContain("blocked_state");

    const md = renderEvidencePackMarkdown(pack);
    const blockers = md.slice(md.indexOf("## Blockers"), md.indexOf("## Human touchpoints"));
    expect(blockers).not.toContain("None observed"); // the old contradiction is gone
    expect(blockers).toContain("blocked / failed state");
  });

  it("renders a useful Reviewer focus section in the markdown", () => {
    const md = renderEvidencePackMarkdown(riskyPack());
    const focusSection = md.slice(md.indexOf("## Reviewer focus"), md.indexOf("## Redaction"));
    expect(focusSection).toContain("**WARNING** — 1 quality gate failed");
    expect(focusSection).toContain("**WARNING** — 1 blocker raised");
    expect(focusSection).toContain("**NOTE** — heavy editing observed (7 edits)");
    expect(focusSection).toContain("**NOTE** — 1 human touchpoint observed");
    expect(focusSection).not.toContain("No focus signals");
  });
});

// ─── …while leaking none of the spicy raw content ────────────────────────────

describe("Evidence Pack — risky session stays privacy-safe (adversarial)", () => {
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
    "secret-repo",
    ".husky",
  ];

  it("the serialized pack carries none of the forbidden tokens", () => {
    const serialized = JSON.stringify(riskyPack());
    for (const probe of FORBIDDEN) {
      expect(serialized.includes(probe), `pack leaked: ${probe}`).toBe(false);
    }
  });

  it("the rendered markdown carries none of the forbidden tokens", () => {
    const md = renderEvidencePackMarkdown(riskyPack());
    for (const probe of FORBIDDEN) {
      expect(md.includes(probe), `markdown leaked: ${probe}`).toBe(false);
    }
  });
});
