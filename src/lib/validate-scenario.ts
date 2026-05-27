import type { AgentId, AgentStatus } from "@/types/agents";
import type { RoomId } from "@/types/rooms";
import type { ADLCMode } from "@/types/adlc";
import type { Scenario } from "@/data/scenarios";
import type { WorkItem, WorkItemKind, WorkItemStatus } from "@/types/work-items";
import type { WorkflowEventType } from "@/types/workflow-events";

const VALID_AGENTS = new Set<AgentId>([
  "cora", "piper", "nova", "theo", "iris", "mira", "tess", "rune",
]);

const VALID_ROOMS = new Set<RoomId>([
  "lobby", "product-research", "architecture-design", "dev-floor",
  "qa-lab", "review-security", "human-office", "archive",
]);

const VALID_STATUSES = new Set<AgentStatus>([
  "idle", "thinking", "reading", "planning", "designing", "coding", "testing",
  "reviewing", "talking", "meeting", "waiting_on_agent", "waiting_on_human",
  "blocked", "done", "failed",
]);

const VALID_MODES = new Set<ADLCMode>([
  "Intent", "Generate", "Validate", "Govern", "Deploy", "Observe", "Multi",
]);

const VALID_ACTORS = new Set<string>([
  ...VALID_AGENTS, "human", "system",
]);

const VALID_WORK_ITEM_KINDS = new Set<WorkItemKind>([
  "feature", "bug", "research", "task",
]);

const VALID_WORK_ITEM_STATUSES = new Set<WorkItemStatus>([
  "captured", "refined", "researching", "planning", "designing", "building",
  "validating", "reviewing", "awaiting_human", "done",
]);

