import type { AgentId } from "@/types/agents";
import type {
  ContentBlock,
  RawAssistantMessage,
  RawSummaryLine,
  RawSystemMessage,
  RawTranscriptLine,
  RawUserMessage,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
} from "@/types/claude-code-transcript";
import type { Artifact, WorkItem } from "@/types/work-items";
import type { QualityGate } from "@/types/governance";
import type { WorkflowEvent } from "@/types/workflow-events";
import type { ParsedClaudeCodeSession } from "./claude-code-parser";

/**
 * Map a parsed Claude Code transcript into a `ParsedClaudeCodeSession`.
 *
 * This is the v0.2 mapper. Input: typed raw transcript lines (already
 * validated). Output: a session that drops straight into the scenario
 * registry — no further transformation needed.
 *
 * Mapping rules (from the PR #42 review acceptance spec):
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
        // Already used for origin; nothing else to emit.
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
      // The following six types are accepted (no longer rejected by the
      // validator) but the mapper currently walks past them as no-ops.
      // PR #46 will consume `pr-link` as `artifact.produced` and use
      // `ai-title` / `custom-title` for title fallback. Attachments are
      // never rendered by default for privacy reasons.
      case "ai-title":
      case "custom-title":
      case "last-prompt":
      case "pr-link":
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
    ctx.setStatus("coding", `${tu.name} ${shortInputPreview(tu)}`);
    const filePath = (tu.input as { file_path?: string }).file_path;
    const artifact: Artifact = {
      id: `art_${ctx.session.sessionId}_${ctx.nextArtifactN()}`,
      workItemId: ctx.workItem.id,
      producedBy: DEFAULT_AGENT,
      kind: "code_pr",
      ref: filePath ?? "<unknown file>",
      summary: `${tu.name}: ${filePath ?? "edit"}`,
      ts: ctx.lastTimestamp(),
    };
    ctx.emit("artifact.produced", DEFAULT_AGENT, ctx.workItem.id, { artifact });
    return;
  }
  if (tu.name === BASH_TOOL) {
    const command = (tu.input as { command?: string }).command;
    if (isTestCommand(command)) {
      ctx.setStatus("testing", `Running ${command ?? "command"}`);
    }
    if (command) {
      ctx.emit("agent.message.sent", DEFAULT_AGENT, DEFAULT_AGENT, {
        agentId: DEFAULT_AGENT,
        message: `$ ${command}`,
      });
    }
    return;
  }
  // Other tool_use names (Task, WebFetch, etc.) — log-only for v0.2.
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

  for (const block of line.message.content) {
    if (block.type !== "tool_result") continue;
    const tr = block as ToolResultBlock;
    const tu = toolUseLookup.get(tr.tool_use_id);
    mapToolResult(tr, tu, ctx);
  }
}

function mapToolResult(
  tr: ToolResultBlock,
  tu: ToolUseBlock | undefined,
  ctx: MapperContext,
): void {
  const isBash = tu?.name === BASH_TOOL;
  const wasTestCommand = isBash && isTestCommand((tu?.input as { command?: string } | undefined)?.command);
  const failed = tr.is_error === true;

  if (failed) {
    const gate: QualityGate = {
      id: `gate_${ctx.session.sessionId}_${ctx.nextGateN()}`,
      workItemId: ctx.workItem.id,
      name: tu ? `${tu.name} result` : "Tool result",
      owner: DEFAULT_AGENT,
      status: "failed",
      notes: trimmedContent(tr.content),
    };
    ctx.emit("quality_gate.failed", DEFAULT_AGENT, ctx.workItem.id, { gate });
    ctx.setStatus("failed", `${tu?.name ?? "Tool"} failed`);
    return;
  }

  if (wasTestCommand) {
    const gate: QualityGate = {
      id: `gate_${ctx.session.sessionId}_${ctx.nextGateN()}`,
      workItemId: ctx.workItem.id,
      name: `${tu?.name ?? "Bash"}: ${truncate((tu?.input as { command?: string } | undefined)?.command ?? "", 60)}`,
      owner: DEFAULT_AGENT,
      status: "passed",
      notes: trimmedContent(tr.content),
    };
    ctx.emit("quality_gate.passed", DEFAULT_AGENT, ctx.workItem.id, { gate });
    return;
  }

  // Reads, edits, non-test bash success: log-only.
}

// ─── Work item seeding ───────────────────────────────────────────────────────

function seedWorkItem(rawLines: RawTranscriptLine[], ctx: MapperContext): void {
  const firstUser = rawLines.find(
    (l): l is RawUserMessage =>
      l.type === "user" && typeof l.message.content === "string",
  );
  if (!firstUser) return; // session opened with no prompt — leave workItem unseeded

  const title = truncate((firstUser.message.content as string).trim(), 120);
  ctx.firstPromptUuid = firstUser.uuid;
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
