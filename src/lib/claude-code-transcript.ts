import { isIsoTimestamp } from "./runtime-unions";

/**
 * Types for raw Claude Code transcript lines.
 *
 * A Claude Code session is persisted as a JSONL file under
 * `~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl`. Each line is a
 * single JSON object representing a turn in the conversation: a user
 * message, an assistant response (possibly with embedded tool calls), the
 * result of a tool call, or a system/meta event.
 *
 * This module is the input contract for the parser — the shape we expect
 * to receive on disk. The parser's job is to map these raw lines into the
 * office's `WorkflowEvent` model.
 *
 * The shapes here are intentionally loose: real transcripts include fields
 * we don't yet model, and Claude Code's storage format can evolve. Treat
 * unknown fields as additive — never throw on extras, only validate the
 * fields we actually read.
 *
 * Source of truth: this module reflects the JSONL shape as observed in
 * Claude Code today. When Anthropic publishes a formal schema, this file
 * should be updated to match.
 */

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock;

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  /** Anthropic API-style identifier, e.g. "toolu_01ABC...". */
  id: string;
  /** Tool name as registered with the API, e.g. "Read", "Edit", "Bash". */
  name: string;
  /** Arbitrary tool-specific input. */
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  /** Result body — either a plain string (most tools) or a nested content array. */
  content: string | ContentBlock[];
  is_error?: boolean;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
}

interface RawTranscriptLineBase {
  /** Stable identifier for this line. */
  uuid?: string;
  /** UUID of the line this one replies to. Null for the first user turn. */
  parentUuid?: string | null;
  /** Session-wide identifier (matches the file name). */
  sessionId?: string;
  /** ISO 8601 timestamp the line was written. */
  timestamp?: string;
  /** Working directory at the time of the turn. */
  cwd?: string;
  /** Claude Code version that produced the line. */
  version?: string;
}

export interface RawUserMessage extends RawTranscriptLineBase {
  type: "user";
  message: {
    role: "user";
    /** Short prompts are plain strings; tool results arrive as content arrays. */
    content: string | ContentBlock[];
  };
}

export interface RawAssistantMessage extends RawTranscriptLineBase {
  type: "assistant";
  message: {
    role: "assistant";
    content: ContentBlock[];
    /** Anthropic model id, e.g. "claude-opus-4-7". */
    model?: string;
    stop_reason?: string | null;
  };
}

export interface RawSystemMessage extends RawTranscriptLineBase {
  type: "system";
  /** Free-form subtype tag — values include "init", "context", etc. */
  subtype?: string;
  /** Many system lines also carry arbitrary metadata. */
  [key: string]: unknown;
}

export interface RawSummaryLine extends RawTranscriptLineBase {
  type: "summary";
  /** Auto-generated session summary; populated retroactively. */
  summary: string;
}

export type RawTranscriptLine =
  | RawUserMessage
  | RawAssistantMessage
  | RawSystemMessage
  | RawSummaryLine;

/**
 * Parse a JSONL transcript string into raw lines.
 *
 * - Empty lines are skipped (a trailing newline is normal).
 * - Lines that don't parse as JSON throw, with a useful error pointing at
 *   the line number — that's a corrupt transcript, not a v0.2 task.
 * - Each successfully-parsed object is returned as-is. The shape is *not*
 *   validated against `RawTranscriptLine` at runtime; we trust that the
 *   file came from Claude Code itself. Downstream code should treat any
 *   field as possibly-absent and never crash on extras.
 *
 * For shape validation, run the result through `validateRawTranscript()`
 * — it's a separate step on purpose, so callers can choose strict-validate
 * vs trust-the-format depending on where the JSONL came from.
 *
 * This is the seam between "bytes on disk" and "structured data we can
 * map to office events." Keep it boring.
 */
