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
 * Claude Code today. The current set was validated against a real local
 * session (see [`docs/architecture/real-transcript-discovery.md`]). When
 * Anthropic publishes a formal schema, this file should be updated to
 * match.
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
  /**
   * Attribution string indicating which Claude Code sub-flow initiated the
   * tool call. Real transcripts populate this; optional on the type because
   * older sessions may omit it.
   */
  caller?: string;
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
  /** Whether the input was supplied by the human (`"external"`) or internal. */
  userType?: string;
  /** True when the line is part of a nested subagent conversation. */
  isSidechain?: boolean;
  /** Git branch at the time of the turn — useful for `WorkItem.branch`. */
  gitBranch?: string;
  /** How the session was launched (CLI flag, IDE integration, etc.). */
  entrypoint?: string;
}

export interface RawUserMessage extends RawTranscriptLineBase {
  type: "user";
  /** Per-user-prompt id Claude Code uses internally. */
  promptId?: string;
  /** Permission mode in effect when the user submitted (e.g. `"acceptEdits"`). */
  permissionMode?: string;
  message: {
    role: "user";
    /** Short prompts are plain strings; tool results arrive as content arrays. */
    content: string | ContentBlock[];
  };
  /**
   * Structured sibling of `message.content`, populated when the user line
   * carries a tool_result. Real transcripts use this to carry rich,
   * per-tool data (Bash stdout/stderr/interrupted, Edit oldString/newString/
   * structuredPatch, etc.) that the model sees only as the string in
   * `tool_result.content`. The mapper can consume this for richer events
   * (PR #46 territory). Kept as `unknown` for now because the shape is
   * tool-specific.
   */
  toolUseResult?: unknown;
  /** Points back to the assistant turn whose tool_use this line answers. */
  sourceToolAssistantUUID?: string;
}

export interface RawAssistantMessage extends RawTranscriptLineBase {
  type: "assistant";
  /** Anthropic API request id. */
  requestId?: string;
  /** MCP attribution — server name when the tool_use originated via MCP. */
  attributionMcpServer?: string;
  /** MCP attribution — tool name when the tool_use originated via MCP. */
  attributionMcpTool?: string;
  message: {
    role: "assistant";
    content: ContentBlock[];
    /** Anthropic model id, e.g. "claude-opus-4-7". */
    model?: string;
    stop_reason?: string | null;
    /** Additional fields seen on real sessions; kept as unknown until needed. */
    id?: string;
    type?: string;
    stop_sequence?: unknown;
    stop_details?: unknown;
    usage?: unknown;
    diagnostics?: unknown;
  };
}

export interface RawSystemMessage extends RawTranscriptLineBase {
  type: "system";
  /**
   * Real sessions show `stop_hook_summary`, `compact_boundary`, `api_error`;
   * the original spike fixture used `init`. The validator stays permissive
   * here — system lines carry arbitrary metadata.
   */
  subtype?: string;
  [key: string]: unknown;
}

export interface RawSummaryLine extends RawTranscriptLineBase {
  type: "summary";
  /** Auto-generated session summary; populated retroactively. */
  summary: string;
}

// ─── Lines added after real-transcript discovery (PR #44) ────────────────────
//
// These six types appear in real Claude Code sessions but weren't in the
// original spike fixture. They're modeled here so the validator stops
// rejecting them outright; mapping behavior for them is conservative
// (mostly log-only — see the mapper for details).

// All extend RawTranscriptLineBase so the common envelope fields (uuid,
// timestamp, sessionId, etc.) are typed consistently. Real transcripts may
// omit envelope fields on meta lines like `ai-title` / `custom-title` —
// they're optional on the base, so absence is fine.

/** Auto-generated session title; sometimes the only source of a title. */
export interface RawAiTitleLine extends RawTranscriptLineBase {
  type: "ai-title";
  aiTitle: string;
}

/** User-supplied session title override; takes precedence over `ai-title`. */
export interface RawCustomTitleLine extends RawTranscriptLineBase {
  type: "custom-title";
  customTitle: string;
}

/** Pointer to the UUID of the last user prompt. Useful for nav, not mapping. */
export interface RawLastPromptLine extends RawTranscriptLineBase {
  type: "last-prompt";
  lastPrompt: string;
  leafUuid?: string;
}

/** Records that the session opened a PR. */
export interface RawPrLinkLine extends RawTranscriptLineBase {
  type: "pr-link";
  prNumber: number | string;
  prUrl: string;
  prRepository: string;
}

/**
 * User attached a file mid-session. Mapper does not render attachment content
 * by default — see the privacy stance in `claude-code-transcript-format.md`.
 */
export interface RawAttachmentLine extends RawTranscriptLineBase {
  type: "attachment";
  attachment: unknown;
}

/** Internal queue state (model swap, retry, compaction trigger, etc.). */
export interface RawQueueOperationLine extends RawTranscriptLineBase {
  type: "queue-operation";
  operation: string;
  content?: unknown;
}

export type RawTranscriptLine =
  | RawUserMessage
  | RawAssistantMessage
  | RawSystemMessage
  | RawSummaryLine
  | RawAiTitleLine
  | RawCustomTitleLine
  | RawLastPromptLine
  | RawPrLinkLine
  | RawAttachmentLine
  | RawQueueOperationLine;
