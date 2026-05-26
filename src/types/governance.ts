import type { AgentId } from "./agents";

export interface DecisionOption {
  id: string;
  label: string;
  pros: string[];
  cons: string[];
}

export interface Decision {
  id: string;
  workItem: string;
  question: string;
  options: DecisionOption[];
  recommendation: string | null;
  resolved: boolean;
  resolvedBy: AgentId | "human" | null;
  resolvedAt: string | null;
}

export interface Blocker {
  id: string;
  workItem: string;
  raisedBy: AgentId;
  kind: "missing_info" | "dependency" | "decision_needed" | "gate_failed" | "external";
  description: string;
  resolution?: string;
  resolvedAt?: string;
}

export interface QualityGate {
  id: string;
  workItem: string;
  name: string;
  owner: AgentId;
  status: "pending" | "passed" | "failed" | "waived";
  notes?: string;
}
