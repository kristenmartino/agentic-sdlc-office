import type { AgentId } from "@/types/agents";
import type {
  ContentBlock,
  RawAiTitleLine,
  RawAssistantMessage,
  RawCustomTitleLine,
  RawPrLinkLine,
  RawSummaryLine,
  RawSystemMessage,
  RawTranscriptLine,
  RawUserMessage,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
} from "@/types/claude-code-transcript";
import type { Artifact, WorkItem } from "@/types/work-items";
import type { Blocker, QualityGate } from "@/types/governance";
import type { WorkflowEvent } from "@/types/workflow-events";
import type { ParsedClaudeCodeSession } from "./claude-code-parser";
import { safeBashCommandLabel, sanitizeForNotes } from "./redact";

/**
 * Narrowing helpers for the unknown `toolUseResult` sibling field that real
 * Claude Code transcripts attach to user lines carrying tool_results. Each
 * helper picks only the fields we actually need; nothing here exposes
 * `oldString` / `newString` / `originalFile` / `structuredPatch` raw content
 * to a renderable surface — they're inspected only for derived metadata
 * (line counts, success/failure heuristics).
 */

interface BashLikeToolUseResult {
  stdout?: string;
  stderr?: string;
  interrupted?: boolean;
  noOutputExpected?: boolean;
}

interface EditLikeToolUseResult {
  filePath?: string;
  oldString?: string;
  newString?: string;
  structuredPatch?: unknown;
  userModified?: boolean;
  replaceAll?: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asBashToolUseResult(value: unknown): BashLikeToolUseResult | undefined {
  if (!isObject(value)) return undefined;
  // Heuristic: it's "Bash-shaped" if any of these telltale fields exist.
  if (!("stdout" in value) && !("stderr" in value) && !("interrupted" in value)) {
    return undefined;
  }
  const v = value;
  return {
    stdout: typeof v.stdout === "string" ? v.stdout : undefined,
    stderr: typeof v.stderr === "string" ? v.stderr : undefined,
    interrupted: typeof v.interrupted === "boolean" ? v.interrupted : undefined,
    noOutputExpected: typeof v.noOutputExpected === "boolean" ? v.noOutputExpected : undefined,
  };
}

function asEditToolUseResult(value: unknown): EditLikeToolUseResult | undefined {
  if (!isObject(value)) return undefined;
  if (!("filePath" in value) && !("structuredPatch" in value)) return undefined;
  const v = value;
  return {
    filePath: typeof v.filePath === "string" ? v.filePath : undefined,
    // We deliberately don't surface oldString/newString/originalFile content;
    // structuredPatch is kept opaque (used only for line-count heuristics).
    structuredPatch: v.structuredPatch,
    userModified: typeof v.userModified === "boolean" ? v.userModified : undefined,
    replaceAll: typeof v.replaceAll === "boolean" ? v.replaceAll : undefined,
  };
}

/**
 * Count changed hunks in a structured patch without exposing content. Returns
 * `undefined` if the shape doesn't match what we expect (different versions
 * of Claude Code may use different patch shapes).
 */
function countPatchHunks(structuredPatch: unknown): number | undefined {
  if (!Array.isArray(structuredPatch)) return undefined;
  return structuredPatch.length;
}

/**
 * Map a parsed Claude Code transcript into a `ParsedClaudeCodeSession`.
 *
 * This is the v0.2 mapper. Input: typed raw transcript lines (already
 * validated). Output: a session that drops straight into the scenario
 * registry — no further transformation needed.
 *
 * Mapping rules:
 *
 *   - First `system` line: seeds origin (sessionId, capturedAt).
 *   - First user `string` content: becomes `work_item.created` (title is the
 *     prompt, truncated for display), then `work_item.owner.changed → mira`
 *     and `work_item.mode.changed → Generate`.
 *   - Assistant `text` blocks: `agent.message.sent` (actor: mira).
 *   - Assistant `tool_use`:
 *     - `Read`/`Glob`/`Grep` → `agent.status.changed → reading`.
 *     - `Edit`/`Write`/`MultiEdit` → `agent.status.changed → coding`
 *       + `artifact.produced` (one per tool_use, kind `code_pr`).
 *     - `Bash` matching test/build/typecheck/lint patterns →
 *       `agent.status.changed → testing` + `agent.message.sent` with a
 *       command summary. Other Bash → `agent.message.sent` only.
 *   - User `tool_result`:
 *     - `is_error: true` (or following a Bash) → `quality_gate.failed`
 *       + `agent.status.changed → failed`.
 *     - Success after a Bash test command → `quality_gate.passed`.
 *     - Read/Glob/Grep/Edit/Write results: log-only (no event).
 *   - `thinking` blocks: ignored. The transcript-format doc commits to
 *     never rendering raw thinking content; the mapper enforces that here.
 *   - Final assistant text or summary line: emit `work_item.completed`
 *     + `run.completed` after the last mapped event.
 *
 * The mapper picks `mira` as the office agent representing the session.
 * Future PRs can add heuristics (route to other rooms based on tool
 * usage patterns) — for v0.2 single-agent is enough.
 *
 * The mapper is pure-ish: it doesn't read files, doesn't reach into the
 * store, and doesn't throw on unknown content blocks (it ignores them
 * the same way it ignores `thinking`). Validation happens upstream in
 * `validateRawTranscript()`.
 */

const DEFAULT_AGENT: AgentId = "mira";

const READ_TOOLS = new Set(["Read", "Glob", "Grep"]);
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);
const BASH_TOOL = "Bash";

