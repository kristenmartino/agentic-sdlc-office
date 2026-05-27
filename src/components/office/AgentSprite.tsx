"use client";

import { motion } from "framer-motion";
import type { AgentInstance } from "@/types/agents";
import { useOfficeStore } from "@/state/officeStore";
import StatusBubble from "./StatusBubble";
import AgentSilhouette from "./sprites";

interface Props {
  agent: AgentInstance;
}

export default function AgentSprite({ agent }: Props) {
  const select = useOfficeStore((s) => s.selectAgent);
  const selected = useOfficeStore((s) => s.selectedAgentId) === agent.id;

  const active = agent.status !== "idle" && agent.status !== "done";

  return (
    <motion.button
      // layoutId makes Framer Motion animate this sprite when it remounts in a different room
      // (i.e. when an agent.moved event fires and the parent Room changes).
      layoutId={`agent-${agent.id}`}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onClick={() => select(agent.id)}
      className={`relative flex flex-col items-center gap-1 focus:outline-none rounded-md p-0.5 ${
        selected ? "ring-2 ring-white/40" : ""
      }`}
      aria-label={`${agent.name}, ${agent.role}, status ${agent.status}`}
    >
      <div className="relative">
        <AgentSilhouette agentId={agent.id} size={36} active={active} />
        {agent.blockedBy && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-office-panel" />
        )}
        {agent.status === "done" && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-office-panel" />
        )}
        {agent.status === "waiting_on_human" && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-office-panel animate-pulse-soft" />
        )}
      </div>
      <span className="text-[10px] text-office-muted uppercase tracking-wide leading-none">
        {agent.name}
      </span>
      <StatusBubble status={agent.status} message={agent.message} />
    </motion.button>
  );
}
