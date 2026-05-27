import type { WorkItem } from "../types/work-items";

export const REQ_014_ID = "wi_req-014";

export const MOCK_WORK_ITEMS: WorkItem[] = [
  {
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
  },
];
