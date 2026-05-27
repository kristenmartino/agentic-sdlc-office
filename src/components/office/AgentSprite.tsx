"use client";

import { AGENT_COLORS } from "@/data/mock-agents";
import type { AgentInstance } from "@/types/agents";
import { useOfficeStore } from "@/state/officeStore";
import StatusBubble from "./StatusBubble";

interface Props {
  agent: AgentInstance;
}

export default function AgentSprite({ agent }: Props) {
  const select = useOfficeStore((s) => s.selectAgent);
  const selected = useOfficeStore((s) => s.selectedAgentId) === agent.id;
  const color = AGENT_COLORS[agent.id] ?? "#888";
  const initial = agent.name[0];

  const active = agent.status !== "idle" && agent.status !== "done";

  return (
    <button
      onClick={() => select(agent.id)}
      className={`relative flex flex-col items-center gap-1 focus:outline-none ${selected ? "ring-2 ring-white/40 rounded-md" : ""}`}
      aria-label={`${agent.name}, ${agent.role}, status ${agent.status}`}
    >
      <div
        className={`relative w-9 h-9 rounded-md flex items-center justify-center text-white text-sm font-semibold shadow-md transition-transform ${active ? "animate-breathe" : ""}`}
        style={{ backgroundColor: color }}
      >
        {initial}
        {agent.blockedBy && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-office-panel" />
        )}
        {agent.status === "done" && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-office-panel" />
        )}
      </div>
      <span className="text-[10px] text-office-muted uppercase tracking-wide">{agent.name}</span>
      <StatusBubble status={agent.status} message={agent.message} />
    </button>
  );
}
