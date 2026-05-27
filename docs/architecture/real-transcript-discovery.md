# Real transcript discovery — format compatibility notes

A docs-only check of how the v0.2 parser/validator/mapper hold up against a real Claude Code session, captured live from `~/.claude/projects/`. No session content is committed; this doc records *shape* only.

The synthetic fixture at [`src/data/claude-code-transcript-sample.jsonl`](../../src/data/claude-code-transcript-sample.jsonl) covered exactly 4 line types and ~6 fields per line. A real session has 9 line types, 3 system subtypes, 20+ envelope fields, and a separate top-level `toolUseResult` block we don't model at all. This doc lists every gap so the next mapper iteration can close them in priority order.

## Methodology

1. Located the active session for this project at `~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl`.
2. Ran `jq` over the file to extract *structure only* — `keys[]`, `.type`, `.subtype`, etc. — never the actual content of any message.
3. Compared the observed shape against the types in [`src/types/claude-code-transcript.ts`](../../src/types/claude-code-transcript.ts).
4. Compared coverage against the mapper rules in [`src/lib/claude-code-transcript-mapper.ts`](../../src/lib/claude-code-transcript-mapper.ts).
5. Nothing from the real transcript is reproduced verbatim below. Counts and field names are not PII; the doc deliberately omits any prompts, paths, code, command arguments, or tool outputs.

## Summary

| Surface | Synthetic fixture covers | Real session also has | Gap severity |
| --- | --- | --- | --- |
| Line types | `system`, `user`, `assistant`, `summary` | `ai-title`, `last-prompt`, `custom-title`, `pr-link`, `attachment`, `queue-operation` | **High** — validator currently rejects all 6 as `unknown line.type` |
| System subtypes | `init` | `stop_hook_summary`, `compact_boundary`, `api_error` (no `init` observed in real sessions in this sample) | **Medium** — currently permissive (system lines accept anything) but the mapper looks for `init` specifically |
| Envelope fields | `uuid`, `parentUuid`, `sessionId`, `timestamp`, `cwd`, `version` | adds `userType`, `isSidechain`, `gitBranch`, `entrypoint`, `permissionMode`, `requestId`, `promptId` | **Low** — extras are tolerated; could be useful for filtering noise |
| Tool result data | `tool_result.content` (string) | also `toolUseResult` (sibling field, *richer*: stdout/stderr/structuredPatch/etc.) | **High** — mapper ignores the structured field, losing the precise data it'd need for richer artifacts |
| Tool kinds the mapper recognises | Read/Glob/Grep, Edit/Write/MultiEdit, Bash | 14 unique tools observed; ~half are MCP (`mcp__*`) or Task/TaskCreate/TaskUpdate/AskUserQuestion/ToolSearch | **Medium** — unknown tools are log-only, so nothing breaks, but the activity log misses 60%+ of what really happened |
| `thinking` blocks | dropped silently | 357 in the sampled session | **Policy is correct** (no UI exposure) — but mapper currently emits no signal at all, even though `thinking` is a real, frequent event |
| `is_error: true` | quality_gate.failed | only 39 of 1187 tool_results have `is_error: true` in real sessions | **High** — most failures don't set `is_error`. Failure detection in the mapper is too narrow |
| Compaction | not modeled | `system.subtype: "compact_boundary"` fires once per session compaction | **Medium** — a compacted run effectively starts over; the mapper should at least emit a marker event |

## New line types found in real sessions

The validator currently rejects all six as `unknown line.type`. **Recommendation**: add them to `RawTranscriptLine` (and `KNOWN_RAW_TRANSCRIPT_LINE_TYPES`), then decide per type whether the mapper acts on them or treats them as log-only.

