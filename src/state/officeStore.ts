import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AgentId, AgentInstance } from "@/types/agents";
import type { Artifact, WorkItem } from "@/types/work-items";
import type { Decision, Blocker, QualityGate } from "@/types/governance";
import type { WorkflowEvent } from "@/types/workflow-events";

import { MOCK_AGENTS } from "@/data/mock-agents";
import { SCENARIOS, DEFAULT_SCENARIO_ID, type ScenarioId } from "@/data/scenarios";
import { applyEvent } from "./apply-event";

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
        // If the next event is a *.resolved gated on human input, drop to awaiting_human
        // instead of just returning. This makes the UI state honest after a seek that
        // lands between a *.requested and its matching *.resolved.
        if (next.type === "decision.resolved" || next.type === "approval.resolved") {
          if (!state.pendingResolutions.has(next.subject)) {
            // We're running but the next event is gated. Surface that clearly.
            set({ runState: "awaiting_human" });
            return;
          }
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

        // Land in the right runState: completed if we're at the end, awaiting_human if any
        // decision is still open (i.e. seeked into a pause window), otherwise paused.
        const hasOpenDecision = (next.decisions ?? []).some((d) => !d.resolved);
        const landed: RunState =
          target >= events.length ? "completed" : hasOpenDecision ? "awaiting_human" : "paused";
        set({ ...next, runState: landed });
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

