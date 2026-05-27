"use client";

import type { AgentInstance } from "@/types/agents";
import type { Room as RoomType } from "@/types/rooms";
import AgentSprite from "./AgentSprite";
import RoomDecor from "./room-decor";

interface Props {
  room: RoomType;
  agents: AgentInstance[];
  emphasis?: boolean;
}

export default function Room({ room, agents, emphasis }: Props) {
  return (
    <div
      className={`relative rounded-lg border p-3 flex flex-col gap-2 min-h-[160px] overflow-hidden transition-shadow ${
        emphasis
          ? "border-cora/30 bg-gradient-to-br from-amber-950/30 via-office-panel/80 to-office-panel/40 shadow-[0_0_32px_rgba(230,162,60,0.12),inset_0_0_24px_rgba(230,162,60,0.04)] ring-1 ring-cora/30"
          : "border-office-line bg-office-panel/60"
      }`}
    >
      {emphasis && (
        <span
          className="absolute top-2 left-2 px-1.5 py-0.5 rounded-sm text-[9px] font-semibold uppercase tracking-wider bg-cora/20 text-cora ring-1 ring-cora/40"
          aria-hidden
        >
          You
        </span>
      )}
      <div className="absolute top-2 right-2 pointer-events-none">
        <RoomDecor roomId={room.id} size={emphasis ? 40 : 36} />
      </div>
      <header className={emphasis ? "mt-5" : ""}>
        <h3
          className={`text-xs font-semibold uppercase tracking-wide leading-tight ${
            emphasis ? "text-cora" : "text-office-text"
          }`}
        >
          {room.name}
        </h3>
        {room.description && (
          <p className="text-[10px] text-office-muted leading-snug mt-0.5 pr-10">
            {room.description}
          </p>
        )}
      </header>
      <div className="flex flex-wrap gap-2.5 mt-auto pt-2">
        {agents.map((a) => (
          <AgentSprite key={a.id} agent={a} />
        ))}
      </div>
      {agents.length === 0 && (
        <p className="text-[10px] text-office-muted/60 italic mt-auto">— empty —</p>
      )}
    </div>
  );
}
