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
      className={`relative rounded-lg border border-office-line bg-office-panel/60 p-3 flex flex-col gap-2 min-h-[150px] overflow-hidden ${
        emphasis ? "ring-1 ring-cora/40 shadow-[0_0_24px_rgba(230,162,60,0.08)] bg-gradient-to-br from-office-panel/80 to-amber-950/20" : ""
      }`}
    >
      <div className="absolute top-2 right-2 pointer-events-none">
        <RoomDecor roomId={room.id} size={36} />
      </div>
      <header>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-office-text leading-tight">
          {room.name}
        </h3>
        {room.description && (
          <p className="text-[10px] text-office-muted leading-snug mt-0.5 pr-10">
            {room.description}
          </p>
        )}
      </header>
      <div className="flex flex-wrap gap-2 mt-auto pt-2">
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