export function parseRawTranscript(jsonl: string): RawTranscriptLine[] {
  const lines = jsonl.split("\n");
  const out: RawTranscriptLine[] = [];

  lines.forEach((raw, idx) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return;
    try {
      out.push(JSON.parse(trimmed) as RawTranscriptLine);
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      throw new Error(
        `claude-code transcript parse error at line ${idx + 1}: ${cause}`,
      );
    }
  });

  return out;
}

// ─── Validation ──────────────────────────────────────────────────────────────
//
// `parseRawTranscript()` produces typed objects but trusts the shape. For real
// transcripts (and any time a fixture is loaded from disk) we want a strict
// pre-flight check before mapping to office events. The validator below catches
// the classes of malformed input most likely to confuse the mapper:
//
//   1. Unknown `type` values (anything other than the four documented kinds).
//   2. Wrong `message.role` for user/assistant lines.
//   3. Content arrays containing block objects with unknown `type`s, or block
//      objects missing required fields (tool_use needs `id` + `name` + `input`;
//      tool_result needs `tool_use_id` + `content`; etc.).
//   4. Timestamps that don't parse as ISO 8601 (when present — they're optional
//      on the type but, if supplied, must be parseable).
//   5. `parentUuid` that's neither a string nor `null`.
//
// Like the scenario validator, this one collects issues and returns them — it
// does not throw. Callers decide whether one bad line aborts the import.

// VALID_LINE_TYPES and VALID_BLOCK_TYPES stay co-located with their type defs
// (above in this file) rather than moving to runtime-unions.ts: the union types
// live here, and importing them into runtime-unions would create a circular
// dep. The ISO 8601 check is the only piece that genuinely belonged elsewhere
// — it's now imported from runtime-unions below.

const VALID_LINE_TYPES: ReadonlySet<RawTranscriptLine["type"]> = new Set([
  "system",
  "user",
  "assistant",
  "summary",
]);

const VALID_BLOCK_TYPES: ReadonlySet<ContentBlock["type"]> = new Set([
  "text",
  "tool_use",
  "tool_result",
  "thinking",
]);

export interface RawTranscriptIssue {
  /** 1-based index into the input array — matches what a human would say. */
  lineIndex: number;
  /** Path within the offending line, e.g. "message.content[1].input". */
  field: string;
  message: string;
}

/**
 * Validate a parsed transcript line-by-line. Returns an empty array on
 * clean input; otherwise returns all the issues found (does not throw).
 *
 * The mapper from raw lines to office events should run this first and
 * refuse to map any session that has issues — better to fail loudly than
 * to produce a half-mapped office state.
 */
export function validateRawTranscript(lines: RawTranscriptLine[]): RawTranscriptIssue[] {
  const issues: RawTranscriptIssue[] = [];
  lines.forEach((line, idx) => {
    validateRawTranscriptLine(line, idx + 1, issues);
  });
  return issues;
}

/**
 * Validate one raw line. Exported for callers that want to validate a single
 * line in isolation (e.g. a streaming tail-follower in v0.3).
 */
export function validateRawTranscriptLine(
  line: unknown,
  lineIndex: number,
  issues: RawTranscriptIssue[],
): void {
  const push = (field: string, message: string) =>
    issues.push({ lineIndex, field, message });

  if (line === null || typeof line !== "object") {
    push(".", `line is not an object (got ${line === null ? "null" : typeof line})`);
    return;
  }

  const obj = line as Record<string, unknown>;
  const type = obj.type;

  if (typeof type !== "string" || !VALID_LINE_TYPES.has(type as RawTranscriptLine["type"])) {
    push("type", `unknown line.type: '${String(type)}'`);
    return;
  }

  // Common envelope fields (all optional but, if present, must have the right shape).
  if (obj.timestamp !== undefined && !isIsoTimestamp(obj.timestamp)) {
    push("timestamp", `not a valid ISO 8601 timestamp ('${String(obj.timestamp)}')`);
  }
  if (obj.parentUuid !== undefined && obj.parentUuid !== null && typeof obj.parentUuid !== "string") {
    push("parentUuid", `must be string | null (got ${typeof obj.parentUuid})`);
  }

  switch (type) {
    case "user":
      validateUserMessage(obj, push);
      break;
    case "assistant":
      validateAssistantMessage(obj, push);
      break;
    case "summary":
      if (typeof obj.summary !== "string") {
        push("summary", `summary line must have a string 'summary' field (got ${typeof obj.summary})`);
      }
      break;
    case "system":
      // System lines are intentionally permissive — they carry arbitrary metadata.
      break;
  }
}

