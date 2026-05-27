import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AgentId, AgentInstance } from "@/types/agents";
import type { Artifact, WorkItem, ModeChange } from "@/types/work-items";
import type { Decision, Blocker, QualityGate } from "@/types/governance";
import type {
  WorkflowEvent,
  AgentStatusChangedPayload,
  WorkItemOwnerChangedPayload,
  WorkItemModeChangedPayload,
} from "@/types/workflow-events";

import { MOCK_AGENTS } from "@/data/mock-agents";
import { SCENARIOS, DEFAULT_SCENARIO_ID, type ScenarioId } from "@/data/scenarios";

const STORAGE_NAME = "agentic-sdlc-office";
const STORAGE_VERSION = 1;

type RunState = "idle" | "running" | "awaiting_human" | "paused" | "completed";

export interface OfficeState {
  scenarioId: ScenarioId;
  agents: AgentInstance[];
  workItem: WorkItem;
  decisions: Decision[];
  blockers: Blocker[];
  qualityGates: QualityGate[];
  artifacts: Artifact[];
  log: WorkflowEvent[];
  cursor: number;
  runState: RunState;
  pendingResolutions: Set<string>;
  selectedAgentId: AgentId | null;
  workItemDrawerOpen: boolean;

  // Actions
  start: () => void;
  pause: () => void;
  reset: () => void;
  loadScenario: (id: ScenarioId) => void;
  tick: () => void;
  seekTo: (targetCursor: number) => void;
  resolveDecision: (decisionId: string, chosenOptionId: string) => void;
  resolveApproval: (approvalId: string, granted: boolean) => void;
  selectAgent: (id: AgentId | null) => void;
  openWorkItemDrawer: () => void;
  closeWorkItemDrawer: () => void;
}

const initialAgents = (): AgentInstance[] => structuredClone(MOCK_AGENTS);
const initialWorkItem = (id: ScenarioId): WorkItem => structuredClone(SCENARIOS[id].initialWorkItem);

function freshState(id: ScenarioId): Pick<
  OfficeState,
  | "scenarioId"
  | "agents"
  | "workItem"
  | "decisions"
  | "blockers"
  | "qualityGates"
  | "artifacts"
  | "log"
  | "cursor"
  | "runState"
  | "pendingResolutions"
  | "selectedAgentId"
  | "workItemDrawerOpen"
> {
  return {
    scenarioId: id,
    agents: initialAgents(),
    workItem: initialWorkItem(id),
    decisions: [],
    blockers: [],
    qualityGates: [],
    artifacts: [],
    log: [],
    cursor: 0,
    runState: "idle",
    pendingResolutions: new Set<string>(),
    selectedAgentId: null,
    workItemDrawerOpen: false,
  };
}

