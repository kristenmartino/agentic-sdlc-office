"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useOfficeStore } from "@/state/officeStore";
import { AGENT_COLORS } from "@/data/mock-agents";

export default function AgentDrawer() {
  const selectedId = useOfficeStore((s) => s.selectedAgentId);
  const agents = useOfficeStore((s) => s.agents);
  const close = useOfficeStore((s) => s.selectAgent);
  const artifacts = useOfficeStore((s) => s.artifacts);

  const agent = selectedId ? agents.find((a) => a.id === selectedId) : null;

  return (
    <AnimatePresence>
      {agent && (
        <motion.aside
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: "tween", duration: 0.18 }}
          className="fixed right-4 top-4 bottom-4 w-80 rounded-lg border border-office-line bg-office-panel/95 backdrop-blur p-4 z-10 overflow-y-auto"
          role="dialog"
          aria-label={`${agent.name} details`}
        >
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: AGENT_COLORS[agent.id] }}
              >
                {agent.name[0]}
              </div>
              <div>
                <h3 className="text-sm font-semibold">{agent.name}</h3>
                <p className="text-[10px] text-office-muted">{agent.role}</p>
              </div>
            </div>
            <button
              onClick={() => close(null)}
              className="text-office-muted hover:text-office-text text-sm"
              aria-label="Close drawer"
            >
              ×
            </button>
          </header>

          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-[11px]">
            <dt className="text-office-muted">Room</dt>
            <dd className="font-mono">{agent.currentRoom}</dd>
            <dt className="text-office-muted">Status</dt>
            <dd className="font-mono">{agent.status}</dd>
            <dt className="text-office-muted">Permission</dt>
            <dd className="font-mono">{agent.permissionLevel}</dd>
            <dt className="text-office-muted">Work item</dt>
            <dd className="font-mono">{agent.assignedWorkItemId ?? "—"}</dd>
            <dt className="text-office-muted">Blocked by</dt>
            <dd className="font-mono">{agent.blockedBy ?? "—"}</dd>
            <dt className="text-office-muted">Waiting on</dt>
            <dd className="font-mono">{agent.waitingOn ?? "—"}</dd>
            <dt className="text-office-muted">Next agent</dt>
            <dd className="font-mono">{agent.nextAgentId ?? "—"}</dd>
          </dl>

          {agent.message && (
            <div className="mt-4 rounded border border-office-line bg-office-bg/60 p-2">
              <p className="text-[10px] text-office-muted">Last message</p>
              <p className="text-xs mt-1">{agent.message}</p>
            </div>
          )}

          <div className="mt-4">
            <p className="text-[10px] text-office-muted uppercase tracking-wide">Artifacts produced</p>
            <ul className="mt-1 flex flex-col gap-1">
              {artifacts.filter((a) => a.producedBy === agent.id).map((a) => (
                <li key={a.id} className="text-[11px]">
                  <span className="font-mono text-office-muted">{a.kind}</span> — {a.summary}
                </li>
              ))}
              {artifacts.filter((a) => a.producedBy === agent.id).length === 0 && (
                <li className="text-[11px] text-office-muted">No artifacts yet.</li>
              )}
            </ul>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button disabled className="text-[10px] px-2 py-1 rounded border border-office-line text-office-muted">Chat (mock)</button>
            <button disabled className="text-[10px] px-2 py-1 rounded border border-office-line text-office-muted">Ask for summary (mock)</button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
