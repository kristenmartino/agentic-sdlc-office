/**
 * Types for raw Claude Code transcript lines.
 *
 * A Claude Code session is persisted as a JSONL file under
 * `~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl`. Each line is a
 * single JSON object representing a turn in the conversation: a user
 * message, an assistant response (possibly with embedded tool calls), the
 * result of a tool call, or a system/meta event.
 *
 * These types are the input contract for the parser — the shape we expect
 * to receive on disk. The parser's job is to map these raw lines into the
 * office's `WorkflowEvent` model.
 *
 * The shapes here are intentionally loose: real transcripts include fields
 * we don't yet model, and Claude Code's storage format can evolve. Treat
 * unknown fields as additive — never throw on extras, only validate the
 * fields we actually read.
 *
 * These types live under `src/types/` rather than co-located with the
 * parser in `src/lib/claude-code-transcript.ts` so that
 * `src/lib/runtime-unions.ts` can import the discriminator literals
 * without creating a circular dependency.
 *
 * Source of truth: these types reflect the JSONL shape as observed in
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