| Type | Keys observed | Meaning | Mapper action recommended |
| --- | --- | --- | --- |
| `ai-title` | `type`, `aiTitle`, `sessionId` | Auto-generated session title | Use as `workItem.title` fallback when no string user prompt exists |
| `last-prompt` | `type`, `lastPrompt`, `leafUuid`, `sessionId` | Pointer to the last user prompt UUID | Log-only (useful for navigation) |
| `custom-title` | `type`, `customTitle`, `sessionId` | User-supplied session title | Use as `workItem.title` if present (overrides `ai-title`) |
| `pr-link` | `type`, `prNumber`, `prUrl`, `prRepository`, `timestamp`, `sessionId` | Records that the session opened a PR | Emit `artifact.produced` (kind: `code_pr`, ref: prUrl) |
| `attachment` | `type`, `attachment`, `uuid`, `parentUuid`, … standard envelope | User attached a file mid-session | Log-only for v0.2; future: surface as artifact context |
| `queue-operation` | `type`, `operation`, `timestamp`, `sessionId`, `content` | Internal queue state (model swap, etc.) | Log-only |

## System subtypes found in real sessions

The validator is permissive on system lines today — they pass. The mapper currently only looks for `subtype === "init"`, and **the real session has no `init` line at all**. Origin info must be inferred from the first line with a `sessionId` and `timestamp` (which the mapper already does as a fallback).

| Subtype | Frequency | Keys observed | Recommended handling |
| --- | --- | --- | --- |
| `stop_hook_summary` | 31× | `hookCount`, `hookInfos`, `hookErrors`, `preventedContinuation`, `stopReason`, `hasOutput`, `level`, `toolUseID` | Useful signal — `hookErrors.length > 0` could map to `blocker.raised`; `preventedContinuation` could map to `quality_gate.failed` |
| `compact_boundary` | 1× | (standard envelope only) | Mapper should emit a marker event (e.g. an `agent.message.sent` summarising "conversation compacted at this point") |
| `api_error` | 1× | (standard envelope; `content` likely carries the error text) | Emit `blocker.raised` or `quality_gate.failed` depending on tone |

## Tool inventory

14 distinct tools invoked in this real session. The mapper only routes 3 categories — Read/Glob/Grep, Edit/Write/MultiEdit, Bash — explicitly. Everything else lands in the "log-only" bucket and produces no office event.

| Tool | Count | Mapper status |
| --- | --- | --- |
| `Bash` | 292 | ✅ handled (test-command detection + result) |
| `mcp__Claude_in_Chrome__computer` | 234 | ❌ log-only (MCP browser actions — high-signal, currently invisible) |
| `Write` | 210 | ✅ handled (artifact.produced) |
| `Edit` | 143 | ✅ handled (artifact.produced) |
| `Read` | 95 | ✅ handled (status → reading) |
| `TaskUpdate` | 83 | ❌ log-only (task state — could map to internal workflow events) |
| `mcp__Claude_in_Chrome__find` | 60 | ❌ log-only |
| `TaskCreate` | 41 | ❌ log-only (could map to `work_item.created` or related work item) |
| `AskUserQuestion` | 10 | ❌ log-only (this is the closest thing to `decision.requested` in real Claude Code — but observed mode forbids decisions, so it must be log-only) |
| `mcp__Claude_in_Chrome__browser_batch` | 7 | ❌ log-only |
| `mcp__Claude_in_Chrome__list_connected_browsers` | 4 | ❌ log-only |
| `ToolSearch` | 4 | ❌ log-only (deferred-tool loading — invisible to mapper) |
| `mcp__Claude_in_Chrome__navigate` | 3 | ❌ log-only |
| `mcp__Claude_in_Chrome__tabs_context_mcp` | 2 | ❌ log-only |

`Grep`, `Glob`, `MultiEdit` did not appear in this session, so my synthetic fixture's coverage of those is unproven against reality.

### `tool_use` block shape

Real shape: `{ type, id, name, input, caller }`. The `caller` field is **not modeled** in `ToolUseBlock`. Looks like an attribution string (e.g. which sub-flow inside Claude Code initiated the tool call). Type addition recommended.

### `tool_result` block + sibling `toolUseResult` field

