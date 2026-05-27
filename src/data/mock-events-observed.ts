import type { WorkflowEvent } from "../types/workflow-events";
import type { WorkItem } from "../types/work-items";
import observedJson from "./observed-sample.json";

/**
 * v0.2 PREVIEW — sample 'observed' session.
 *
 * The shape of `observed-sample.json` is what a Claude Code log parser will
 * eventually produce. For v0.1 it is hand-authored so the office can render
 * an end-to-end observed run without any parser wiring yet.
 *
 * Read-only by contract: no decisions, no approvals, single-agent chain.
 * If you add events that need human input, the observer mode UI will hide
 * the resolve controls — that's the read-only guardrail, not a bug.
 */

interface ObservedSessionFile {
  origin: {
    source: string;
    sessionId: string;
    capturedAt: string;
    note?: string;
  };
  workItem: WorkItem;
  chain: string[];
  events: WorkflowEvent[];
}

const file = observedJson as unknown as ObservedSessionFile;

export const OBSERVED_SAMPLE_ID = file.workItem.id;
export const OBSERVED_SAMPLE_INITIAL: WorkItem = structuredClone(file.workItem);
export const OBSERVED_SAMPLE_EVENTS: WorkflowEvent[] = structuredClone(file.events);
export const OBSERVED_SAMPLE_CHAIN = structuredClone(file.chain);
export const OBSERVED_SAMPLE_ORIGIN = structuredClone(file.origin);
