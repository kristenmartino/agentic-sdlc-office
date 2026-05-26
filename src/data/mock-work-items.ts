import type { WorkItem } from "../types/work-items";

export const MOCK_WORK_ITEMS: WorkItem[] = [
  {
    id: "wi_req-014",
    title: "Add dark mode to dashboard",
    kind: "feature",
    status: "captured",
    currentMode: "Intent",
    ownerAgent: "piper",
    humanDecisionNeeded: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
