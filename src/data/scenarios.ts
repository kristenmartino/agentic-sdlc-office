import type { WorkItem, WorkItemKind } from "../types/work-items";
import type { WorkflowEvent } from "../types/workflow-events";
import { REQ_014_EVENTS } from "./mock-events-req014";
import { BUG_032_EVENTS } from "./mock-events-bug032";
import { REQ_014_INITIAL, BUG_032_INITIAL } from "./mock-work-items";

export type ScenarioId = "req-014" | "bug-032";

export interface Scenario {
  id: ScenarioId;
  title: string;
  subtitle: string;
  kind: WorkItemKind;
  initialWorkItem: WorkItem;
  events: WorkflowEvent[];
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  "req-014": {
    id: "req-014",
    title: "REQ-014 — Add dark mode",
    subtitle: "Happy-path feature. 8-agent handoff. 1 decision, 1 approval.",
    kind: "feature",
    initialWorkItem: REQ_014_INITIAL,
    events: REQ_014_EVENTS,
  },
  "bug-032": {
    id: "bug-032",
    title: "BUG-032 — Filter loses date range",
    subtitle: "Observe → Intent loop. Rune raises anomaly. Roll-forward decision, expedited hotfix.",
    kind: "bug",
    initialWorkItem: BUG_032_INITIAL,
    events: BUG_032_EVENTS,
  },
};

export const SCENARIO_LIST: Scenario[] = [SCENARIOS["req-014"], SCENARIOS["bug-032"]];

export const DEFAULT_SCENARIO_ID: ScenarioId = "req-014";