Inside the user message's content array: `{ type: "tool_result", content, tool_use_id }`. Matches the existing type.

**But** the real transcript also stores a separate top-level field `toolUseResult` on the same user line — this carries the *structured* tool output (per-tool shape):

| Tool | `toolUseResult` shape |
| --- | --- |
| Edit / Write | `{ filePath, oldString, newString, originalFile, structuredPatch, userModified, replaceAll }` |
| Bash | `{ stdout, stderr, interrupted, isImage, noOutputExpected, backgroundTaskId, assistantAutoBackgrounded }` |
| ToolSearch | `{ matches, query, total_deferred_tools }` |
| AskUserQuestion | `{ questions, answers }` |
| TaskUpdate | `{ success, taskId, updatedFields, statusChange }` |
| TaskCreate | `{ task }` |

The mapper currently looks only at `tool_result.content` (the string the model sees). The richer `toolUseResult` data is *right there* and would let us:
- Produce artifacts with `structuredPatch` instead of just "Edit on Button.tsx"
- Detect Bash failures via non-zero stderr or non-empty `interrupted`, not just `is_error`
- Stream more useful summaries

**Recommendation**: extend `RawUserMessage` (or add a sibling `RawToolResultLine`) to carry `toolUseResult`. The mapper should prefer the structured field when present.

## Mapper coverage gaps

| Gap | Today | Impact |
| --- | --- | --- |
| Most failures don't set `is_error: true` | Mapper emits `quality_gate.failed` only on `is_error: true` (39 of 1187 results). | Real failed Bash commands (non-zero exit, stderr content) won't be detected. Need to inspect `toolUseResult.stderr` and `interrupted`. |
| MCP tool calls invisible | All `mcp__*` tools are log-only. | This session ran 311+ MCP browser actions — the office view would be near-empty. |
| Subagent calls | The transcript shows `Task` (also called `Agent` in some versions) as a tool; the inner subagent activity lives elsewhere. | The mapper sees a single tool_use; the nested subagent's tool calls aren't surfaced. Subagent expansion is a separate v0.3 task. |
| Compaction | Not modeled at all. | A compacted session is functionally two runs glued together; the mapper produces one run with a hidden discontinuity. |
| `AskUserQuestion` | Log-only — correct for observer mode (read-only validator forbids `decision.requested`). | Compliance is fine; the activity-log signal is missing. Future: `agent.message.sent` summarising the question + answer. |
| `TaskCreate` / `TaskUpdate` | Log-only. | The model's internal task tracking is invisible — could be mapped to a parallel work-item stream in v0.3. |
| `thinking` blocks | Dropped per policy. | Correct, but mapper could emit a neutral signal ("agent paused to think") for activity-log visibility without exposing content. |
| Multi-agent / single-default | Hardcoded to Mira. | A session that's mostly Read + AskUserQuestion looks more like Nova than Mira. Tool-pattern heuristics deferred. |

## Privacy-leak redaction checklist

If you ever want to commit a real anonymized transcript as a fixture, redact **every** instance of the following before adding the file. Real Claude Code transcripts mix personal/project data throughout user messages, assistant text, tool inputs, tool results, and MCP attributions.

