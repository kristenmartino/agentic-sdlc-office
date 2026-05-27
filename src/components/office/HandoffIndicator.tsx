"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useOfficeStore } from "@/state/officeStore";
import { MOCK_AGENTS, AGENT_COLORS } from "@/data/mock-agents";

export default function HandoffIndicator() {
  const workItem = useOfficeStore((s) => s.workItem);
  const artifacts = useOfficeStore((s) => s.artifacts);

  const fromId = workItem.ownerAgentId;
  const toId = workItem.nextAgentId;
  // Only render during the window between handoff.requested and work_item.owner.changed
  const inFlight = Boolean(fromId && toId);

  const lastArtifact = artifacts
    .filter((a) => a.workItemId === workItem.id)
    .slice(-1)[0];

  const fromAgent = fromId ? MOCK_AGENTS.find((a) => a.id === fromId) : null;
  const toAgent = toId ? MOCK_AGENTS.find((a) => a.id === toId) : null;

  return (
    <AnimatePresence>
      {inFlight && fromAgent && toAgent && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.18 }}
          className="rounded-lg border border-office-line bg-office-panel/80 px-3 py-2 flex items-center gap-3 text-[11px]"
          role="status"
          aria-label="Handoff in progress"
        >
          <span className="text-office-muted uppercase tracking-wide text-[9px]">Handoff in flight</span>
          <AgentPill name={fromAgent.name} color={AGENT_COLORS[fromAgent.id]} />
          <motion.span
            className="font-mono"
            animate={{ x: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
          >
            →
          </motion.span>
          <AgentPill name={toAgent.name} color={AGENT_COLORS[toAgent.id]} />
          {lastArtifact && (
            <span className="ml-auto text-office-muted font-mono">
              {lastArtifact.kind}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AgentPill({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-2.5 h-2.5 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="font-mono">{name}</span>
    </span>
  );
}