/**
 * Patterns that, when found in a Bash command, indicate test/build/typecheck
 * activity. Conservative on purpose — adding too many keywords risks flipping
 * to `testing` status on unrelated commands.
 */
const TEST_COMMAND_PATTERNS: RegExp[] = [
  /\bpnpm\s+test\b/,
  /\bnpm\s+test\b/,
  /\byarn\s+test\b/,
  /\bpnpm\s+build\b/,
  /\bnpm\s+(?:run\s+)?build\b/,
  /\byarn\s+build\b/,
  /\bpnpm\s+(?:run\s+)?typecheck\b/,
  /\bnpm\s+(?:run\s+)?typecheck\b/,
  /\btsc\b(?!-)/,
  /\bvitest\b/,
  /\bjest\b/,
  /\bpytest\b/,
  /\bcargo\s+test\b/,
  /\bcargo\s+build\b/,
  /\bgo\s+test\b/,
];

function isTestCommand(command: string | undefined): boolean {
  if (!command) return false;
  return TEST_COMMAND_PATTERNS.some((re) => re.test(command));
}

/**
 * Map a typed raw transcript into a ParsedClaudeCodeSession.
 *
 * The caller is responsible for running `validateRawTranscript` first —
 * the mapper trusts shape because validation should already have rejected
 * malformed lines.
 */
