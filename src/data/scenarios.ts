import type { WorkItem, WorkItemKind } from "../types/work-items";
import type { WorkflowEvent } from "../types/workflow-events";
import type { AgentId } from "../types/agents";
import { REQ_014_EVENTS } from "./mock-events-req014";
import { BUG_032_EVENTS } from "./mock-events-bug032";
import { REQ_014_INITIAL, BUG_032_INITIAL } from "./mock-work-items";
import {
  OBSERVED_SAMPLE_EVENTS,
  OBSERVED_SAMPLE_INITIAL,
  OBSERVED_SAMPLE_CHAIN,
  OBSERVED_SAMPLE_ORIGIN,
} from "./mock-events-observed";

export type ScenarioId = "req-014" | "bug-032" | "observed-sample";

/**
 * Where a scenario's events come from.
 *
 * - `scripted` — hand-authored event stream. Decisions and approvals are
 *   surfaced for human resolution; this is the v0.1 default.
 * - `observed` — sourced from a parsed Claude Code session (today: a static
 *   fixture; v0.2: a real transcript). Read-only in the UI: no resolve
 *   buttons, no edits. See [docs/architecture/observer-spike.md].
 */
export type ScenarioSource = "scripted" | "observed";

export interface Scenario {
  id: ScenarioId;
  title: string;
  subtitle: string;
  kind: WorkItemKind;
  source: ScenarioSource;
  initialWorkItem: WorkItem;
  events: WorkflowEvent[];
  /** Expected handoff order. Drives the PhaseTimeline ribbon. */
  chain: AgentId[];
  /** Present for observed scenarios — origin of the captured session. */
  origin?: {
    source: string;
    sessionId: string;
    capturedAt: string;
    note?: string;
  };
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  "req-014": {
    id: "req-014",
    title: "REQ-014 — Add dark mode",
    subtitle: "Happy-path feature. 8-agent handoff. 1 decision, 1 approval.",
    kind: "feature",
    source: "scripted",
    initialWorkItem: REQ_014_INITIAL,
    events: REQ_014_EVENTS,
    chain: ["piper", "nova", "theo", "iris", "mira", "tess", "rune", "cora"],
  },
  "bug-032": {
    id: "bug-032",
    title: "BUG-032 — Filter loses date range",
    subtitle: "Observe → Intent loop. Rune raises anomaly. Roll-forward decision, expedited hotfix.",
    kind: "bug",
    source: "scripted",
    initialWorkItem: BUG_032_INITIAL,
    events: BUG_032_EVENTS,
    // Rune appears twice — once as observer, once as reviewer. UI dedupes by position.
    chain: ["rune", "piper", "nova", "theo", "mira", "tess", "rune", "cora"],
  },
  "observed-sample": {
    id: "observed-sample",
    title: "Observed — Refactor button (v0.2 preview)",
    subtitle: "Local Claude Code session, single agent. Read-only — no decisions, no handoffs.",
    kind: "feature",
    source: "observed",
    initialWorkItem: OBSERVED_SAMPLE_INITIAL,
    events: OBSERVED_SAMPLE_EVENTS,
    chain: OBSERVED_SAMPLE_CHAIN as AgentId[],
    origin: OBSERVED_SAMPLE_ORIGIN,
  },
};

export const SCENARIO_LIST: Scenario[] = [
  SCENARIOS["req-014"],
  SCENARIOS["bug-032"],
  SCENARIOS["observed-sample"],
];

export const DEFAULT_SCENARIO_ID: ScenarioId = "req-014";
