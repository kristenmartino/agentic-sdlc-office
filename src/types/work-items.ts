import type { ADLCMode } from "./adlc";
import type { AgentId } from "./agents";

export type WorkItemKind = "feature" | "bug" | "research" | "task";

export type WorkItemStatus =
  | "captured"
  | "refined"
  | "generating"
  | "validating"
  | "governed"
  | "deployed"
  | "observed";

export interface WorkItem {
  id: string;
  title: string;
  kind: WorkItemKind;
  status: WorkItemStatus;
  currentMode: ADLCMode;
  ownerAgent: AgentId | null;
  humanDecisionNeeded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Artifact {
  id: string;
  workItem: string;
  producedBy: AgentId;
  kind: string;
  ref: string;
  ts: string;
}