export function mapTranscriptToSession(
  rawLines: RawTranscriptLine[],
): ParsedClaudeCodeSession {
  const ctx = newContext(rawLines);

  // Run.started fires first.
  ctx.emit("run.started", "system", ctx.sessionSubject(), { source: "claude-code-local" });

  // Seed work item from the first user prompt with string content.
  seedWorkItem(rawLines, ctx);

  // Walk every line in order. tool_use blocks remember their toolName so
  // the matching tool_result (delivered on the next user line) can decide
  // whether to emit a quality gate.
  const toolUseLookup = new Map<string, ToolUseBlock>();

  for (const line of rawLines) {
    switch (line.type) {
      case "system":
        mapSystemLine(line, ctx);
        break;
      case "assistant":
        mapAssistantLine(line, toolUseLookup, ctx);
        break;
      case "user":
        mapUserLine(line, toolUseLookup, ctx);
        break;
      case "summary":
        // Summary is informational — title hint only, no event.
        break;
      case "pr-link":
        // pr-link → artifact.produced. The seed phase already used
        // custom-title / ai-title for the work item title; here we
        // surface the PR itself as an artifact attached to the work item.
        mapPrLink(line, ctx);
        break;
      // ai-title / custom-title are consumed during work-item seeding,
      // not during the walk. The remaining types are log-only by design:
      // attachment content is opaque (privacy), last-prompt is a UUID
      // pointer, queue-operation is internal queue state.
      case "ai-title":
      case "custom-title":
      case "last-prompt":
      case "attachment":
      case "queue-operation":
        break;
    }
  }

  // Finalize the run.
  if (ctx.workItemSeeded) {
    ctx.emit("work_item.completed", "system", ctx.workItem.id, { workItemId: ctx.workItem.id });
  }
  ctx.emit("run.completed", "system", ctx.sessionSubject(), {});

  return {
    origin: ctx.origin,
    workItem: ctx.workItem,
    chain: [DEFAULT_AGENT],
    events: ctx.events,
  };
}

// ─── Per-line mapping ────────────────────────────────────────────────────────

function mapAssistantLine(
  line: RawAssistantMessage,
  toolUseLookup: Map<string, ToolUseBlock>,
  ctx: MapperContext,
): void {
  for (const block of line.message.content) {
    if (block.type === "thinking") continue; // policy: never render

    if (block.type === "text") {
      const text = (block as TextBlock).text.trim();
      if (text.length === 0) continue;
      ctx.emit("agent.message.sent", DEFAULT_AGENT, DEFAULT_AGENT, {
        agentId: DEFAULT_AGENT,
        message: text,
      });
      continue;
    }

    if (block.type === "tool_use") {
      const tu = block as ToolUseBlock;
      toolUseLookup.set(tu.id, tu);
      mapAssistantToolUse(tu, ctx);
    }
    // tool_result inside an assistant content array would be unusual;
    // validation rejects misplaced blocks. Anything else: ignore.
  }
}

function mapAssistantToolUse(tu: ToolUseBlock, ctx: MapperContext): void {
  if (READ_TOOLS.has(tu.name)) {
    ctx.setStatus("reading", `${tu.name} ${shortInputPreview(tu)}`);
    return;
  }
  if (EDIT_TOOLS.has(tu.name)) {
    // Status flips immediately, but the artifact is emitted at tool_result
    // time when we know the edit actually applied. Tracked via toolUseLookup.
    ctx.setStatus("coding", `${tu.name} ${shortInputPreview(tu)}`);
    return;
  }
  if (tu.name === BASH_TOOL) {
    const command = (tu.input as { command?: string }).command;
    if (isTestCommand(command)) {
      // Status message uses the generic label too — don't render the raw command.
      ctx.setStatus("testing", "Running test command");
    }
    // Render a *category* label only — raw Bash arguments can carry API
    // keys, tokens, env vars, URLs with query strings, branch names,
    // private paths outside the home prefix, and inline secrets.
    // sanitizeForNotes can't catch those; safeBashCommandLabel never
    // exposes the command text in the first place.
    ctx.emit("agent.message.sent", DEFAULT_AGENT, DEFAULT_AGENT, {
      agentId: DEFAULT_AGENT,
      message: safeBashCommandLabel(command),
    });
    return;
  }

  // ─── Log-only mappings for high-signal real-transcript tools ──────────
  //
  // The mapper deliberately surfaces a *summary* of these tools, never
  // their raw inputs or outputs. Inputs to MCP browser tools, TaskCreate,
  // and AskUserQuestion can carry queries, prompts, page content, etc.

  // MCP tools — naming convention is `mcp__<server>__<tool>`.
  // Server names can carry client/project details ("acme-internal", etc.),
  // so the message stays generic. v0.3 can add an allow-list of
  // well-known public servers if richer labels become useful.
  if (tu.name.startsWith("mcp__")) {
    ctx.emit("agent.message.sent", DEFAULT_AGENT, DEFAULT_AGENT, {
      agentId: DEFAULT_AGENT,
      message: "MCP action observed",
    });
    return;
  }

  // AskUserQuestion is the closest real-transcript event to a decision
  // request. Observed mode is read-only — we MUST NOT emit
  // decision.requested (the validator forbids it; the UI has no handler).
  // Surface as a neutral log message so the activity log notes a human
  // touchpoint happened without smuggling the question content.
  if (tu.name === "AskUserQuestion") {
    ctx.emit("agent.message.sent", DEFAULT_AGENT, DEFAULT_AGENT, {
      agentId: DEFAULT_AGENT,
      message: "Asked the human a question (observed; not surfaced as a decision)",
    });
    return;
  }

  // Task / TaskCreate / TaskUpdate — internal model task tracking.
  // Render as a neutral activity message; payload is opaque.
  if (tu.name === "Task" || tu.name === "TaskCreate" || tu.name === "TaskUpdate") {
    ctx.emit("agent.message.sent", DEFAULT_AGENT, DEFAULT_AGENT, {
      agentId: DEFAULT_AGENT,
      message: `${tu.name} observed (task state change)`,
    });
    return;
  }

  // Everything else (WebFetch, ToolSearch, etc.) stays truly silent —
  // the office shows whatever the assistant's text block said about it,
  // which is the model's own summary and therefore safe.
}

