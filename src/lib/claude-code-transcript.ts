import {
  KNOWN_CONTENT_BLOCK_TYPES,
  KNOWN_RAW_TRANSCRIPT_LINE_TYPES,
  isIsoTimestamp,
} from "./runtime-unions";
import type {
  ContentBlock,
  RawTranscriptLine,
} from "@/types/claude-code-transcript";

/**
 * Raw Claude Code transcript parsing.
 *
 * The type definitions for `RawTranscriptLine`, `ContentBlock`, and the
 * concrete line variants live in [`src/types/claude-code-transcript.ts`](../types/claude-code-transcript.ts) —
 * they're re-exported below for convenience. The runtime mirrors of the
 * `type` discriminator unions live in
 * [`src/lib/runtime-unions.ts`](./runtime-unions.ts).
 *
 * This module owns the *behaviour* — JSONL bytes → typed raw lines, and
 * the strict pre-mapping validator that catches malformed shape before
 * we hand a session to the mapper.
 */

// Re-export the input contract from `src/types/` so existing callers (and
// tests) that imported these from this module keep compiling unchanged.
export type {
  ContentBlock,
  RawAssistantMessage,
  RawSummaryLine,
  RawSystemMessage,
  RawTranscriptLine,
  RawUserMessage,
  TextBlock,
  ThinkingBlock,
  ToolResultBlock,
  ToolUseBlock,
} from "@/types/claude-code-transcript";

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
//
// The membership sets and ISO timestamp check all come from `runtime-unions.ts`
// so the legal-value lists can never drift between modules.

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

  if (
    typeof type !== "string" ||
    !KNOWN_RAW_TRANSCRIPT_LINE_TYPES.has(type as RawTranscriptLine["type"])
  ) {
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
    case "ai-title":
      if (typeof obj.aiTitle !== "string") {
        push("aiTitle", `ai-title line must have a string 'aiTitle' field (got ${typeof obj.aiTitle})`);
      }
      break;
    case "custom-title":
      if (typeof obj.customTitle !== "string") {
        push("customTitle", `custom-title line must have a string 'customTitle' field (got ${typeof obj.customTitle})`);
      }
      break;
    case "last-prompt":
      if (typeof obj.lastPrompt !== "string") {
        push("lastPrompt", `last-prompt line must have a string 'lastPrompt' field (got ${typeof obj.lastPrompt})`);
      }
      break;
    case "pr-link":
      if (typeof obj.prUrl !== "string") {
        push("prUrl", `pr-link line must have a string 'prUrl' field (got ${typeof obj.prUrl})`);
      }
      if (typeof obj.prRepository !== "string") {
        push("prRepository", `pr-link line must have a string 'prRepository' field (got ${typeof obj.prRepository})`);
      }
      if (typeof obj.prNumber !== "string" && typeof obj.prNumber !== "number") {
        push("prNumber", `pr-link line must have a string|number 'prNumber' field (got ${typeof obj.prNumber})`);
      }
      break;
    case "attachment":
      if (obj.attachment === undefined) {
        push("attachment", `attachment line must have an 'attachment' field`);
      }
      // Don't recurse into the attachment payload — it could be a binary blob
      // or anything tool-specific. The privacy policy is that the mapper
      // never renders attachment content; the validator just confirms the
      // field exists.
      break;
    case "queue-operation":
      if (typeof obj.operation !== "string") {
        push("operation", `queue-operation line must have a string 'operation' field (got ${typeof obj.operation})`);
      }
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
  if (typeof t !== "string" || !KNOWN_CONTENT_BLOCK_TYPES.has(t as ContentBlock["type"])) {
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
