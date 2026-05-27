import type { AgentId, AgentStatus } from "./agents";
import type { RoomId } from "./rooms";
import type { ADLCMode } from "./adlc";

export type WorkflowEventType =
  // Run lifecycle
  | "run.started"
  | "run.paused"
  | "run.completed"
  // Work item lifecycle
  | "work_item.created"
  | "work_item.refined"
  | "work_item.owner.changed"
  | "work_item.mode.changed"
  | "work_item.completed"
  // Agent lifecycle
  | "agent.started"
  | "agent.finished"
  | "agent.status.changed"
  | "agent.moved"
  | "agent.message.sent"
  // Rooms
  | "room.entered"
  | "room.exited"
  // Handoffs
  | "handoff.requested"
  | "handoff.accepted"
  | "handoff.completed"
  // Artifacts
  | "artifact.produced"
  // Decisions
  | "decision.requested"
  | "decision.resolved"
  // Blockers
  | "blocker.raised"
  | "blocker.cleared"
  // Quality gates
  | "quality_gate.passed"
  | "quality_gate.failed"
  // Approvals (human-in-the-loop)
  | "approval.requested"
  | "approval.resolved"
  // Meetings
  | "meeting.started"
  | "meeting.ended"
  // Permission bumps
  | "permission.bumped"
  | "permission.expired";

export interface WorkflowEvent {
  id: string;
  ts: string;
  actor: AgentId | "human" | "system";
  type: WorkflowEventType;
  subject: string;
  payload: Record<string, unknown>;
}

// Narrow helpers for specific payload shapes the UI consumes most often.

export interface AgentStatusChangedPayload {
  agentId: AgentId;
  from: AgentStatus;
  to: AgentStatus;
  message?: string;
}

export interface AgentMovedPayload {
  agentId: AgentId;
  from: RoomId;
  to: RoomId;
}

export interface WorkItemOwnerChangedPayload {
  workItemId: string;
  from: AgentId | null;
  to: AgentId;
}

export interface WorkItemModeChangedPayload {
  workItemId: string;
  from: ADLCMode | null;
  to: ADLCMode;
}
