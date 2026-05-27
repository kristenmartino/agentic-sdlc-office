import type { ADLCMode } from "./adlc";
import type { AgentId } from "./agents";

export type WorkItemKind = "feature" | "bug" | "research" | "task";

export type WorkItemStatus =
  | "captured"
  | "refined"
  | "researching"
  | "planning"
  | "designing"
  | "building"
  | "validating"
  | "reviewing"
  | "awaiting_human"
  | "done";

export interface ModeChange {
  ts: string;
  from: ADLCMode | null;
  to: ADLCMode;
  by: AgentId;
}

export interface WorkItem {
  id: string;
  title: string;
  kind: WorkItemKind;
  status: WorkItemStatus;
  currentMode: ADLCMode;
  currentPhase: string;
  ownerAgentId: AgentId | null;
  nextAgentId: AgentId | null;
  assignedAgentIds: AgentId[];
  humanDecisionNeeded: boolean;
  branch: string | null;
  worktreePath: string | null;
  modeHistory: ModeChange[];
  artifactIds: string[];
  decisionIds: string[];
  blockerIds: string[];
  qualityGateIds: string[];
  acceptance: string[];
  outOfScope: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Artifact {
  id: string;
  workItemId: string;
  producedBy: AgentId;
  kind:
    | "acceptance_criteria"
    | "research_brief"
    | "adr"
    | "ui_spec"
    | "code_pr"
    | "test_plan"
    | "review_report"
    | "morning_report";
  ref: string;
  summary: string;
  ts: string;
}
