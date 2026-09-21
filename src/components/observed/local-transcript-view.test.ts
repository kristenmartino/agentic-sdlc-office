import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  parseLocalTranscriptToObservedView,
  type LocalTranscriptResult,
} from "./local-transcript-view";
import { buildTimelineView } from "./observed-beat-view";

/**
 * Tests for the local transcript loader's pure view-prep (#65).
 *
 * The `LocalTranscriptLoader.tsx` is a thin consumer, so the meaningful
 * behaviour — loading a real transcript end-to-end, and refusing hostile input
 * with a SAFE summary — is verified here in vitest's node environment.
 */

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/claude-code-transcript-real-redacted.jsonl",
);
const fixtureJsonl = () => readFileSync(FIXTURE_PATH, "utf8");

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

function expectError(result: LocalTranscriptResult): asserts result is Extract<LocalTranscriptResult, { ok: false }> {
  expect(result.ok).toBe(false);
}

// ─── Loading a real transcript ───────────────────────────────────────────────

describe("parseLocalTranscriptToObservedView — valid transcript", () => {
  it("loads the real redacted fixture into beats + evidence markdown", () => {
    const result = parseLocalTranscriptToObservedView(fixtureJsonl());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.beats.length).toBeGreaterThan(0);
    expect(result.beatCount).toBe(result.beats.length);
    expect(result.eventCount).toBeGreaterThan(0);
    for (const header of SECTION_HEADERS) {
      expect(result.evidenceMarkdown, `missing section: ${header}`).toContain(header);
    }
    // The fixture's reads/edits/tests show up in the activity timeline.
    expect(result.evidenceMarkdown).toContain("**By zone:**");
  });

  it("leaks nothing through the renderable surfaces (timeline model + markdown)", () => {
    const result = parseLocalTranscriptToObservedView(fixtureJsonl());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Probe what can actually reach the UI: the timeline RENDER MODEL (which
    // drops raw eventIds) plus the evidence markdown. Raw `beats[].eventIds`
    // carry session-bearing ids by design, but the component never renders them.
    const renderable = JSON.stringify(buildTimelineView(result.beats)) + "\n" + result.evidenceMarkdown;
    for (const probe of FORBIDDEN) {
      expect(renderable.includes(probe), `loaded view leaked: ${probe}`).toBe(false);
    }
  });
});

// ─── Hostile / malformed input → safe errors, no raw content ─────────────────

describe("parseLocalTranscriptToObservedView — untrusted input stays safe", () => {
  it("malformed JSONL → safe error, no raw bytes echoed", () => {
    // A single invalid-JSON line stuffed with content that must never surface.
    const malformed = "not valid json — API_KEY=sk-live-123 ghp_abcd /Users/me/Button.tsx pnpm test [redacted]";
    const result = parseLocalTranscriptToObservedView(malformed);
    expectError(result);
    expect(result.message).toContain("Could not parse the file as JSONL");
    const serialized = JSON.stringify(result);
    for (const probe of FORBIDDEN) {
      expect(serialized.includes(probe), `error leaked: ${probe}`).toBe(false);
    }
  });

  it("valid JSON but wrong shape → safe error with count/line, no field values echoed", () => {
    // Valid JSON, known type, but message.role is wrong AND the line is spicy.
    const invalidShape = JSON.stringify({
      type: "user",
      message: { role: "NOPE", content: "API_KEY=sk-secret at /Users/me/Button.tsx (ghp_tok)" },
    });
    const result = parseLocalTranscriptToObservedView(invalidShape);
    expectError(result);
    expect(result.issueCount).toBeGreaterThanOrEqual(1);
    expect(result.firstLine).toBe(1);
    const serialized = JSON.stringify(result);
    for (const probe of FORBIDDEN) {
      expect(serialized.includes(probe), `error leaked: ${probe}`).toBe(false);
    }
    expect(serialized).not.toContain("NOPE"); // the echoed field value must not surface
  });

  it("tolerates an unknown line type and never surfaces its content", () => {
    // Under tolerant parsing an unrecognised line type is SKIPPED, not mapped —
    // so a spicy unknown line neither fails the import nor leaks (ok or not).
    const result = parseLocalTranscriptToObservedView(
      JSON.stringify({ type: "totally-bogus-type", smuggled: "API_KEY=sk-secret at /Users/x (ghp_tok)" }),
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("totally-bogus-type");
    expect(serialized).not.toContain("sk-secret");
    expect(serialized).not.toContain("API_KEY");
    expect(serialized).not.toContain("/Users/");
    expect(serialized).not.toContain("ghp_");
  });

  it("empty input → safe error", () => {
    const result = parseLocalTranscriptToObservedView("   \n  \n");
    expectError(result);
    expect(result.message).toContain("No transcript lines");
  });
});

// ─── Real-format tokens now load (the dogfooding fix) ────────────────────────

describe("parseLocalTranscriptToObservedView — real-format tokens load end-to-end", () => {
  it("accepts a transcript containing mode / image / tool_reference tokens", () => {
    const jsonl = [
      '{"type":"system","subtype":"init","sessionId":"s1","timestamp":"2026-06-01T12:00:00.000Z"}',
      '{"type":"mode","mode":"plan","sessionId":"s1"}',
      '{"type":"user","message":{"role":"user","content":"refactor the thing"},"uuid":"u1"}',
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_reference","name":"Edit"},{"type":"tool_use","id":"t1","name":"Edit","input":{"file_path":"/x/a.ts"}}]},"uuid":"u2"}',
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"ok"},{"type":"image","source":{"type":"base64","data":"AAAA"}}]},"uuid":"u3","toolUseResult":{"filePath":"/x/a.ts","structuredPatch":[]}}',
    ].join("\n");
    const result = parseLocalTranscriptToObservedView(jsonl);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.beats.length).toBeGreaterThan(0);
    expect(result.evidenceMarkdown).toContain("# Agent Session Evidence Pack");
    // And it still leaks nothing through the renderable surfaces.
    const renderable = JSON.stringify(buildTimelineView(result.beats)) + "\n" + result.evidenceMarkdown;
    for (const probe of FORBIDDEN) {
      expect(renderable.includes(probe), `loaded view leaked: ${probe}`).toBe(false);
    }
  });
});
