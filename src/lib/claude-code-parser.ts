import type { WorkflowEvent } from "@/types/workflow-events";
import type { WorkItem } from "@/types/work-items";
import type { AgentId } from "@/types/agents";

/**
 * Claude Code session parser — v0.2 stub.
 *
 * Purpose
 *   Convert a captured Claude Code session (transcript JSONL + hook log) into
 *   a `ParsedClaudeCodeSession` that drops straight into the scenario
 *   registry. The office can then visualise a real local agent run instead
 *   of replaying a scripted scenario.
 *
 * Contract
 *   The parser returns enough to register a scenario without any further
 *   transformation: `origin`, `workItem`, `chain`, and `events`. Earlier
 *   versions returned only `origin` + `events` and required the caller to
 *   stitch in a work item and a chain separately; that proved to be a
 *   needless seam.
 *
 * Status
 *   v0.1: stub only. Real transcript format wiring is deferred — the office
 *   uses `observed-sample.json` (the shape this stub will eventually emit)
 *   so that the observer surface, store path, validator, and UI can all be
 *   exercised end-to-end before any parser code exists.
 *
 * Why a stub?
 *   - Forces the rest of the system to commit to an "observed events"
 *     contract before we touch a real transcript file.
 *   - The day a parser lands, no other code changes: it returns the same
 *     `ParsedClaudeCodeSession` and existing callers consume it unchanged.
 *
 * Non-goals (v0.1)
 *   - Parsing the actual Claude Code transcript JSONL format.
 *   - Tail-following an open session.
 *   - Mapping Bash/Edit/Write tool calls onto the office's agent model.
 *   - Capturing PreToolUse hook output.
 */

export interface ParsedClaudeCodeSessionOrigin {
  /** Where the events came from. */
  source: "claude-code-local" | "claude-code-cloud" | "fixture";
  /** Best-effort stable identifier — e.g. transcript filename or session UUID. */
  sessionId: string;
  /** ISO timestamp of when the session was captured / parsed. */
  capturedAt: string;
  /** Free-form note shown next to the scenario title. */
  note?: string;
}

export interface ParsedClaudeCodeSession {
  origin: ParsedClaudeCodeSessionOrigin;
  /** The work item the session was about. Mirrors `Scenario.initialWorkItem`. */
  workItem: WorkItem;
  /**
   * Expected handoff order, in chain form. For most observed sessions this
   * is derived from the sequence of `work_item.owner.changed` events the
   * parser saw (deduplicated only when the same agent appears twice
   * adjacently). The scenario validator skips its 1:1 length check for
   * observed scenarios, so `chain` here is informational for the
   * `PhaseTimeline` ribbon, not a strict gate.
   */
  chain: AgentId[];
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
 * and returns a deeply-cloned copy. Lets fixture-driven code go through the
 * same code path as a future real parser without branching, and protects the
 * caller's fixture from accidental mutation downstream.
 */
export function sessionFromFixture(fixture: ParsedClaudeCodeSession): ParsedClaudeCodeSession {
  return structuredClone(fixture);
}

/**
 * Derive the `chain` field from a session's events.
 *
 * Reads the sequence of `work_item.owner.changed` events and returns the
 * `to` agent for each, in order. Collapses *immediately adjacent* duplicates
 * (`["mira", "mira"]` becomes `["mira"]`) but preserves repeats with another
 * agent in between (`["rune", "piper", "rune"]` stays as-is — that's the
 * BUG-032 pattern).
 *
 * If the session has no owner.changed events but does name an initial owner
 * on its work item, falls back to `[workItem.ownerAgentId]`. As a last
 * resort returns an empty array — callers can decide what to do with that.
 */
export function deriveChainFromEvents(session: ParsedClaudeCodeSession): AgentId[] {
  const owners: AgentId[] = [];
  for (const event of session.events) {
    if (event.type !== "work_item.owner.changed") continue;
    const to = (event.payload as { to?: AgentId }).to;
    if (!to) continue;
    if (owners[owners.length - 1] === to) continue;
    owners.push(to);
  }
  if (owners.length > 0) return owners;
  if (session.workItem.ownerAgentId) return [session.workItem.ownerAgentId];
  return [];
}
