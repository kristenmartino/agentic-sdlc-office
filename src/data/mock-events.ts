import type { WorkflowEvent } from "../types/workflow-events";

export const MOCK_EVENTS: WorkflowEvent[] = [
  {
    id: "evt_0001",
    ts: new Date().toISOString(),
    actor: "human",
    type: "work_item.created",
    subject: "wi_req-014",
    payload: { title: "Add dark mode to dashboard" },
  },
];
