/**
 * Single source of truth for runtime union sets.
 *
 * TypeScript's discriminated unions live in `src/types/*` — they catch
 * drift at compile time. But there are several places (the scenario
 * validator, the parser chain helper, the raw transcript validator)
 * that need to ask at *runtime* "is this string actually one of the
 * legal values?" Before this module existed, each of those sites
 * declared its own `new Set([...])` — and the agent list specifically
 * had already drifted into two copies (one in `validate-scenario.ts`,
 * one in `claude-code-parser.ts`).
 *
 * One module avoids that drift. When a new agent / room / mode /
 * status / work item kind / event type is added to the type union,
 * add it here too — every runtime check picks up the change.
 *
 * The exported sets are typed as `ReadonlySet<T>` so callers can use
 * them in type guards (`set.has(value as T)`) without accidentally
 * mutating them.
 */

import type { AgentId, AgentStatus } from "@/types/agents";
import type { RoomId } from "@/types/rooms";
import type { ADLCMode } from "@/types/adlc";
import type { WorkItemKind, WorkItemStatus } from "@/types/work-items";
import type { WorkflowEventType } from "@/types/workflow-events";
import type {
  ContentBlock,
  RawTranscriptLine,
} from "@/types/claude-code-transcript";

export const KNOWN_AGENT_IDS: ReadonlySet<AgentId> = new Set([
  "cora", "piper", "nova", "theo", "iris", "mira", "tess", "rune",
]);

export const KNOWN_ROOM_IDS: ReadonlySet<RoomId> = new Set([
  "lobby", "product-research", "architecture-design", "dev-floor",
  "qa-lab", "review-security", "human-office", "archive",
]);

export const KNOWN_AGENT_STATUSES: ReadonlySet<AgentStatus> = new Set([
  "idle", "thinking", "reading", "planning", "designing", "coding", "testing",
  "reviewing", "talking", "meeting", "waiting_on_agent", "waiting_on_human",
  "blocked", "done", "failed",
]);

export const KNOWN_ADLC_MODES: ReadonlySet<ADLCMode> = new Set([
  "Intent", "Generate", "Validate", "Govern", "Deploy", "Observe", "Multi",
]);

/** Includes "human" and "system" alongside the eight agent ids. */
export const KNOWN_EVENT_ACTORS: ReadonlySet<string> = new Set<string>([
  ...KNOWN_AGENT_IDS, "human", "system",
]);

export const KNOWN_WORK_ITEM_KINDS: ReadonlySet<WorkItemKind> = new Set([
  "feature", "bug", "research", "task",
]);

export const KNOWN_WORK_ITEM_STATUSES: ReadonlySet<WorkItemStatus> = new Set([
  "captured", "refined", "researching", "planning", "designing", "building",
  "validating", "reviewing", "awaiting_human", "done",
]);

export const KNOWN_WORKFLOW_EVENT_TYPES: ReadonlySet<WorkflowEventType> = new Set([
  "run.started", "run.paused", "run.completed",
  "work_item.created", "work_item.refined", "work_item.owner.changed",
  "work_item.mode.changed", "work_item.completed",
  "agent.started", "agent.finished", "agent.status.changed",
  "agent.moved", "agent.message.sent",
  "room.entered", "room.exited",
  "handoff.requested", "handoff.accepted", "handoff.completed",
  "artifact.produced",
  "decision.requested", "decision.resolved",
  "blocker.raised", "blocker.cleared",
  "quality_gate.passed", "quality_gate.failed",
  "approval.requested", "approval.resolved",
  "meeting.started", "meeting.ended",
  "permission.bumped", "permission.expired",
]);

export const KNOWN_RAW_TRANSCRIPT_LINE_TYPES: ReadonlySet<RawTranscriptLine["type"]> = new Set([
  "system", "user", "assistant", "summary",
  // Added after real-transcript discovery (PR #44):
  "ai-title", "custom-title", "last-prompt", "pr-link", "attachment", "queue-operation",
]);

export const KNOWN_CONTENT_BLOCK_TYPES: ReadonlySet<ContentBlock["type"]> = new Set([
  "text", "tool_use", "tool_result", "thinking",
]);

/**
 * Type guard for agent IDs. Defensive against unvalidated input — accepts
 * `unknown` so callers can pass values straight from a JSON payload.
 */
export function isKnownAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && KNOWN_AGENT_IDS.has(value as AgentId);
}

const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Strict ISO 8601 datetime check. Requires the offset (`Z` or `±hh:mm`)
 * because timezone-naive timestamps cause ordering bugs in the activity log.
 */
export function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && ISO_8601_RE.test(value) && !Number.isNaN(Date.parse(value));
}
