"use client";

import { useOfficeStore } from "@/state/officeStore";
import { SCENARIOS } from "@/data/scenarios";
import { MOCK_AGENTS, AGENT_COLORS } from "@/data/mock-agents";

/**
 * A compact horizontal ribbon showing the scenario's expected handoff chain.
 * Past steps are dim, current is highlighted, future steps are very dim.
 * Position is derived from the count of work_item.owner.changed events,
 * so it correctly handles agents that appear twice in the chain (e.g. Rune
 * in BUG-032: observer at start, reviewer near the end).
 *
 * When the run completes, the final pill flips to green and a trailing
 * "Done" indicator appears so the demo has a clear terminal state.
 */
export default function PhaseTimeline() {
  const scenarioId = useOfficeStore((s) => s.scenarioId);
  const log = useOfficeStore((s) => s.log);
  const runState = useOfficeStore((s) => s.runState);

  const chain = SCENARIOS[scenarioId].chain;
  const ownerChanges = log.filter((e) => e.type === "work_item.owner.changed").length;
  const position = ownerChanges - 1; // -1 before the first owner.changed fires
  const isCompleted = runState === "completed";

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto py-2 px-3 rounded-lg border border-office-line bg-office-panel/40"
      role="navigation"
      aria-label="Handoff timeline"
    >
      <span className="text-[9px] text-office-muted uppercase tracking-wide shrink-0 mr-2">
        Phase
      </span>
      {chain.map((agentId, idx) => {
        const agent = MOCK_AGENTS.find((a) => a.id === agentId)!;
        const isCurrent = idx === position;
        const isPast = idx < position;
        const isFinalAndDone = isCompleted && idx === chain.length - 1;

        const cls = isFinalAndDone
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
          : isCurrent
          ? "bg-cora/15 text-cora ring-1 ring-cora/40"
          : isPast
          ? "bg-office-line/60 text-office-muted"
          : "bg-transparent text-office-muted/40";
        return (
          <div key={`${agentId}-${idx}`} className="flex items-center gap-1 shrink-0">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 ${cls}`}>
              <span
                className="inline-block w-1.5 h-1.5 rounded-sm"
                style={{ backgroundColor: AGENT_COLORS[agentId] }}
                aria-hidden
              />
              {agent.name}
            </span>
            {idx < chain.length - 1 && (
              <span className={`text-[10px] ${isPast || isCurrent ? "text-office-muted" : "text-office-muted/30"}`}>
                →
              </span>
            )}
          </div>
        );
      })}
      {isCompleted && (
        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 shrink-0">
          ✓ Done
        </span>
      )}
    </div>
  );
}
