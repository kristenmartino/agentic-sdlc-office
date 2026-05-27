"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useOfficeStore } from "@/state/officeStore";
import { MOCK_AGENTS, AGENT_COLORS } from "@/data/mock-agents";

export default function HandoffIndicator() {
  const workItem = useOfficeStore((s) => s.workItem);
  const artifacts = useOfficeStore((s) => s.artifacts);

  const fromId = workItem.ownerAgentId;
  const toId = workItem.nextAgentId;
  const inFlight = Boolean(fromId && toId);

  const lastArtifact = artifacts.filter((a) => a.workItemId === workItem.id).slice(-1)[0];
  const fromAgent = fromId ? MOCK_AGENTS.find((a) => a.id === fromId) : null;
  const toAgent = toId ? MOCK_AGENTS.find((a) => a.id === toId) : null;

  return (
    <AnimatePresence>
      {inFlight && fromAgent && toAgent && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="rounded-lg border border-cora/40 bg-gradient-to-r from-office-panel via-office-panel to-amber-950/30 px-4 py-3 flex items-center gap-4 shadow-[0_0_20px_rgba(230,162,60,0.08)]"
          role="status"
          aria-label="Handoff in progress"
        >
          <div className="flex flex-col">
            <span className="text-cora uppercase tracking-wider text-[9px] font-semibold">
              ⇢ Handoff in flight
            </span>
            {lastArtifact && (
              <span className="text-office-muted text-[10px] font-mono mt-0.5">
                {lastArtifact.kind} · {lastArtifact.summary.slice(0, 60)}
                {lastArtifact.summary.length > 60 ? "…" : ""}
              </span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-end gap-3">
            <AgentPill name={fromAgent.name} color={AGENT_COLORS[fromAgent.id]} role={fromAgent.role} />
            <motion.span
              className="font-mono text-cora text-lg"
              animate={{ x: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
              aria-hidden
            >
              →
            </motion.span>
            <AgentPill name={toAgent.name} color={AGENT_COLORS[toAgent.id]} role={toAgent.role} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AgentPill({ name, color, role }: { name: string; color: string; role: string }) {
  return (
    <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-office-panel/80 border border-office-line">
      <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} aria-hidden />
      <span className="text-xs font-semibold text-office-text">{name}</span>
      <span className="text-[9px] text-office-muted hidden sm:inline">{role.split("/")[0].trim()}</span>
    </span>
  );
}
