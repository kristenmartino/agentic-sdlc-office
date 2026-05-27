# Claude Code transcript format — discovery notes

What v0.2 needs to know about the JSONL files Claude Code writes locally,
so the office can render real sessions instead of scripted scenarios. This
doc is a v0.1 spike snapshot, not a formal schema — when Anthropic
publishes an official transcript spec, this file should be replaced.

> **Reality check against a real session:** see
> [`real-transcript-discovery.md`](real-transcript-discovery.md) for the
> field-by-field diff between this doc's assumptions and what an actual
> Claude Code transcript on disk contains. Several line types and a
> structured `toolUseResult` field were missed in the initial pass.

## Where it lives

Claude Code persists each session as a JSONL file under:

```
~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl
```

- `<encoded-cwd>` is the working directory of the session with separators
  replaced (e.g. `/Users/example/agentic-sdlc-office` →
  `-Users-example-agentic-sdlc-office`).
- `<session-uuid>` is a stable identifier shared by every line in the file.
- One JSON object per line. A trailing newline is normal.

The v0.2 reader only needs read access to a single file. It does not need
to tail-follow, watch for new sessions, or write back.

## Line shape (observed, not contracted)

Every line has a `type` field. The discriminator splits four categories:

| `type` | Purpose |
| --- | --- |
| `"system"` | Session-meta: init, tool registration, context lines |
| `"user"` | Either a real user prompt or a tool result from a previous assistant turn |
| `"assistant"` | A Claude turn — one or more content blocks |
| `"summary"` | Auto-generated session summary, written retroactively |

Common envelope fields on most lines:

```ts
{
  uuid?: string;          // stable id for this line
  parentUuid?: string;    // null for the first user turn
  sessionId?: string;     // matches the file name
  timestamp?: string;     // ISO 8601
  cwd?: string;           // working directory at the turn
  version?: string;       // Claude Code version
}
```

Concrete shapes live in [`src/lib/claude-code-transcript.ts`](../../src/lib/claude-code-transcript.ts).

## User lines

A user line carries either a plain-string prompt or a content array
containing `tool_result` blocks (the responses to prior `tool_use` calls).

```jsonc
// Real prompt
{
  "type": "user",
  "message": {"role": "user", "content": "Refactor the primary button to use design tokens."}
}

// Tool result delivered back to the model
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {"type": "tool_result", "tool_use_id": "toolu_01...", "content": "..."}
    ]
  }
}
```

The office's parser will treat the first real-prompt line as
`work_item.created`. Tool-result lines map to no office event by themselves
— they're acknowledgements that close out a prior `tool_use`.

## Assistant lines

An assistant line contains one or more content blocks:

- `text` — natural-language output from Claude
- `tool_use` — a tool the model wants to invoke
- `thinking` — extended reasoning blocks (present when thinking is enabled). Treated as internal reasoning; the office does not render these to users.

```jsonc
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "model": "claude-opus-4-7",
    "content": [
      {"type": "text", "text": "Reading the file..."},
      {"type": "tool_use", "id": "toolu_01...", "name": "Read", "input": {"file_path": "..."}}
    ]
  }
}
```