function validateUserMessage(
  obj: Record<string, unknown>,
  push: (field: string, message: string) => void,
): void {
  const message = obj.message;
  if (message === null || typeof message !== "object") {
    push("message", `user line is missing 'message' object`);
    return;
  }
  const m = message as Record<string, unknown>;
  if (m.role !== "user") {
    push("message.role", `expected 'user', got '${String(m.role)}'`);
  }
  if (typeof m.content === "string") return;
  if (Array.isArray(m.content)) {
    m.content.forEach((block, idx) => validateContentBlock(block, `message.content[${idx}]`, push));
    return;
  }
  push("message.content", `expected string or content[], got ${typeof m.content}`);
}

function validateAssistantMessage(
  obj: Record<string, unknown>,
  push: (field: string, message: string) => void,
): void {
  const message = obj.message;
  if (message === null || typeof message !== "object") {
    push("message", `assistant line is missing 'message' object`);
    return;
  }
  const m = message as Record<string, unknown>;
  if (m.role !== "assistant") {
    push("message.role", `expected 'assistant', got '${String(m.role)}'`);
  }
  if (!Array.isArray(m.content)) {
    push("message.content", `expected array, got ${typeof m.content}`);
    return;
  }
  m.content.forEach((block, idx) => validateContentBlock(block, `message.content[${idx}]`, push));
}

function validateContentBlock(
  block: unknown,
  path: string,
  push: (field: string, message: string) => void,
): void {
  if (block === null || typeof block !== "object") {
    push(path, `content block must be an object (got ${block === null ? "null" : typeof block})`);
    return;
  }
  const b = block as Record<string, unknown>;
  const t = b.type;
  if (typeof t !== "string" || !VALID_BLOCK_TYPES.has(t as ContentBlock["type"])) {
    push(`${path}.type`, `unknown content block type: '${String(t)}'`);
    return;
  }
  switch (t) {
    case "text":
      if (typeof b.text !== "string") {
        push(`${path}.text`, `text block requires string 'text' field`);
      }
      break;
    case "tool_use":
      if (typeof b.id !== "string" || b.id.length === 0) {
        push(`${path}.id`, `tool_use requires non-empty string 'id'`);
      }
      if (typeof b.name !== "string" || b.name.length === 0) {
        push(`${path}.name`, `tool_use requires non-empty string 'name'`);
      }
      if (b.input === null || typeof b.input !== "object" || Array.isArray(b.input)) {
        push(`${path}.input`, `tool_use 'input' must be an object`);
      }
      break;
    case "tool_result":
      if (typeof b.tool_use_id !== "string" || b.tool_use_id.length === 0) {
        push(`${path}.tool_use_id`, `tool_result requires non-empty string 'tool_use_id'`);
      }
      if (typeof b.content !== "string" && !Array.isArray(b.content)) {
        push(`${path}.content`, `tool_result 'content' must be string or content[]`);
      } else if (Array.isArray(b.content)) {
        b.content.forEach((nested, idx) =>
          validateContentBlock(nested, `${path}.content[${idx}]`, push),
        );
      }
      if (b.is_error !== undefined && typeof b.is_error !== "boolean") {
        push(`${path}.is_error`, `if present, 'is_error' must be boolean`);
      }
      break;
    case "thinking":
      if (typeof b.thinking !== "string") {
        push(`${path}.thinking`, `thinking block requires string 'thinking' field`);
      }
      break;
  }
}