const VALID_EVENT_TYPES = new Set<WorkflowEventType>([
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

const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
const isIsoTimestamp = (v: unknown): v is string =>
  typeof v === "string" && ISO_8601_RE.test(v) && !Number.isNaN(Date.parse(v));

export interface ValidationIssue {
  scenarioId: string;
  eventId: string;
  eventIndex: number;
  message: string;
}

/**
 * Validates a scenario's event stream against the runtime type unions.
 * Catches bugs that TypeScript can't (event payloads are `Record<string, unknown>`).
 * Returns an empty array if valid.
 */
export function validateScenario(scenario: Scenario): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requestedDecisions = new Set<string>();
  const requestedApprovals = new Set<string>();
  const resolvedDecisions = new Set<string>();
  const resolvedApprovals = new Set<string>();

  const push = (eventId: string, eventIndex: number, message: string) =>
    issues.push({ scenarioId: scenario.id, eventId, eventIndex, message });

  // --- Initial work item validation ---
  // Important for observed scenarios loaded from external JSON: TS only types
  // the import, the field values are still trusted-by-default unless we check.
  validateInitialWorkItem(scenario.initialWorkItem, push);

  // --- Chain validation ---
  if (!Array.isArray(scenario.chain) || scenario.chain.length === 0) {
    push("n/a", -1, "scenario.chain must be a non-empty array");
  } else {
    scenario.chain.forEach((agent, idx) => {
      if (!VALID_AGENTS.has(agent)) {
        push("n/a", -1, `scenario.chain[${idx}]: unknown agent '${agent}'`);
      }
    });

    // Scripted scenarios drive handoffs explicitly, so chain length must
    // match the number of owner changes. Observed scenarios are sourced from
    // a real session — a single agent can produce many owner.changed events
    // (or none), so we only check that every chain entry is a known agent.
    if (scenario.source === "scripted") {
      const ownerChanges = scenario.events.filter(
        (e) => e.type === "work_item.owner.changed",
      ).length;
      if (scenario.chain.length !== ownerChanges) {
        push(
          "n/a",
          -1,
          `scenario.chain.length (${scenario.chain.length}) does not match work_item.owner.changed count (${ownerChanges})`,
        );
      }
    }
  }

  // --- Observed-mode invariants ---
  // Observed sessions are read-only: a decision or approval surfaced in an
  // observed run has nothing in the UI to resolve it, so the run would stall.
  // Catch that at validation time, not at runtime.
  if (scenario.source === "observed") {
    scenario.events.forEach((event, i) => {
      if (event.type === "decision.requested" || event.type === "approval.requested") {
        push(event.id, i, `observed scenarios must not contain ${event.type} — observer mode is read-only`);
      }
    });
  }

  scenario.events.forEach((event, i) => {
    const eid = event.id;

    // Reject unknown event.type strings outright. TS only catches this for
    // statically-typed scenarios; for external fixtures (real Claude Code
    // sessions, eventually) the type is whatever the JSON says it is.
    if (!VALID_EVENT_TYPES.has(event.type as WorkflowEventType)) {
      push(eid, i, `unknown event.type: ${event.type}`);
      return;
    }

    // Actor must be a known agent, "human", or "system"
    if (!VALID_ACTORS.has(event.actor)) {
      push(eid, i, `unknown actor: ${event.actor}`);
    }

    const payload = event.payload as Record<string, unknown>;

    switch (event.type) {
      case "agent.status.changed": {
        const p = payload as { agentId?: string; from?: string; to?: string };
        if (!p.agentId || !VALID_AGENTS.has(p.agentId as AgentId))
          push(eid, i, `agent.status.changed: invalid agentId ${p.agentId}`);
        if (p.to && !VALID_STATUSES.has(p.to as AgentStatus))
          push(eid, i, `agent.status.changed: invalid 'to' status ${p.to}`);
        if (p.from && !VALID_STATUSES.has(p.from as AgentStatus))
          push(eid, i, `agent.status.changed: invalid 'from' status ${p.from}`);
        break;
      }

      case "agent.moved": {
        const p = payload as { agentId?: string; from?: string; to?: string };
        if (!p.agentId || !VALID_AGENTS.has(p.agentId as AgentId))
          push(eid, i, `agent.moved: invalid agentId ${p.agentId}`);
        if (p.to && !VALID_ROOMS.has(p.to as RoomId))
          push(eid, i, `agent.moved: invalid 'to' room ${p.to}`);
        if (p.from && !VALID_ROOMS.has(p.from as RoomId))
          push(eid, i, `agent.moved: invalid 'from' room ${p.from}`);
        break;
      }

      case "agent.message.sent": {
        const p = payload as { agentId?: string; message?: string };
        if (!p.agentId || !VALID_AGENTS.has(p.agentId as AgentId))
          push(eid, i, `agent.message.sent: invalid agentId ${p.agentId}`);
        if (typeof p.message !== "string")
          push(eid, i, `agent.message.sent: missing message`);
        break;
      }

      case "work_item.owner.changed": {
        const p = payload as { to?: string };
        if (!p.to || !VALID_AGENTS.has(p.to as AgentId))
          push(eid, i, `work_item.owner.changed: invalid 'to' agent ${p.to}`);
        break;
      }

      case "work_item.mode.changed": {
        const p = payload as { to?: string };
        if (!p.to || !VALID_MODES.has(p.to as ADLCMode))
          push(eid, i, `work_item.mode.changed: invalid 'to' mode ${p.to}`);
        break;
      }

      case "handoff.requested":
      case "handoff.accepted":
      case "handoff.completed": {
        const p = payload as { fromAgentId?: string; toAgentId?: string };
        if (!p.fromAgentId || !VALID_AGENTS.has(p.fromAgentId as AgentId))
          push(eid, i, `${event.type}: invalid fromAgentId ${p.fromAgentId}`);
        if (!p.toAgentId || !VALID_AGENTS.has(p.toAgentId as AgentId))
          push(eid, i, `${event.type}: invalid toAgentId ${p.toAgentId}`);
        break;
      }

      case "decision.requested": {
        const p = payload as { decision?: { id?: string } };
        if (!p.decision?.id) push(eid, i, `decision.requested: missing decision.id`);
        else requestedDecisions.add(p.decision.id);
        break;
      }
      case "decision.resolved": {
        const p = payload as { decisionId?: string };
        if (!p.decisionId) push(eid, i, `decision.resolved: missing decisionId`);
        else {
          resolvedDecisions.add(p.decisionId);
          if (!requestedDecisions.has(p.decisionId))
            push(eid, i, `decision.resolved: no matching decision.requested for ${p.decisionId}`);
        }
        break;
      }

      case "approval.requested": {
        const p = payload as { approval?: { id?: string } };
        if (!p.approval?.id) push(eid, i, `approval.requested: missing approval.id`);
        else requestedApprovals.add(p.approval.id);
        break;
      }
      case "approval.resolved": {
        const p = payload as { approvalId?: string };
        if (!p.approvalId) push(eid, i, `approval.resolved: missing approvalId`);
        else {
          resolvedApprovals.add(p.approvalId);
          if (!requestedApprovals.has(p.approvalId))
            push(eid, i, `approval.resolved: no matching approval.requested for ${p.approvalId}`);
        }
        break;
      }
    }
  });

  // Unmatched requests (allowed: a demo scenario can intentionally end on a pause, but
  // for our v0.1 scenarios both REQ-014 and BUG-032 fully resolve.)
  for (const id of requestedDecisions) {
    if (!resolvedDecisions.has(id))
      issues.push({ scenarioId: scenario.id, eventId: "n/a", eventIndex: -1, message: `decision ${id} requested but never resolved` });
  }
  for (const id of requestedApprovals) {
    if (!resolvedApprovals.has(id))
      issues.push({ scenarioId: scenario.id, eventId: "n/a", eventIndex: -1, message: `approval ${id} requested but never resolved` });
  }

  return issues;
}

type IssuePusher = (eventId: string, eventIndex: number, message: string) => void;

/**
 * Validate `scenario.initialWorkItem` against the WorkItem type's runtime
 * unions. Mostly a no-op for our scripted scenarios — they're hand-rolled
 * TS objects so values can only drift via deliberate refactor. The check
 * matters most for observed scenarios where the work item is loaded from
 * external JSON: TypeScript types only verify the shape of the import, not
 * the values inside it.
 *
 * Field reasoning:
 *
 * - `id`, `title` — required non-empty strings; the UI shows them and they
 *   anchor every artifact / decision back to the work item.
 * - `kind`, `status`, `currentMode` — discriminated unions; anything outside
 *   the type's allowed values would break the reducer or the UI.
 * - `ownerAgentId`, `nextAgentId`, `assignedAgentIds[]` — agent IDs must be
 *   real or `agents.find()` will return undefined and the UI will crash.
 * - `createdAt`, `updatedAt` — ISO 8601 UTC. The activity log sorts and
 *   formats from these.
 */
function validateInitialWorkItem(wi: WorkItem, push: IssuePusher): void {
  if (typeof wi.id !== "string" || wi.id.length === 0) {
    push("n/a", -1, "initialWorkItem.id must be a non-empty string");
  }
  if (typeof wi.title !== "string" || wi.title.length === 0) {
    push("n/a", -1, "initialWorkItem.title must be a non-empty string");
  }

  if (!VALID_WORK_ITEM_KINDS.has(wi.kind)) {
    push("n/a", -1, `initialWorkItem.kind: unknown value '${wi.kind}'`);
  }
  if (!VALID_WORK_ITEM_STATUSES.has(wi.status)) {
    push("n/a", -1, `initialWorkItem.status: unknown value '${wi.status}'`);
  }
  if (!VALID_MODES.has(wi.currentMode)) {
    push("n/a", -1, `initialWorkItem.currentMode: unknown value '${wi.currentMode}'`);
  }

  if (wi.ownerAgentId !== null && !VALID_AGENTS.has(wi.ownerAgentId)) {
    push("n/a", -1, `initialWorkItem.ownerAgentId: unknown agent '${wi.ownerAgentId}'`);
  }
  if (wi.nextAgentId !== null && !VALID_AGENTS.has(wi.nextAgentId)) {
    push("n/a", -1, `initialWorkItem.nextAgentId: unknown agent '${wi.nextAgentId}'`);
  }

  if (!Array.isArray(wi.assignedAgentIds)) {
    push("n/a", -1, "initialWorkItem.assignedAgentIds must be an array");
  } else {
    wi.assignedAgentIds.forEach((id, idx) => {
      if (!VALID_AGENTS.has(id)) {
        push("n/a", -1, `initialWorkItem.assignedAgentIds[${idx}]: unknown agent '${id}'`);
      }
    });
  }

  if (!isIsoTimestamp(wi.createdAt)) {
    push("n/a", -1, `initialWorkItem.createdAt: not a valid ISO 8601 timestamp ('${wi.createdAt}')`);
  }
  if (!isIsoTimestamp(wi.updatedAt)) {
    push("n/a", -1, `initialWorkItem.updatedAt: not a valid ISO 8601 timestamp ('${wi.updatedAt}')`);
  }
}