function mapUserLine(
  line: RawUserMessage,
  toolUseLookup: Map<string, ToolUseBlock>,
  ctx: MapperContext,
): void {
  // String content is a user prompt; already handled by seedWorkItem if it
  // was the first such message. Subsequent string prompts are mapped to
  // human-authored messages.
  if (typeof line.message.content === "string") {
    if (line.uuid === ctx.firstPromptUuid) return;
    ctx.emit("agent.message.sent", "human", "human", {
      agentId: DEFAULT_AGENT, // visible on the office agent — same as in scripted scenarios
      message: line.message.content,
    });
    return;
  }

  // toolUseResult (when present) carries the structured-data sibling of
  // tool_result.content. Each tool_result block in this line shares the
  // same toolUseResult — there's only one per user line in practice.
  const toolUseResult = (line as RawUserMessage).toolUseResult;

  for (const block of line.message.content) {
    if (block.type !== "tool_result") continue;
    const tr = block as ToolResultBlock;
    const tu = toolUseLookup.get(tr.tool_use_id);
    mapToolResult(tr, tu, toolUseResult, ctx);
  }
}

function mapToolResult(
  tr: ToolResultBlock,
  tu: ToolUseBlock | undefined,
  toolUseResult: unknown,
  ctx: MapperContext,
): void {
  const isBash = tu?.name === BASH_TOOL;
  const isEdit = tu ? EDIT_TOOLS.has(tu.name) : false;
  const command = (tu?.input as { command?: string } | undefined)?.command;
  const wasTestCommand = isBash && isTestCommand(command);

  // Failure detection looks beyond `is_error: true` because real
  // transcripts often signal Bash failure via stderr / interrupted on
  // toolUseResult, not via is_error. See real-transcript-discovery.md
  // (only 39 of 1187 results in the sampled session had is_error: true).
  const bashResult = isBash ? asBashToolUseResult(toolUseResult) : undefined;
  const interrupted = bashResult?.interrupted === true;
  const stderrIndicatesFailure =
    isBash &&
    typeof bashResult?.stderr === "string" &&
    bashResult.stderr.trim().length > 0 &&
    looksLikeStderrFailure(bashResult.stderr);

  const failed = tr.is_error === true || interrupted || stderrIndicatesFailure;

  if (failed) {
    const gate: QualityGate = {
      id: `gate_${ctx.session.sessionId}_${ctx.nextGateN()}`,
      workItemId: ctx.workItem.id,
      name: tu ? `${tu.name} result` : "Tool result",
      owner: DEFAULT_AGENT,
      status: "failed",
      notes: failureNotes({ tr, bashResult, interrupted, stderrIndicatesFailure }),
    };
    ctx.emit("quality_gate.failed", DEFAULT_AGENT, ctx.workItem.id, { gate });
    ctx.setStatus("failed", `${tu?.name ?? "Tool"} failed`);
    return;
  }

  if (wasTestCommand) {
    const gate: QualityGate = {
      id: `gate_${ctx.session.sessionId}_${ctx.nextGateN()}`,
      workItemId: ctx.workItem.id,
      name: `${tu?.name ?? "Bash"}: ${truncate(command ?? "", 60)}`,
      owner: DEFAULT_AGENT,
      status: "passed",
      // For passed gates, the model-visible content is fine — it's the
      // tool's summary of its own output, not arbitrary file content.
      notes: trimmedContent(tr.content),
    };
    ctx.emit("quality_gate.passed", DEFAULT_AGENT, ctx.workItem.id, { gate });
    return;
  }

  if (isEdit) {
    // Now that the edit has applied, emit the artifact. Prefer the path
    // from toolUseResult (authoritative — confirms what got written) over
    // tool_use.input.file_path (the model's request).
    const editResult = asEditToolUseResult(toolUseResult);
    const filePath =
      editResult?.filePath ?? (tu?.input as { file_path?: string } | undefined)?.file_path;
    const hunks = editResult ? countPatchHunks(editResult.structuredPatch) : undefined;

    const summaryParts: string[] = [`${tu?.name ?? "Edit"}: ${filePath ?? "<unknown file>"}`];
    if (typeof hunks === "number") summaryParts.push(`${hunks} hunk${hunks === 1 ? "" : "s"}`);
    if (editResult?.replaceAll) summaryParts.push("replaceAll");

    const artifact: Artifact = {
      id: `art_${ctx.session.sessionId}_${ctx.nextArtifactN()}`,
      workItemId: ctx.workItem.id,
      producedBy: DEFAULT_AGENT,
      kind: "code_pr",
      ref: filePath ?? "<unknown file>",
      summary: summaryParts.join(" — "),
      ts: ctx.lastTimestamp(),
    };
    ctx.emit("artifact.produced", DEFAULT_AGENT, ctx.workItem.id, { artifact });
    return;
  }

  // Reads, non-test bash success, anything else: log-only.
}