Mapping to office events (as of PR #24 / v0.2):

| Block | Trigger | Office event |
| --- | --- | --- |
| `text` | assistant turn | `agent.message.sent` (actor = the office agent representing this session) |
| `tool_use` (Read/Glob/Grep) | assistant turn | `agent.status.changed → reading` |
| `tool_use` (Edit/Write/MultiEdit) | assistant turn | `agent.status.changed → coding`; **artifact emitted on the matching tool_result**, using `toolUseResult.filePath` as the ref when available |
| `tool_use` (Bash with run) | assistant turn | `agent.message.sent` with `$ <command>`; status → `testing` if the command matches test/build/typecheck patterns |
| `tool_result` (Bash) | user turn | `quality_gate.passed` for clean test/build success; `quality_gate.failed` on `is_error: true`, `toolUseResult.interrupted: true`, or stderr matching hard-failure language (`error`/`failed`/`fatal`/`FAIL`/etc.) — status → `failed` on any of those |
| `tool_result` (Edit/Write/MultiEdit) | user turn | `artifact.produced` (kind `code_pr`); summary uses `structuredPatch` hunk count and `replaceAll` flag without exposing raw content |
| `thinking` | anywhere | **ignored / redacted by default.** The office never displays raw thinking content. If a future feature needs to surface rationale, generate a short summary separately — never pass the raw `thinking` field through to a rendered surface. |
| anything else | — | log-only / informational |

Per-line-type table (the 6 line types added after the real-transcript discovery):

| `type` | Mapping |
| --- | --- |
| `ai-title` | Used in title hierarchy as a fallback (no user prompt, no custom-title) |
| `custom-title` | Overrides every other title source |
| `pr-link` | `artifact.produced` (kind `code_pr`, ref = `prUrl`, summary names the PR number + repo) |
| `last-prompt` | log-only — UUID pointer, no rendered output |
| `attachment` | log-only — attachment payload is opaque, never rendered |
| `queue-operation` | log-only — internal queue state |

**Title hierarchy:** `custom-title` > first user string prompt > `ai-title` > `"Observed Claude Code session"` placeholder.

System subtypes:

| `subtype` | Mapping |
| --- | --- |
| `init` | Seeds origin (sessionId, capturedAt); used by `newContext()` |
| `compact_boundary` | `agent.message.sent` marker ("Conversation compacted") so the activity-log seam is visible |
| `api_error` | `blocker.raised` (kind: `external`) — only if the work item is seeded |
| `stop_hook_summary` with `hookErrors.length > 0` | `blocker.raised` (kind: `external`) |
| `stop_hook_summary` with `preventedContinuation: true` | `blocker.raised` (kind: `gate_failed`) |
| `stop_hook_summary` with neither | log-only (no event) |

High-signal tool mappings (beyond Read/Edit/Bash):

| Tool | Mapping |
| --- | --- |
| `mcp__<server>__<tool>` | `agent.message.sent` ("MCP action via `<server>`") — input/output never rendered |
| `Task` / `TaskCreate` / `TaskUpdate` | `agent.message.sent` ("<tool> observed (task state change)") — payload never rendered |
| `AskUserQuestion` | `agent.message.sent` ("Asked the human a question (observed; not surfaced as a decision)") — **never `decision.requested`** because observed mode is read-only; question content never rendered |
| Other / unknown tools (WebFetch, ToolSearch, etc.) | log-only — the model's text block already summarises what happened |

## System lines

System lines carry session-meta. Concrete shapes vary; the only field the
office reliably uses today is `sessionId`. Treat anything else as additive
metadata — never throw on extras.

## Summary lines

Summary lines are auto-generated and written retroactively. They're useful
for picking a short session title without re-reading the whole transcript.
Not required for v0.2 ingestion to work.

## What can't be done from the transcript alone

A few things the office model wants live outside the transcript:

- **Hook output** (`PreToolUse` / `PostToolUse`). Lives in
  `~/.claude/logs/` or in the hook implementations themselves. v0.2 may
  ingest this as a second stream.
- **PR/branch state**. Reading the transcript can show that the assistant
  ran `git commit` / `gh pr create`, but live PR status is a GitHub API
  fetch. v0.3 territory.
- **Multiple acting personas**. Subagents (e.g. the `Agent` tool) show up
  as tool_use blocks; the parser will need to recursively expand them
  before assigning to office agents.

## Privacy stance

- The discovery spike is fixture-only — see
  [`src/data/claude-code-transcript-sample.jsonl`](../../src/data/claude-code-transcript-sample.jsonl).
  Content is hand-authored, no real user prompts or file paths from any
  actual session.
- When v0.2 wires in real transcript reading, the office reads from a path
  the user explicitly points at. No directory scanning, no auto-discovery.
- Nothing observed is exfiltrated. Observed mode is read-only by validator
  contract; the parser is read-only by design.
- **`thinking` blocks never reach the UI.** Raw model reasoning is internal
  state, not something to render. The mapper drops `thinking` blocks; if a
  future feature needs to surface rationale, it generates a short summary
  separately rather than passing the raw `thinking` field through to a rendered surface.
- **Bash stderr is sanitised before display.** `quality_gate.failed.notes`
  is filtered through [`sanitizeForNotes()`](../../src/lib/redact.ts), which
  redacts `/Users/<name>` and `/home/<name>` paths to `/<HOME>/`, redacts
  GitHub URLs to `https://github.com/<org>/<repo>/...`, takes only the first
  line, and truncates to 120 chars. The `interrupted: true` case bypasses
  stderr entirely with a fixed label.
- **Tool inputs are never rendered** for MCP, Task, TaskCreate, TaskUpdate,
  AskUserQuestion. The mapper emits a category summary; the actual input
  payload (page selectors, task descriptions, question text, options) stays
  out of office events.
- **Attachment payloads are opaque** to the validator and the mapper —
  no part of an attachment ever reaches a rendered surface.

## Status

- ✅ Format documented above.
- ✅ Raw-line parser at [`parseRawTranscript()`](../../src/lib/claude-code-transcript.ts) — JSONL → typed lines. Defensive against unknown fields.
- ✅ Synthetic fixture covering one tool-using session.
- ✅ Strict shape validator at [`validateRawTranscript()`](../../src/lib/claude-code-transcript.ts) — catches unknown `type`, wrong `message.role`, unknown content block kinds, malformed `tool_use`/`tool_result`, non-ISO timestamps. Returns issues, doesn't throw.
- ✅ Mapping from raw lines to `WorkflowEvent[]` at [`mapTranscriptToSession()`](../../src/lib/claude-code-transcript-mapper.ts) — implements the table above. [`parseClaudeCodeTranscript()`](../../src/lib/claude-code-parser.ts) is the public entry point: it parses, validates (fails loudly on issues), and maps in one call.
- ⏳ App-level wiring (a "Load session from disk" affordance). Not started.
- ⏳ Real anonymized transcript fixture (replace the hand-authored one with a redacted real session). Next PR's scope.
