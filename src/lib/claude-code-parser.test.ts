import { describe, expect, it } from "vitest";
import {
  ClaudeCodeParserNotImplementedError,
  deriveChainFromEvents,
  parseClaudeCodeHookLog,
  parseClaudeCodeTranscript,
  sessionFromFixture,
  type ParsedClaudeCodeSession,
} from "./claude-code-parser";
import {
  OBSERVED_SAMPLE_CHAIN,
  OBSERVED_SAMPLE_EVENTS,
  OBSERVED_SAMPLE_INITIAL,
  OBSERVED_SAMPLE_ORIGIN,
  OBSERVED_SAMPLE_SESSION,
} from "@/data/mock-events-observed";
import type { WorkflowEvent } from "@/types/workflow-events";

function fixtureSession(overrides: Partial<ParsedClaudeCodeSession> = {}): ParsedClaudeCodeSession {
  return {
    origin: { ...OBSERVED_SAMPLE_ORIGIN },
    workItem: structuredClone(OBSERVED_SAMPLE_INITIAL),
    chain: [...OBSERVED_SAMPLE_CHAIN],
    events: structuredClone(OBSERVED_SAMPLE_EVENTS),
    ...overrides,
  };
}

describe("claude-code-parser (v0.1 stub)", () => {
  it("parseClaudeCodeTranscript throws ClaudeCodeParserNotImplementedError", () => {
    expect(() => parseClaudeCodeTranscript("anything")).toThrow(ClaudeCodeParserNotImplementedError);
  });

  it("parseClaudeCodeHookLog throws ClaudeCodeParserNotImplementedError", () => {
    expect(() => parseClaudeCodeHookLog([])).toThrow(ClaudeCodeParserNotImplementedError);
  });

  it("error includes the parser name so callers can grep for it", () => {
    try {
      parseClaudeCodeTranscript("");
    } catch (err) {
      expect(err).toBeInstanceOf(ClaudeCodeParserNotImplementedError);
      expect((err as Error).message).toMatch(/not implemented/i);
      return;
    }
    throw new Error("expected parser to throw");
  });

  it("sessionFromFixture deep-copies the session — nested mutation can't leak", () => {
    const fixture = fixtureSession();
    const parsed = sessionFromFixture(fixture);
    expect(parsed.events.length).toBe(fixture.events.length);
    expect(parsed.workItem.id).toBe(fixture.workItem.id);

    // Mutate everything reachable on the parsed copy — must not affect the original.
    parsed.events.pop();
    parsed.events[0].id = "mutated";
    parsed.workItem.title = "mutated";
    parsed.chain.push("rune");
    parsed.origin.source = "claude-code-cloud";

    expect(fixture.events.length).toBe(parsed.events.length + 1);
    expect(fixture.events[0].id).not.toBe("mutated");
    expect(fixture.workItem.title).not.toBe("mutated");
    expect(fixture.chain).not.toContain("rune");
    expect(fixture.origin.source).toBe(OBSERVED_SAMPLE_ORIGIN.source);
  });

  it("the loaded sample session matches the parser's shape", () => {
    expect(OBSERVED_SAMPLE_SESSION.origin.sessionId).toBe(OBSERVED_SAMPLE_ORIGIN.sessionId);
    expect(OBSERVED_SAMPLE_SESSION.workItem.id).toBe(OBSERVED_SAMPLE_INITIAL.id);
    expect(OBSERVED_SAMPLE_SESSION.chain).toEqual(OBSERVED_SAMPLE_CHAIN);
    expect(OBSERVED_SAMPLE_SESSION.events.length).toBe(OBSERVED_SAMPLE_EVENTS.length);
  });
});

describe("deriveChainFromEvents", () => {
  it("returns owners in the order they take the work item", () => {
    const events: WorkflowEvent[] = [
      ownerChange("piper"),
      ownerChange("nova"),
      ownerChange("theo"),
    ];
    expect(deriveChainFromEvents(fixtureSession({ events }))).toEqual(["piper", "nova", "theo"]);
  });

  it("collapses immediately-adjacent duplicates", () => {
    const events: WorkflowEvent[] = [
      ownerChange("mira"),
      ownerChange("mira"),
      ownerChange("mira"),
    ];
    expect(deriveChainFromEvents(fixtureSession({ events }))).toEqual(["mira"]);
  });

  it("preserves the same agent reappearing later (BUG-032 pattern)", () => {
    const events: WorkflowEvent[] = [
      ownerChange("rune"),
      ownerChange("piper"),
      ownerChange("rune"),
    ];
    expect(deriveChainFromEvents(fixtureSession({ events }))).toEqual(["rune", "piper", "rune"]);
  });

  it("falls back to the work item's initial owner when no owner.changed events exist", () => {
    const session = fixtureSession({
      events: [],
      workItem: { ...OBSERVED_SAMPLE_INITIAL, ownerAgentId: "tess" },
    });
    expect(deriveChainFromEvents(session)).toEqual(["tess"]);
  });

  it("returns an empty array when there's neither owner change nor an initial owner", () => {
    const session = fixtureSession({
      events: [],
      workItem: { ...OBSERVED_SAMPLE_INITIAL, ownerAgentId: null },
    });
    expect(deriveChainFromEvents(session)).toEqual([]);
  });

  it("silently skips owner.changed events with unknown agent IDs", () => {
    const session = fixtureSession({
      events: [
        ownerChange("piper"),
        ownerChange("bogus"),
        ownerChange("nova"),
      ],
    });
    expect(deriveChainFromEvents(session)).toEqual(["piper", "nova"]);
  });

  it("falls through to empty when the work item's initial owner is unknown", () => {
    const session = fixtureSession({
      events: [],
      // Bypass TS so we can simulate an external JSON fixture with a bogus owner.
      workItem: { ...OBSERVED_SAMPLE_INITIAL, ownerAgentId: "bogus" as never },
    });
    expect(deriveChainFromEvents(session)).toEqual([]);
  });
});

function ownerChange(to: string): WorkflowEvent {
  return {
    id: `evt_test_${to}_${Math.random().toString(36).slice(2, 7)}`,
    ts: "2026-05-27T15:00:00.000Z",
    actor: "system",
    type: "work_item.owner.changed",
    subject: "wi_test",
    payload: { workItemId: "wi_test", from: null, to },
  };
}
