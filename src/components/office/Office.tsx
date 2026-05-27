"use client";

import { MOCK_ROOMS, ROOM_GRID } from "@/data/mock-rooms";
import { useOfficeStore } from "@/state/officeStore";
import Room from "./Room";

export default function Office() {
  const agents = useOfficeStore((s) => s.agents);

  const byRoom = (id: string) => agents.filter((a) => a.currentRoom === id);
  const roomById = (id: string) => MOCK_ROOMS.find((r) => r.id === id)!;

  return (
    <div className="grid grid-cols-4 gap-3" role="region" aria-label="Office floor">
      {ROOM_GRID.flat().map((roomId) => {
        const room = roomById(roomId);
        return (
          <Room
            key={roomId}
            room={room}
            agents={byRoom(roomId)}
            emphasis={roomId === "human-office"}
          />
        );
      })}
    </div>
  );
}