export const useOfficeStore = create<OfficeState>()(
  persist(
    (set, get) => ({
      ...freshState(DEFAULT_SCENARIO_ID),

      start: () => set({ runState: "running" }),
      pause: () => set({ runState: "paused" }),
      reset: () => set(freshState(get().scenarioId)),
      loadScenario: (id) => set(freshState(id)),

      tick: () => {
        const state = get();
        if (state.runState !== "running") return;
        const events = SCENARIOS[state.scenarioId].events;
        const next = events[state.cursor];
        if (!next) {
          set({ runState: "completed" });
          return;
        }
        // Wait for human input on resolved events
        if (next.type === "decision.resolved" || next.type === "approval.resolved") {
          if (!state.pendingResolutions.has(next.subject)) return;
        }
        const patch = applyEvent(state, next);
        // After surfacing a decision or approval, drop to awaiting_human until the user resolves it.
        if (next.type === "decision.requested" || next.type === "approval.requested") {
          patch.runState = "awaiting_human";
        }
        set(patch);
      },

      seekTo: (targetCursor) => {
        const state = get();
        const events = SCENARIOS[state.scenarioId].events;
        const target = Math.max(0, Math.min(targetCursor, events.length));

        // Pre-populate pending resolutions so any *.resolved events in range apply.
        const pending = new Set<string>();
        for (let i = 0; i < target; i++) {
          const e = events[i];
          if (e.type === "decision.resolved" || e.type === "approval.resolved") {
            pending.add(e.subject);
          }
        }

        // Start from a fresh scenario state, keep the actions from current store.
        let next: OfficeState = {
          ...state,
          ...freshState(state.scenarioId),
          pendingResolutions: pending,
        };

        for (let i = 0; i < target; i++) {
          const patch = applyEvent(next, events[i]);
          next = { ...next, ...patch };
        }

        set({ ...next, runState: target >= events.length ? "completed" : "paused" });
      },

      resolveDecision: (decisionId, chosenOptionId) =>
        set((s) => {
          const pending = new Set(s.pendingResolutions);
          pending.add(decisionId);
          return {
            decisions: s.decisions.map((d) =>
              d.id === decisionId
                ? { ...d, resolved: true, chosenOptionId, resolvedBy: "human", resolvedAt: new Date().toISOString() }
                : d
            ),
            pendingResolutions: pending,
            // If we were waiting on this, resume the tick loop.
            runState: s.runState === "awaiting_human" ? "running" : s.runState,
          };
        }),

      resolveApproval: (approvalId, granted) =>
        set((s) => {
          const pending = new Set(s.pendingResolutions);
          pending.add(approvalId);
          return {
            decisions: s.decisions.map((d) =>
              d.id === approvalId
                ? {
                    ...d,
                    resolved: true,
                    chosenOptionId: granted ? "approve" : "deny",
                    resolvedBy: "human",
                    resolvedAt: new Date().toISOString(),
                  }
                : d
            ),
            pendingResolutions: pending,
            runState: s.runState === "awaiting_human" ? "running" : s.runState,
          };
        }),

      selectAgent: (id) => set({ selectedAgentId: id }),
      openWorkItemDrawer: () => set({ workItemDrawerOpen: true }),
      closeWorkItemDrawer: () => set({ workItemDrawerOpen: false }),
    }),
    {
      name: STORAGE_NAME,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? (noopStorage as unknown as Storage) : localStorage
      ),
      partialize: (state) => ({
        scenarioId: state.scenarioId,
        agents: state.agents,
        workItem: state.workItem,
        decisions: state.decisions,
        blockers: state.blockers,
        qualityGates: state.qualityGates,
        artifacts: state.artifacts,
        log: state.log,
        cursor: state.cursor,
        // Set → Array for JSON
        pendingResolutions: Array.from(state.pendingResolutions),
        // Omit: runState (forced on rehydrate), selectedAgentId, workItemDrawerOpen (UI transient)
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== "object") return current;
        const p = persisted as Record<string, unknown>;
        const pendingArray = Array.isArray(p.pendingResolutions)
          ? (p.pendingResolutions as string[])
          : [];
        const log = Array.isArray(p.log) ? (p.log as WorkflowEvent[]) : [];
        return {
          ...current,
          ...(p as Partial<OfficeState>),
          pendingResolutions: new Set<string>(pendingArray),
          // Force runState on rehydrate: paused if mid-run, completed if finished, idle otherwise.
          runState:
            log.length === 0
              ? "idle"
              : SCENARIOS[(p.scenarioId as ScenarioId) ?? DEFAULT_SCENARIO_ID].events.length ===
                (p.cursor as number)
              ? "completed"
              : "paused",
          // Reset transient UI on refresh
          selectedAgentId: null,
          workItemDrawerOpen: false,
        };
      },
    }
  )
);