/**
 * Common stderr patterns that indicate a real failure (vs. warning chatter).
 * Conservative on purpose — false positives flip the status to `failed`.
 */
const STDERR_FAILURE_PATTERNS: RegExp[] = [
  /\berror\b/i,
  /\bfailed\b/i,
  /\bfailure\b/i,
  /\bfatal\b/i,
  /✗/,
  /\bFAIL\b/,
  /\bnot ok\b/i,
];

function looksLikeStderrFailure(stderr: string): boolean {
  return STDERR_FAILURE_PATTERNS.some((re) => re.test(stderr));
}

function failureNotes(args: {
  tr: ToolResultBlock;
  bashResult: BashLikeToolUseResult | undefined;
  interrupted: boolean;
  stderrIndicatesFailure: boolean;
}): string {
  const { tr, bashResult, interrupted, stderrIndicatesFailure } = args;
  if (interrupted) return "Interrupted before completion";
  if (stderrIndicatesFailure && bashResult?.stderr) {
    // Real stderr can include local paths, test names, stack traces,
    // env vars, and code snippets. `sanitizeForNotes` redacts home paths,
    // collapses to a single line, redacts GitHub URLs, and truncates.
    // See `docs/architecture/claude-code-transcript-format.md`'s privacy
    // stance.
    const safe = sanitizeForNotes(bashResult.stderr);
    return safe.length > 0
      ? `Bash failed — stderr: ${safe}`
      : "Bash failed";
  }
  // Non-stderr failure (is_error: true with no structured stderr). The
  // model-visible content is already a summary, not arbitrary file
  // content, but it can still contain paths — sanitise.
  return sanitizeForNotes(trimmedContent(tr.content));
}

