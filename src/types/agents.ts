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
  | "reading"
  | "planning"
  | "designing"
  | "coding"
  | "testing"
  | "reviewing"
  | "talking"
  | "meeting"
  | "waiting_on_agent"
  | "waiting_on_human"
  | "blocked"
  | "done"
  | "failed";

export type PermissionLevel =
  | "P0"
  | "P1"
  | "P2"
  | "P3"
  | "P4"
  | "P5"
  | "P6"
  | "P7"
  | "human-only";

export interface AgentInstance {
  id: AgentId;
  name: string;
  role: string;
  primaryRoom: RoomId;
  primaryModes: ADLCMode[];
  currentRoom: RoomId;
  status: AgentStatus;
  permissionLevel: PermissionLevel;
  assignedWorkItemId: string | null;
  currentArtifactId: string | null;
  blockedBy: string | null;
  waitingOn: AgentId | "human" | null;
  nextAgentId: AgentId | null;
  lastAction: string | null;
  message: string | null;
}
