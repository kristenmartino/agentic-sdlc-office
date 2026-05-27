import type { WorkItem } from "../types/work-items";

export const REQ_014_ID = "wi_req-014";
export const BUG_032_ID = "wi_bug-032";

export const REQ_014_INITIAL: WorkItem = {
  id: REQ_014_ID,
  title: "REQ-014 — Add dark mode to dashboard",
  kind: "feature",
  status: "captured",
  currentMode: "Intent",
  currentPhase: "Awaiting intent capture",
  ownerAgentId: null,
  nextAgentId: "piper",
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
  createdAt: "2026-05-26T18:00:00.000Z",
  updatedAt: "2026-05-26T18:00:00.000Z",
};

export const BUG_032_INITIAL: WorkItem = {
  id: BUG_032_ID,
  title: "BUG-032 — Dashboard filter drops the date range",
  kind: "bug",
  status: "captured",
  currentMode: "Observe",
  currentPhase: "Awaiting observation review",
  ownerAgentId: null,
  nextAgentId: "rune",
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
  createdAt: "2026-05-27T03:14:00.000Z",
  updatedAt: "2026-05-27T03:14:00.000Z",
};

/** @deprecated kept for backward compat; use scenarios.ts going forward */
export const MOCK_WORK_ITEMS: WorkItem[] = [REQ_014_INITIAL, BUG_032_INITIAL];
