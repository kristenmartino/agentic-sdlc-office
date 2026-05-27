import type { AgentId } from "./agents";

export interface DecisionOption {
  id: string;
  label: string;
  pros: string[];
  cons: string[];
}

export interface Decision {
  id: string;
  workItemId: string;
  question: string;
  context: string;
  options: DecisionOption[];
  recommendation: string | null;
  raisedBy: AgentId;
  resolved: boolean;
  chosenOptionId: string | null;
  resolvedBy: AgentId | "human" | null;
  resolvedAt: string | null;
  reversible: "yes" | "partially" | "no";
}

export interface Blocker {
  id: string;
  workItemId: string;
  raisedBy: AgentId;
  kind:
    | "missing_info"
    | "dependency"
    | "decision_needed"
    | "gate_failed"
    | "external";
  description: string;
  resolution: string | null;
  resolvedAt: string | null;
}

export interface QualityGate {
  id: string;
  workItemId: string;
  name: string;
  owner: AgentId;
  status: "pending" | "passed" | "failed" | "waived";
  notes: string | null;
}