| Category | Field(s) | Reduce / replace with |
| --- | --- | --- |
| **Usernames** | `cwd` values everywhere; file paths inside `tool_use.input.file_path`, `toolUseResult.filePath`, Bash commands; system `entrypoint` | `/Users/example/<project>` |
| **Session identifiers** | `sessionId`, `uuid`, `parentUuid`, `leafUuid`, `toolUseID`, `sourceToolAssistantUUID`, `requestId`, `promptId`, `id` (inside content blocks) | Synthetic IDs (`sample-session-0000`, `u-0001`, etc.) |
| **Git context** | `gitBranch`, anything in Bash commands that names branches | `main` |
| **GitHub** | `prUrl`, `prRepository`, `prNumber`, anything pasted into messages | `https://github.com/example/repo`, `1` |
| **User prompts** | `message.content` on user lines (string form); `lastPrompt` on `last-prompt` lines | Generic placeholder text |
| **Assistant text** | `message.content[].text` on assistant lines | Generic placeholder text |
| **Tool inputs** | `tool_use.input` — file paths, code snippets, commands, queries, URLs | Synthetic paths/commands matching the *shape* you want to test |
| **Tool results** | `tool_result.content`; `toolUseResult.stdout`/`stderr`/`originalFile`/`oldString`/`newString`/`structuredPatch` | Truncated synthetic strings |
| **Attribution** | `attributionMcpTool`, `attributionMcpServer`, `caller` | Either remove or replace with synthetic values |
| **AI titles** | `aiTitle`, `customTitle`, `summary` on summary lines | Synthetic title |
| **Hook output** | `hookInfos`, `hookErrors` in `stop_hook_summary` system lines | Remove or stub |
| **Attachments** | `attachment` payloads on `attachment` lines | Remove entirely (could be images, files, etc.) |
| **Queue ops** | `content` on `queue-operation` lines | Remove entirely |
| **Timestamps** | Any precise timestamp that could correlate with calendar activity | Anchor to a synthetic base time (e.g. `2026-05-27T15:00:00Z` + sequential offsets) |

After redaction, run the file through `parseRawTranscript()` and `validateRawTranscript()` to confirm shape integrity, then `parseClaudeCodeTranscript()` to confirm it maps to a valid observed scenario.

## Field-by-field diff vs synthetic fixture

Envelope fields present on **every** non-meta line in real transcripts but missing from the synthetic fixture (and from `RawTranscriptLineBase`):

| Field | Type | Frequency | Notes |
| --- | --- | --- | --- |
| `userType` | `"external" \| "none"` | 4256/4256 | Likely distinguishes user-typed input from internal echoes; would help the mapper skip system-generated user messages |
| `isSidechain` | `boolean` | 4256/4256 | All `false` in this session — but if subagents become first-class, sidechain lines mark nested conversations |
| `gitBranch` | string | 3188/4256 | Useful future signal — could populate `workItem.branch` |
| `entrypoint` | string | 3188/4256 | How the session started (CLI flag, IDE integration, etc.) |
| `permissionMode` | string | 33/4256 | Records P0-P7-style permission state at user turns |
| `requestId` | string | 1791/4256 | Anthropic API request id on assistant lines |
| `promptId` | string | 1220/4256 | Per-user-prompt id |

Top-level fields seen on certain assistant/user lines but not on synthetic:

| Field | Source | Notes |
| --- | --- | --- |
| `toolUseResult` | user lines with tool_results | The structured-data sibling discussed above. Mapper should consume this. |
| `sourceToolAssistantUUID` | user lines with tool_results | Pointer back to the originating assistant turn |
| `attributionMcpTool` / `attributionMcpServer` | assistant lines with MCP tool_use | Identifies which MCP server's tool was invoked |
| `slug` | various | Internal categorisation tag |
| `diagnostics` | assistant `message` object | Model diagnostics (likely usage/timing) |
| `usage` | assistant `message` object | Token usage |
| `stop_details` | assistant `message` object | Extended stop reason metadata |

Assistant `message` object fields beyond what the synthetic includes: `id`, `stop_sequence`, `stop_details`, `usage`, `diagnostics`. None are required for the mapper today; informational.

## Status compared to the synthetic fixture

