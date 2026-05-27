"use client";

import type { AgentInstance } from "@/types/agents";
import type { Room as RoomType } from "@/types/rooms";
import AgentSprite from "./AgentSprite";

interface Props {
  room: RoomType;
  agents: AgentInstance[];
  emphasis?: boolean; // larger / warmer if Human Office
}

export default function Room({ room, agents, emphasis }: Props) {
  return (
    <div
      className={`relative rounded-lg border border-office-line bg-office-panel/60 p-3 flex flex-col gap-2 min-h-[140px] ${
        emphasis ? "ring-1 ring-cora/40 shadow-[0_0_24px_rgba(230,162,60,0.08)]" : ""
      }`}
    >
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-office-text">{room.name}</h3>
        <span className="text-[10px] text-office-muted">{agents.length}</span>
      </header>
      {room.description && (
        <p className="text-[10px] text-office-muted leading-tight">{room.description}</p>
      )}
      <div className="flex flex-wrap gap-2 mt-auto">
        {agents.map((a) => (
          <AgentSprite key={a.id} agent={a} />
        ))}
      </div>
    </div>
  );
}
