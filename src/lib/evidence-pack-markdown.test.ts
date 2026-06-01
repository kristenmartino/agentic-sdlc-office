import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { renderEvidencePackMarkdown } from "./evidence-pack-markdown";
import { buildEvidencePack } from "./evidence-pack";
import {
  parseClaudeCodeTranscript,
  type ParsedClaudeCodeSession,
} from "./claude-code-parser";
import { OBSERVED_SAMPLE_SESSION } from "@/data/mock-events-observed";
import type { WorkflowEvent } from "@/types/workflow-events";
import type { EvidencePack } from "@/types/evidence-pack";

/**
 * Tests for `renderEvidencePackMarkdown` (#61).
 *
 * The renderer takes only an already-content-safe `EvidencePack`, so the privacy
 * gate is the end-to-end one: build a pack from the synthetic sample AND the real
 * redacted transcript, render each, and assert the markdown carries none of the
 * forbidden raw tokens — plus the full section set and the redaction disclaimer.
 */

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/claude-code-transcript-real-redacted.jsonl",
);
const realRedactedSession = (): ParsedClaudeCodeSession =>
  parseClaudeCodeTranscript(readFileSync(FIXTURE_PATH, "utf8"));
const syntheticSession = (): ParsedClaudeCodeSession => OBSERVED_SAMPLE_SESSION;

const syntheticPack = (): EvidencePack => buildEvidencePack({ session: syntheticSession() });
const realPack = (): EvidencePack => buildEvidencePack({ session: realRedactedSession() });

// Minimal event builders for focus / edge-case packs.
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
const gateFail = () => ev("quality_gate.failed", { gate: { id: "g", status: "failed" } });
const packFromEvents = (events: WorkflowEvent[]): EvidencePack =>
  buildEvidencePack({ session: syntheticSession(), events });

const SECTION_HEADERS = [
  "# Agent Session Evidence Pack",
  "## Work item",
  "## Activity",
  "## Files & artifacts",
  "## Quality gates",
  "## Blockers",
  "## Human touchpoints",
  "## Reviewer focus",
  "## Redaction",
];

// ─── Structure ───────────────────────────────────────────────────────────────

describe("renderEvidencePackMarkdown — structure", () => {
  it("renders the full section set for both fixtures", () => {
    for (const pack of [syntheticPack(), realPack()]) {
      const md = renderEvidencePackMarkdown(pack);
      for (const header of SECTION_HEADERS) {
        expect(md, `missing section: ${header}`).toContain(header);
      }
    }
  });

  it("renders the header metadata (id, generatedAt, source)", () => {
    const pack = syntheticPack();
    const md = renderEvidencePackMarkdown(pack);
    expect(md).toContain(`**Pack ID:** \`${pack.id}\``);
    expect(md).toContain(`**Generated:** ${pack.generatedAt}`);
    expect(md).toContain("**Source:** observed-session");
    // The work-item intent is the safe fallback, never a raw title.
    expect(md).toContain("**Intent:** Observed session");
  });

  it("is pure/deterministic and does not mutate the pack", () => {
    const pack = syntheticPack();
    const snapshot = structuredClone(pack);
    const first = renderEvidencePackMarkdown(pack);
    const second = renderEvidencePackMarkdown(pack);
    expect(first).toBe(second);
    expect(pack).toEqual(snapshot);
    expect(typeof first).toBe("string");
  });
});

// ─── Content from the pack ───────────────────────────────────────────────────

describe("renderEvidencePackMarkdown — content", () => {
  it("renders the activity shape and timeline for the real fixture", () => {
    const pack = realPack();
    const md = renderEvidencePackMarkdown(pack);
    expect(md).toContain("**Timeline:** reading → editing → running tests → tests passed");
    expect(md).toContain("**By zone:**");
    expect(md).toContain(`collapsed into **${pack.activity.totalBeats}** beat`);
  });

  it("renders quality gate and artifact summaries without raw refs", () => {
    for (const pack of [syntheticPack(), realPack()]) {
      const md = renderEvidencePackMarkdown(pack);
      expect(md).toContain("**Overall:** passed");
      expect(md).toContain("**Passed:** 1");
      expect(md).toContain("(code_pr)");
      expect(md).toContain("**PRs opened:** 0");
    }
  });

  it("renders 'None observed.' for clean blockers and human touchpoints", () => {
    const md = renderEvidencePackMarkdown(syntheticPack());
    const blockers = md.slice(md.indexOf("## Blockers"));
    expect(blockers).toContain("None observed.");
  });

  it("includes the redaction disclaimer and omitted categories", () => {
    const pack = realPack();
    const md = renderEvidencePackMarkdown(pack);
    expect(md).toContain(pack.redaction.note);
    expect(md).toContain("**Deliberately omitted:**");
    expect(md).toContain("- model reasoning");
    expect(md).toContain("- secrets and credentials");
  });
});

// ─── Reviewer focus rendering ────────────────────────────────────────────────

describe("renderEvidencePackMarkdown — reviewer focus", () => {
  it("shows a reassuring line when there are no focus signals (clean run)", () => {
    const md = renderEvidencePackMarkdown(syntheticPack());
    expect(md).toContain("No focus signals");
  });

  it("renders focus items with a severity marker and the content-safe detail", () => {
    const pack = packFromEvents([status("testing"), gateFail()]);
    expect(pack.reviewerFocus.some((f) => f.kind === "failed_checks")).toBe(true);
    const md = renderEvidencePackMarkdown(pack);
    expect(md).toContain("**WARNING**");
    expect(md).toContain("1 quality gate failed");
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe("renderEvidencePackMarkdown — edge cases", () => {
  it("renders an idle/empty pack without crashing (em-dash placeholders)", () => {
    const md = renderEvidencePackMarkdown(packFromEvents([]));
    expect(md).toContain("# Agent Session Evidence Pack");
    expect(md).toContain("**Timeline:** —");
    expect(md).toContain("collapsed into **0** beats");
    for (const header of SECTION_HEADERS) expect(md).toContain(header);
  });
});

// ─── THE privacy gate: rendered markdown carries no raw content ───────────────

describe("renderEvidencePackMarkdown — forbidden content never leaks", () => {
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

  it("the synthetic sample markdown carries none of the forbidden tokens", () => {
    const md = renderEvidencePackMarkdown(syntheticPack());
    for (const probe of FORBIDDEN) {
      expect(md.includes(probe), `markdown leaked: ${probe}`).toBe(false);
    }
  });

  it("the REAL redacted fixture markdown carries none of the forbidden tokens", () => {
    const md = renderEvidencePackMarkdown(realPack());
    for (const probe of FORBIDDEN) {
      expect(md.includes(probe), `markdown leaked: ${probe}`).toBe(false);
    }
  });
});