// SSR fallback: no-op storage so persist's initial pass doesn't crash during build.
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** Apply a single event to state. Pure with respect to its inputs. */
function applyEvent(state: OfficeState, event: WorkflowEvent): Partial<OfficeState> {
  const patch: Partial<OfficeState> = { log: [...state.log, event], cursor: state.cursor + 1 };

  switch (event.type) {
    case "run.started":
      patch.runState = "running";
      break;
    case "run.completed":
      patch.runState = "completed";
      break;

    case "work_item.created":
      patch.workItem = {
        ...state.workItem,
        title: (event.payload.title as string | undefined) ?? state.workItem.title,
        status: "captured",
      };
      break;

    case "work_item.refined": {
      const payload = event.payload as { acceptance?: string[]; outOfScope?: string[] };
      patch.workItem = {
        ...state.workItem,
        status: "refined",
        acceptance: payload.acceptance ?? state.workItem.acceptance,
        outOfScope: payload.outOfScope ?? state.workItem.outOfScope,
        updatedAt: event.ts,
      };
      break;
    }

    case "work_item.owner.changed": {
      const payload = event.payload as unknown as WorkItemOwnerChangedPayload;
      const wi = state.workItem;
      const assigned = wi.assignedAgentIds.includes(payload.to)
        ? wi.assignedAgentIds
        : [...wi.assignedAgentIds, payload.to];
      patch.workItem = {
        ...wi,
        ownerAgentId: payload.to,
        nextAgentId: null,
        assignedAgentIds: assigned,
        currentPhase: phaseFor(payload.to),
        updatedAt: event.ts,
      };
      patch.agents = state.agents.map((a) =>
        a.id === payload.to ? { ...a, assignedWorkItemId: wi.id } : a
      );
      break;
    }

    case "work_item.mode.changed": {
      const payload = event.payload as unknown as WorkItemModeChangedPayload;
      const change: ModeChange = { ts: event.ts, from: payload.from, to: payload.to, by: event.actor as AgentId };
      patch.workItem = {
        ...state.workItem,
        currentMode: payload.to,
        modeHistory: [...state.workItem.modeHistory, change],
        updatedAt: event.ts,
      };
      break;
    }

    case "work_item.completed":
      patch.workItem = { ...state.workItem, status: "done", updatedAt: event.ts };
      break;

    case "agent.status.changed": {
      const payload = event.payload as unknown as AgentStatusChangedPayload;
      patch.agents = state.agents.map((a) =>
        a.id === payload.agentId
          ? { ...a, status: payload.to, message: payload.message ?? a.message, lastAction: payload.message ?? a.lastAction }
          : a
      );
      break;
    }

    case "agent.moved": {
      const payload = event.payload as { agentId: AgentId; from: string; to: string };
      patch.agents = state.agents.map((a) =>
        a.id === payload.agentId ? { ...a, currentRoom: payload.to as AgentInstance["currentRoom"] } : a
      );
      break;
    }

    case "agent.message.sent": {
      const payload = event.payload as { agentId: AgentId; message: string };
      patch.agents = state.agents.map((a) =>
        a.id === payload.agentId ? { ...a, message: payload.message, lastAction: payload.message } : a
      );
      break;
    }

    case "handoff.requested": {
      const payload = event.payload as { fromAgentId: AgentId; toAgentId: AgentId };
      patch.workItem = { ...state.workItem, nextAgentId: payload.toAgentId, updatedAt: event.ts };
      patch.agents = state.agents.map((a) =>
        a.id === payload.fromAgentId ? { ...a, nextAgentId: payload.toAgentId } : a
      );
      break;
    }

    case "artifact.produced": {
      const payload = event.payload as { artifact: Artifact };
      patch.artifacts = [...state.artifacts, payload.artifact];
      patch.workItem = {
        ...state.workItem,
        artifactIds: [...state.workItem.artifactIds, payload.artifact.id],
        updatedAt: event.ts,
      };
      patch.agents = state.agents.map((a) =>
        a.id === payload.artifact.producedBy ? { ...a, currentArtifactId: payload.artifact.id } : a
      );
      break;
    }

    case "decision.requested": {
      const payload = event.payload as { decision: Decision };
      patch.decisions = [...state.decisions, payload.decision];
      patch.workItem = {
        ...state.workItem,
        humanDecisionNeeded: true,
        decisionIds: [...state.workItem.decisionIds, payload.decision.id],
        updatedAt: event.ts,
      };
      break;
    }

    case "decision.resolved": {
      const payload = event.payload as { decisionId: string; chosenOptionId: string };
      patch.decisions = state.decisions.map((d) =>
        d.id === payload.decisionId
          ? {
              ...d,
              resolved: true,
              chosenOptionId: payload.chosenOptionId,
              resolvedBy: "human",
              resolvedAt: event.ts,
            }
          : d
      );
      // If no other open decisions, clear humanDecisionNeeded
      const stillOpen = patch.decisions.some((d) => !d.resolved);
      patch.workItem = { ...state.workItem, humanDecisionNeeded: stillOpen, updatedAt: event.ts };
      break;
    }

    case "blocker.raised": {
      const payload = event.payload as { blocker: Blocker };
      patch.blockers = [...state.blockers, payload.blocker];
      patch.workItem = {
        ...state.workItem,
        blockerIds: [...state.workItem.blockerIds, payload.blocker.id],
        updatedAt: event.ts,
      };
      patch.agents = state.agents.map((a) =>
        a.id === payload.blocker.raisedBy ? { ...a, blockedBy: payload.blocker.id } : a
      );
      break;
    }

    case "blocker.cleared": {
      const payload = event.payload as { blockerId: string; resolution?: string };
      patch.blockers = state.blockers.map((b) =>
        b.id === payload.blockerId
          ? { ...b, resolution: payload.resolution ?? "Cleared", resolvedAt: event.ts }
          : b
      );
      patch.agents = state.agents.map((a) =>
        a.blockedBy === payload.blockerId ? { ...a, blockedBy: null } : a
      );
      break;
    }

    case "quality_gate.passed":
    case "quality_gate.failed": {
      const payload = event.payload as { gate: QualityGate };
      const next: QualityGate = { ...payload.gate, status: event.type === "quality_gate.passed" ? "passed" : "failed" };
      patch.qualityGates = [...state.qualityGates, next];
      patch.workItem = {
        ...state.workItem,
        qualityGateIds: [...state.workItem.qualityGateIds, next.id],
        updatedAt: event.ts,
      };
      break;
    }

    case "approval.requested": {
      const payload = event.payload as {
        approval: { id: string; workItemId: string; action: string; level: string; raisedBy: AgentId };
      };
      // Model approvals as a decision with two synthetic options.
      const asDecision: Decision = {
        id: payload.approval.id,
        workItemId: payload.approval.workItemId,
        question: payload.approval.action,
        context: `Permission level required: ${payload.approval.level}. Raised by ${payload.approval.raisedBy}.`,
        options: [
          { id: "approve", label: "Approve", pros: ["Unblocks work item"], cons: [] },
          { id: "deny", label: "Deny", pros: ["Halts dangerous action"], cons: ["Work item stays in Govern"] },
        ],
        recommendation: "approve",
        raisedBy: payload.approval.raisedBy,
        resolved: false,
        chosenOptionId: null,
        resolvedBy: null,
        resolvedAt: null,
        reversible: "no",
      };
      patch.decisions = [...state.decisions, asDecision];
      patch.workItem = {
        ...state.workItem,
        humanDecisionNeeded: true,
        decisionIds: [...state.workItem.decisionIds, asDecision.id],
        updatedAt: event.ts,
      };
      break;
    }

    case "approval.resolved": {
      const payload = event.payload as { approvalId: string; granted: boolean };
      patch.decisions = state.decisions.map((d) =>
        d.id === payload.approvalId
          ? {
              ...d,
              resolved: true,
              chosenOptionId: payload.granted ? "approve" : "deny",
              resolvedBy: "human",
              resolvedAt: event.ts,
            }
          : d
      );
      const stillOpen = patch.decisions.some((d) => !d.resolved);
      patch.workItem = { ...state.workItem, humanDecisionNeeded: stillOpen, updatedAt: event.ts };
      break;
    }

    default:
      // unhandled types: handoff.accepted, agent.moved, etc. log only.
      break;
  }

  return patch;
}

function phaseFor(agent: AgentId): string {
  switch (agent) {
    case "piper": return "Capturing intent";
    case "nova": return "Researching";
    case "theo": return "Planning";
    case "iris": return "Designing UI";
    case "mira": return "Building";
    case "tess": return "Testing";
    case "rune": return "Reviewing";
    case "cora": return "Routing to human";
  }
}
