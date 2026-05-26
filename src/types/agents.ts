import type { ADLCMode } from "./adlc";
import type { RoomId } from "./rooms";

export type AgentId =
  | "cora"
  | "piper"
  | "nova"
  | "theo"
  | "iris"
  | "mira"
  | "tess"
  | "rune";

export type AgentStatus =
  | "idle"
  | "thinking"
  | "working"
  | "talking"
  | "blocked"
  | "escalating"
  | "celebrating";

export interface AgentInstance {
  id: AgentId;
  name: string;
  role: string;
  primaryRoom: RoomId;
  primaryModes: ADLCMode[];
  currentRoom: RoomId;
  status: AgentStatus;
}
