import type { AgentId } from "../types/agents";
import type { WorkflowEvent } from "../types/workflow-events";
import type { WorkItem } from "../types/work-items";
import type { ParsedClaudeCodeSession } from "../lib/claude-code-parser";
import { sessionFromFixture } from "../lib/claude-code-parser";
import observedJson from "./observed-sample.json";

/**
 * v0.2 PREVIEW — sample 'observed' session.
 *
 * The JSON file at `observed-sample.json` is exactly the shape the real
 * Claude Code parser will eventually return — `origin`, `workItem`, `chain`,
 * and `events`. For v0.1 we hand-author it so the office can render an
 * end-to-end observed run without any parser wiring yet.
 *
 * Going through `sessionFromFixture` is deliberate: it routes fixture-driven
 * code through the same function the real parser output will go through,
 * and the deep-clone guarantees downstream mutation can't corrupt the
 * imported JSON.
 *
 * Read-only by contract: no decisions, no approvals. If events that need
 * human input get added, the validator will reject them. That's the
 * read-only guardrail, not a bug.
 */

interface ObservedSessionFile {
  origin: ParsedClaudeCodeSession["origin"];
  workItem: WorkItem;
  chain: AgentId[];
  events: WorkflowEvent[];
}

const file = observedJson as unknown as ObservedSessionFile;
const session: ParsedClaudeCodeSession = sessionFromFixture({
  origin: file.origin,
  workItem: file.workItem,
  chain: file.chain,
  events: file.events,
});

export const OBSERVED_SAMPLE_ID = session.workItem.id;
export const OBSERVED_SAMPLE_INITIAL: WorkItem = session.workItem;
export const OBSERVED_SAMPLE_EVENTS: WorkflowEvent[] = session.events;
export const OBSERVED_SAMPLE_CHAIN: AgentId[] = session.chain;
export const OBSERVED_SAMPLE_ORIGIN = session.origin;
export const OBSERVED_SAMPLE_SESSION: ParsedClaudeCodeSession = session;