// ─── Work item seeding ───────────────────────────────────────────────────────

function seedWorkItem(rawLines: RawTranscriptLine[], ctx: MapperContext): void {
  const firstUser = rawLines.find(
    (l): l is RawUserMessage =>
      l.type === "user" && typeof l.message.content === "string",
  );
  const customTitle = rawLines.find(
    (l): l is RawCustomTitleLine => l.type === "custom-title",
  );
  const aiTitle = rawLines.find(
    (l): l is RawAiTitleLine => l.type === "ai-title",
  );

  // Title hierarchy: custom-title > user prompt > ai-title > default.
  // Custom-title is an explicit user override, so it wins. Failing that,
  // the actual user prompt is most informative. ai-title is the fallback
  // when there was no user-typed prompt (rare but possible).
  let title: string | undefined;
  if (customTitle?.customTitle) {
    title = truncate(customTitle.customTitle.trim(), 120);
  } else if (firstUser) {
    title = truncate((firstUser.message.content as string).trim(), 120);
  } else if (aiTitle?.aiTitle) {
    title = truncate(aiTitle.aiTitle.trim(), 120);
  }

  if (!title && !firstUser) {
    // No anchor for a work item at all. Leave unseeded — the session
    // wraps up with run.started/run.completed only.
    return;
  }

  ctx.firstPromptUuid = firstUser?.uuid;
  ctx.workItem.title = title || "Observed Claude Code session";

  ctx.emit("work_item.created", "human", ctx.workItem.id, {
    title: ctx.workItem.title,
    via: "claude-code-transcript",
  });
  ctx.emit("work_item.owner.changed", "system", ctx.workItem.id, {
    workItemId: ctx.workItem.id,
    from: null,
    to: DEFAULT_AGENT,
  });
  ctx.emit("work_item.mode.changed", DEFAULT_AGENT, ctx.workItem.id, {
    workItemId: ctx.workItem.id,
    from: null,
    to: "Generate",
  });

  ctx.workItem.ownerAgentId = DEFAULT_AGENT;
  ctx.workItem.assignedAgentIds = [DEFAULT_AGENT];
  ctx.workItemSeeded = true;
}

function mapSystemLine(line: RawSystemMessage, ctx: MapperContext): void {
  // Most system lines are session-meta we already used for origin during
  // `newContext` — they don't need a per-line event. The three subtypes
  // below are real signals worth surfacing.
  if (line.subtype === "compact_boundary") {
    // Conversation history was compacted by the runtime. Activity log
    // should make this visible because the run effectively has a seam.
    ctx.emit("agent.message.sent", "system", DEFAULT_AGENT, {
      agentId: DEFAULT_AGENT,
      message: "Conversation compacted by the runtime",
    });
    return;
  }

  if (line.subtype === "api_error") {
    if (!ctx.workItemSeeded) return;
    const blocker: Blocker = {
      id: `blk_${ctx.session.sessionId}_${ctx.nextBlockerN()}`,
      workItemId: ctx.workItem.id,
      raisedBy: DEFAULT_AGENT,
      kind: "external",
      description: "Anthropic API error during session",
      resolution: null,
      resolvedAt: null,
    };
    ctx.emit("blocker.raised", "system", ctx.workItem.id, { blocker });
    return;
  }

  if (line.subtype === "stop_hook_summary") {
    const hookErrors = (line as { hookErrors?: unknown }).hookErrors;
    const errors = Array.isArray(hookErrors) ? hookErrors : [];
    const prevented = (line as { preventedContinuation?: unknown }).preventedContinuation === true;
    if (errors.length === 0 && !prevented) return; // clean hook summary — no event

    if (!ctx.workItemSeeded) return;
    const blocker: Blocker = {
      id: `blk_${ctx.session.sessionId}_${ctx.nextBlockerN()}`,
      workItemId: ctx.workItem.id,
      raisedBy: DEFAULT_AGENT,
      kind: prevented ? "gate_failed" : "external",
      description: prevented
        ? "Pre-commit hook prevented continuation"
        : `Hook errors during session (${errors.length})`,
      resolution: null,
      resolvedAt: null,
    };
    ctx.emit("blocker.raised", "system", ctx.workItem.id, { blocker });
  }
}

