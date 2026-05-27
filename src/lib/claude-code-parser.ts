import type { WorkflowEvent } from "@/types/workflow-events";

/**
 * Claude Code session parser — v0.2 stub.
 *
 * Purpose
 *   Convert a captured Claude Code session (transcript JSONL + hook log) into
 *   the office's WorkflowEvent[] shape. The office can then visualise a real
 *   local agent run instead of replaying a scripted scenario.
 *
 * Status
 *   v0.1: stub only. Real transcript format wiring is deferred — the office
 *   uses `observed-sample.json` (the shape this stub will eventually emit)
 *   so that the observer surface, store path, validator, and UI can all be
 *   exercised end-to-end before any parser code exists.
 *
 * Why a stub?
 *   - Forces the rest of the system to commit to an "observed events" contract
 *     before we touch a real transcript file.
 *   - The day a parser lands, no other code changes: it returns the same
 *     `ParsedClaudeCodeSession` and existing callers consume it unchanged.
 *
 * Non-goals (v0.1)
 *   - Parsing the actual Claude Code transcript JSONL format.
 *   - Tail-following an open session.
 *   - Mapping Bash/Edit/Write tool calls onto the office's agent model.
 *   - Capturing PreToolUse hook output.
 */

export interface ParsedClaudeCodeSession {
  origin: {
    /** Where the events came from. */
    source: "claude-code-local" | "claude-code-cloud" | "fixture";
    /** Best-effort stable identifier — e.g. transcript filename or session UUID. */
    sessionId: string;
    /** ISO timestamp of when the session was captured / parsed. */
    capturedAt: string;
    /** Free-form note shown next to the scenario title. */
    note?: string;
  };
  /** Events in chronological order. Empty array is valid (an idle session). */
  events: WorkflowEvent[];
}

export class ClaudeCodeParserNotImplementedError extends Error {
  constructor(reason: string) {
    super(`Claude Code parser not implemented yet: ${reason}`);
    this.name = "ClaudeCodeParserNotImplementedError";
  }
}

/**
 * Parse a raw Claude Code transcript file (JSONL) into a ParsedClaudeCodeSession.
 *
 * v0.2: implement against the real Claude Code transcript format.
 * v0.1: throws, by design, so callers can't accidentally depend on parser
 * output that doesn't exist yet.
 */
export function parseClaudeCodeTranscript(_rawJsonl: string): ParsedClaudeCodeSession {
  throw new ClaudeCodeParserNotImplementedError(
    "transcript JSONL parsing is a v0.2 task — see EPIC for status",
  );
}

/**
 * Parse a PreToolUse / PostToolUse hook log into WorkflowEvents.
 *
 * The hook log is much closer to the office event model (one row per tool
 * invocation) and is the most likely first integration point. Still deferred
 * until we settle on a stable log schema.
 */
export function parseClaudeCodeHookLog(_lines: string[]): WorkflowEvent[] {
  throw new ClaudeCodeParserNotImplementedError(
    "hook log parsing is a v0.2 task — log schema not yet stable",
  );
}

/**
 * Round-trip helper for tests and fixtures. Accepts an already-parsed session
 * (e.g. the contents of observed-sample.json after the loader has typed it)
 * and returns the same shape. Lets fixture-driven code go through the same
 * code path as a future real parser without branching.
 */
export function sessionFromFixture(fixture: ParsedClaudeCodeSession): ParsedClaudeCodeSession {
  // No transformation today. Kept as a distinct function so the call site
  // reads as "we are deliberately using a fixture-shaped session, not a
  // hand-rolled list of events."
  return {
    origin: { ...fixture.origin },
    events: [...fixture.events],
  };
}