| Capability | Synthetic fixture proves | Real transcript reveals |
| --- | --- | --- |
| JSONL parsing | ✅ | ✅ — `parseRawTranscript()` handles the real file (modulo the new line types failing validation) |
| Line-type validation | ✅ for 4 types | ⚠️ rejects 6 real types as unknown |
| Content-block validation | ✅ for text/tool_use/tool_result/thinking | ✅ no new block types observed |
| `tool_use` shape | ✅ | ⚠️ missing `caller` field on type |
| `tool_result` shape | ✅ | ✅ |
| Origin from `system.init` | ✅ | ⚠️ no `init` line in real session — mapper falls back to first-timestamped line (already in place) |
| Quality-gate detection | ✅ on `is_error: true` | ⚠️ misses most real failures (need `toolUseResult.stderr` + `interrupted`) |
| Edit-based artifacts | ✅ | ⚠️ uses thin string content; structured `oldString`/`newString`/`structuredPatch` available |
| Default agent (Mira) | ✅ for coding-heavy sessions | ⚠️ this session ran heavy MCP + AskUserQuestion + Task — Nova/Cora might fit better |
| Thinking-block policy | ✅ dropped silently | ✅ confirmed — 357 thinking blocks dropped, none surfaced |

## Recommendations for the next mapper iteration

In rough priority order (high → low):

1. **Add the 6 new line types** to the type union + `KNOWN_RAW_TRANSCRIPT_LINE_TYPES` so the validator stops rejecting real sessions outright.
2. **Consume `toolUseResult`** instead of (or alongside) `tool_result.content`. Specifically: detect Bash failures via stderr + interrupted, populate richer artifact metadata from `structuredPatch`.
3. **Add `compact_boundary` handling** — emit a visible marker event when the conversation was compacted.
4. **Add `stop_hook_summary` handling** — when `hookErrors.length > 0`, emit `blocker.raised`; when `preventedContinuation: true`, emit `quality_gate.failed`.
5. **Add a simple tool-pattern heuristic** for the default office agent (Read-heavy → Nova; AskUserQuestion-heavy → Cora; Edit-heavy → Mira; Bash-test-heavy → Tess).
6. **Handle `pr-link`** — emit `artifact.produced` (kind `code_pr`) so the activity log notes the PR was opened.
7. **Decide a policy for MCP tools.** They're ~30% of tool calls in real sessions. Options:
   - Treat all `mcp__*` as a single "external integration" category that emits a generic `agent.message.sent` summary.
   - Maintain an allow-list for specific MCP servers worth surfacing (chrome browser actions for UX testing, etc.).
8. **Add `caller` to `ToolUseBlock`** so attribution-aware mappings become possible in v0.3.

## What this PR doesn't do

- No real transcript file is committed — see the privacy stance in [`docs/architecture/claude-code-transcript-format.md`](claude-code-transcript-format.md).
- No code changes. This is a docs-only discovery PR.
- No mapper updates yet — those land in the next PR, prioritised against the recommendation list above.
- No live tailing, file picker, or upload surface.

## Status

- ✅ Synthetic fixture proves the parser/validator/mapper round-trip end-to-end.
- ✅ **Real session shape accepts** (PR #45) — the 6 new line types and the additive envelope fields are typed and validated.
- ✅ **`toolUseResult` consumed** (PR #46) — Bash failure detection now reads `stderr`/`interrupted`; Edit/Write/MultiEdit artifacts emit at tool_result time using `toolUseResult.filePath` and `structuredPatch` hunk counts (no raw oldString/newString rendered).
- ✅ **`pr-link` → `artifact.produced`** (PR #46) — sessions that opened a PR now surface that PR in the activity log.
- ✅ **Title hierarchy** (PR #46) — `custom-title` > first user prompt > `ai-title` > default placeholder.
- ✅ **Redaction + log-only visibility** (PR #47):
  - Bash failure notes now go through `sanitizeForNotes()` — home paths and GitHub URLs redacted, first line only, 120-char truncation.
  - MCP tools / Task / TaskCreate / TaskUpdate / AskUserQuestion all emit safe category summaries, never raw input.
  - `compact_boundary` emits a marker `agent.message.sent`.
  - `api_error` and `stop_hook_summary` with `hookErrors` or `preventedContinuation: true` emit `blocker.raised`.
- ⏳ Next: real anonymized fixture committed to the repo, then local-file-loader UI.
