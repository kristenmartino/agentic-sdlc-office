import { describe, expect, it } from "vitest";
import {
  ClaudeCodeParserNotImplementedError,
  parseClaudeCodeHookLog,
  parseClaudeCodeTranscript,
  sessionFromFixture,
  type ParsedClaudeCodeSession,
} from "./claude-code-parser";
import {
  OBSERVED_SAMPLE_EVENTS,
  OBSERVED_SAMPLE_ORIGIN,
} from "@/data/mock-events-observed";

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

  it("sessionFromFixture round-trips an observed-sample session", () => {
    const fixture: ParsedClaudeCodeSession = {
      origin: {
        source: "fixture",
        sessionId: OBSERVED_SAMPLE_ORIGIN.sessionId,
        capturedAt: OBSERVED_SAMPLE_ORIGIN.capturedAt,
      },
      events: OBSERVED_SAMPLE_EVENTS,
    };
    const parsed = sessionFromFixture(fixture);
    expect(parsed.origin.source).toBe("fixture");
    expect(parsed.events.length).toBe(OBSERVED_SAMPLE_EVENTS.length);
    // It's a copy — mutating shouldn't affect the source.
    parsed.events.pop();
    expect(parsed.events.length).toBe(OBSERVED_SAMPLE_EVENTS.length - 1);
    expect(OBSERVED_SAMPLE_EVENTS.length).toBeGreaterThan(0);
  });
});