function mapPrLink(line: RawPrLinkLine, ctx: MapperContext): void {
  if (!ctx.workItemSeeded) return; // no work item to attach the PR to

  const ref = line.prUrl;
  const repo = line.prRepository;
  const number =
    typeof line.prNumber === "number" ? line.prNumber : String(line.prNumber);
  const artifact: Artifact = {
    id: `art_${ctx.session.sessionId}_${ctx.nextArtifactN()}`,
    workItemId: ctx.workItem.id,
    producedBy: DEFAULT_AGENT,
    kind: "code_pr",
    ref,
    summary: `PR #${number} opened in ${repo}`,
    ts: line.timestamp ?? ctx.lastTimestamp(),
  };
  ctx.emit("artifact.produced", DEFAULT_AGENT, ctx.workItem.id, { artifact });
}

// ─── Context (closure-style state for the walk) ──────────────────────────────

interface MapperContext {
  session: { sessionId: string; capturedAt: string };
  origin: ParsedClaudeCodeSession["origin"];
  workItem: WorkItem;
  events: WorkflowEvent[];
  workItemSeeded: boolean;
  firstPromptUuid: string | undefined;
  setStatus(to: WorkflowEvent["payload"]["to"] extends never ? never : string, message?: string): void;
  emit(
    type: WorkflowEvent["type"],
    actor: WorkflowEvent["actor"],
    subject: string,
    payload: Record<string, unknown>,
  ): void;
  sessionSubject(): string;
  lastTimestamp(): string;
  nextArtifactN(): number;
  nextGateN(): number;
  nextBlockerN(): number;
}

