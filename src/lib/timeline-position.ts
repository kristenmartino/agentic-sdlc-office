import type { AgentId } from "@/types/agents";
import type { WorkflowEvent } from "@/types/workflow-events";
import type { ScenarioSource } from "@/data/scenarios";

/**
 * Where to highlight on the phase timeline, given the current log.
 *
 * Scripted scenarios assume a 1:1 chain ↔ owner.changed sequence — the
 * validator guarantees the lengths match. Observed scenarios don't: a single
 * agent can swap ownership with itself multiple times (e.g. a long-running
 * Mira session that fires several `owner.changed → mira` events), so we
 * collapse adjacent duplicates before counting, matching `deriveChainFromEvents`.
 *
 * Returns -1 before the first owner.changed has fired — the ribbon then
 * shows everything as future. Clamps to `chain.length - 1` if the session
 * emits more distinct owners than the chain knows about, so the highlight
 * never disappears off the right edge.
 */
export function timelinePosition(
  log: WorkflowEvent[],
  chain: AgentId[],
  source: ScenarioSource,
): number {
  if (chain.length === 0) return -1;

  if (source === "scripted") {
    const ownerChanges = log.filter((e) => e.type === "work_item.owner.changed").length;
    if (ownerChanges === 0) return -1;
    return Math.min(ownerChanges - 1, chain.length - 1);
  }

  let count = 0;
  let last: AgentId | null = null;
  for (const event of log) {
    if (event.type !== "work_item.owner.changed") continue;
    const to = (event.payload as { to?: AgentId }).to;
    if (!to || to === last) continue;
    last = to;
    count += 1;
  }
  if (count === 0) return -1;
  return Math.min(count - 1, chain.length - 1);
}
