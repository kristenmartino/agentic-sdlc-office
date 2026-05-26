import type { AgentId } from "./agents";

export type WorkflowEventType =
  | "work_item.created"
  | "work_item.refined"
  | "work_item.completed"
  | "handoff.requested"
  | "handoff.accepted"
  | "artifact.produced"
  | "decision.requested"
  | "decision.resolved"
  | "blocker.raised"
  | "blocker.cleared"
  | "quality_gate.passed"
  | "quality_gate.failed";

export interface WorkflowEvent {
  id: string;
  ts: string;
  actor: AgentId | "human";
  type: WorkflowEventType;
  subject: string;
  payload: Record<string, unknown>;
}