function newContext(rawLines: RawTranscriptLine[]): MapperContext {
  const initLine = rawLines.find(
    (l): l is RawSystemMessage => l.type === "system" && l.subtype === "init",
  );
  const sessionId = initLine?.sessionId
    ?? rawLines.find((l) => l.sessionId)?.sessionId
    ?? "unknown-session";
  const capturedAt = initLine?.timestamp
    ?? rawLines.find((l) => l.timestamp)?.timestamp
    ?? new Date().toISOString();
  const summaryLine = rawLines.find((l): l is RawSummaryLine => l.type === "summary");

  const workItemId = `wi_observed_${sessionId}`;
  const workItem: WorkItem = {
    id: workItemId,
    title: summaryLine?.summary ?? "Observed Claude Code session",
    kind: "feature",
    status: "captured",
    currentMode: "Generate",
    currentPhase: "Live Claude Code session",
    ownerAgentId: null,
    nextAgentId: DEFAULT_AGENT,
    assignedAgentIds: [],
    humanDecisionNeeded: false,
    branch: null,
    worktreePath: null,
    modeHistory: [],
    artifactIds: [],
    decisionIds: [],
    blockerIds: [],
    qualityGateIds: [],
    acceptance: [],
    outOfScope: [],
    createdAt: capturedAt,
    updatedAt: capturedAt,
  };

  const events: WorkflowEvent[] = [];
  let lastTs = capturedAt;
  let evtN = 0;
  let artN = 0;
  let gateN = 0;
  let blkN = 0;
  let currentStatus: string = "idle";

  const indexOf = new Map<string, number>();
  rawLines.forEach((l, i) => l.uuid && indexOf.set(l.uuid, i));

  return {
    session: { sessionId, capturedAt },
    origin: {
      source: "claude-code-local",
      sessionId,
      capturedAt,
      note: summaryLine?.summary,
    },
    workItem,
    events,
    workItemSeeded: false,
    firstPromptUuid: undefined,
    setStatus(to, message) {
      if (currentStatus === to) return;
      events.push({
        id: `evt_${sessionId}_${String(++evtN).padStart(4, "0")}`,
        ts: lastTs,
        actor: DEFAULT_AGENT,
        type: "agent.status.changed",
        subject: DEFAULT_AGENT,
        payload: { agentId: DEFAULT_AGENT, from: currentStatus, to, message },
      });
      currentStatus = String(to);
    },
    emit(type, actor, subject, payload) {
      // Best-effort timestamp: use the most recent line we've seen.
      // The walk advances `lastTs` whenever a line with a timestamp is touched.
      const ts = bumpTs(rawLines, lastTs);
      lastTs = ts;
      const id = `evt_${sessionId}_${String(++evtN).padStart(4, "0")}`;
      const next: WorkflowEvent = { id, ts, actor, type, subject, payload };
      if (type === "artifact.produced") {
        const artifact = (payload as { artifact: Artifact }).artifact;
        artifact.id = `art_${sessionId}_${String(++artN).padStart(4, "0")}`;
        workItem.artifactIds = [...workItem.artifactIds, artifact.id];
      }
      if (type === "quality_gate.passed" || type === "quality_gate.failed") {
        const gate = (payload as { gate: QualityGate }).gate;
        gate.id = `gate_${sessionId}_${String(++gateN).padStart(4, "0")}`;
        workItem.qualityGateIds = [...workItem.qualityGateIds, gate.id];
      }
      if (type === "blocker.raised") {
        const blocker = (payload as { blocker: Blocker }).blocker;
        blocker.id = `blk_${sessionId}_${String(++blkN).padStart(4, "0")}`;
        workItem.blockerIds = [...workItem.blockerIds, blocker.id];
      }
      events.push(next);
    },
    sessionSubject() {
      return workItemId;
    },
    lastTimestamp() {
      return lastTs;
    },
    nextArtifactN() {
      return artN + 1;
    },
    nextGateN() {
      return gateN + 1;
    },
    nextBlockerN() {
      return blkN + 1;
    },
  };
}

function bumpTs(_rawLines: RawTranscriptLine[], lastTs: string): string {
  // Simple: bump the last-seen timestamp by 1ms so all emitted events sort
  // deterministically after each other. The real timestamps from the transcript
  // are honored on the *first* event after each raw line via setLastTsFromLine
  // (called by the walk), so the granularity error is well under 1s.
  const t = new Date(lastTs).getTime();
  if (Number.isNaN(t)) return lastTs;
  return new Date(t + 1).toISOString();
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function trimmedContent(content: ToolResultBlock["content"]): string {
  if (typeof content === "string") return truncate(content.trim(), 240);
  // For nested content arrays, just join the text blocks if any.
  const texts: string[] = [];
  for (const block of content) {
    if (block.type === "text") texts.push((block as TextBlock).text);
  }
  return truncate(texts.join(" ").trim(), 240);
}

function shortInputPreview(tu: ToolUseBlock): string {
  const filePath = (tu.input as { file_path?: string; pattern?: string; command?: string }).file_path
    ?? (tu.input as { pattern?: string }).pattern
    ?? (tu.input as { command?: string }).command
    ?? "";
  return truncate(filePath, 60);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

// Re-export ContentBlock to avoid a "unused import" warning if a future
// refactor inlines the union. Cheap and stable.
export type { ContentBlock };
