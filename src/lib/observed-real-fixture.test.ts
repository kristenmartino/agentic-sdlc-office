import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseRawTranscript, validateRawTranscript } from "./claude-code-transcript";
import { parseClaudeCodeTranscript } from "./claude-code-parser";
import { validateScenario } from "./validate-scenario";
import { reduceObservedPlayback } from "./observed-playback-reducer";
import { buildTimelineView } from "@/components/observed/observed-beat-view";
import type { Scenario } from "@/data/scenarios";

/**
 * Proof that the observed pipeline runs end-to-end against a REAL-FORMAT
 * (redacted) Claude Code transcript — not just the hand-authored synthetic
 * sample. The fixture was produced by a disposable local Claude Code session,
 * redacted by a human before handoff, then given safe synthetic scaffolding
 * (placeholder prompt, generic `pnpm test`). See
 * [docs/architecture/redacted-real-fixture.md].
 *
 * TEST-ONLY: this fixture is NOT registered in the scenario list and there is
 * no file loader — it exists solely to prove the pipeline shape and the
 * privacy contract against real-format input.
 *
 * The load-bearing assertion is the last test: the serialized *render model*
 * (everything that can reach the UI) must contain none of the transcript's
 * identifiers, paths, commands, or content.
 */

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/claude-code-transcript-real-redacted.jsonl",
);
const fixtureJsonl = () => readFileSync(FIXTURE_PATH, "utf8");

describe("redacted real-format transcript fixture", () => {
  it("parseRawTranscript parses every line", () => {
    const lines = parseRawTranscript(fixtureJsonl());
    expect(lines.length).toBeGreaterThan(0);
  });

  it("validateRawTranscript returns no issues", () => {
    const issues = validateRawTranscript(parseRawTranscript(fixtureJsonl()));
    expect(issues).toEqual([]);
  });

  it("parseClaudeCodeTranscript maps it into a ParsedClaudeCodeSession", () => {
    const session = parseClaudeCodeTranscript(fixtureJsonl());
    expect(session.events.length).toBeGreaterThan(0);
    expect(session.workItem).toBeTruthy();
    expect(session.chain.length).toBeGreaterThan(0);
  });

  it("wraps as an observed scenario that passes validateScenario", () => {
    const session = parseClaudeCodeTranscript(fixtureJsonl());
    const scenario: Scenario = {
      // Reuse a valid ScenarioId for the wrap — this fixture is test-only and
      // is deliberately NOT added to the scenario registry / selector.
      id: "observed-sample",
      title: "Observed — real redacted fixture (test-only)",
      subtitle: "Redacted real-format Claude Code session.",
      kind: "feature",
      source: "observed",
      initialWorkItem: session.workItem,
      events: session.events,
      chain: session.chain,
      origin: session.origin,
    };
    expect(validateScenario(scenario)).toEqual([]);
  });

  it("reduceObservedPlayback produces beats across reading/coding/testing", () => {
    const session = parseClaudeCodeTranscript(fixtureJsonl());
    const beats = reduceObservedPlayback(session.events);
    expect(beats.length).toBeGreaterThan(0);
    const zones = new Set(beats.map((b) => b.zone));
    expect(zones.has("reading")).toBe(true);
    expect(zones.has("coding")).toBe(true);
    expect(zones.has("testing")).toBe(true);
  });

  it("buildTimelineView renders a model with NO raw transcript leakage", () => {
    const session = parseClaudeCodeTranscript(fixtureJsonl());
    const beats = reduceObservedPlayback(session.events);
    const view = buildTimelineView(beats);
    expect(view.sequence.length).toBe(beats.length);

    // Everything that can reach the UI is in this serialized model. None of the
    // transcript's identifiers / paths / commands / content may appear.
    const serialized = JSON.stringify(view);
    const forbidden = [
      "/Users/", "/home/", "/root/", // file paths
      "redacted-session", // raw session id
      "sample-session-slug", // session slug
      "evt_", // mapper event ids embed the session id
      "tu-0001", "u-0002", "u-0003", // raw uuids / tool-use ids
      "[redacted]", // raw content placeholders
      "pnpm test", // raw bash command
      "Button.tsx", // raw file name
    ];
    for (const probe of forbidden) {
      expect(serialized.includes(probe), `render model leaked: ${probe}`).toBe(false);
    }
  });

  it("the committed fixture file itself carries no obvious private markers", () => {
    // Defense in depth: the render-model test above is the UI-safety gate, but
    // the fixture is committed to a public repo, so assert the raw bytes too.
    // Allowlist-aware — the placeholder path is expected/allowed.
    const raw = fixtureJsonl();
    expect(raw).not.toContain("rootk");
    expect(raw).not.toContain("/Users/rootk");
    expect(raw).not.toContain("/home/");
    expect(raw).not.toContain("/root/");
    expect(raw).not.toContain("floofy"); // the original (random) session slug
    expect(raw).not.toContain("thinking"); // raw model reasoning must never ship
    expect(raw).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); // emails
    expect(raw).not.toMatch(/sk-[A-Za-z0-9_-]{10,}/); // api-key-shaped
    expect(raw).not.toMatch(/ghp_[A-Za-z0-9]{20,}/); // github-token-shaped
    // The placeholder path is expected — it preserves path-shaped structure.
    expect(raw).toContain("/Users/example/sample-repo");
  });
});
