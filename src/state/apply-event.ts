import type { AgentId, AgentInstance } from "@/types/agents";
import type { Artifact, ModeChange } from "@/types/work-items";
import type { Decision, Blocker, QualityGate } from "@/types/governance";
import type {
  WorkflowEvent,
  AgentStatusChangedPayload,
  WorkItemOwnerChangedPayload,
  WorkItemModeChangedPayload,
} from "@/types/workflow-events";
import type { OfficeState } from "./officeStore";

/**
 * Apply a single event to state. Pure with respect to its inputs.
 * Returns a Partial<OfficeState> describing the patch.
 *
 * Lives outside the Zustand store so it can be unit-tested directly.
 */
export function applyEvent(state: OfficeState, event: WorkflowEvent): Partial<OfficeState> {
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
      // handoff.accepted, room.entered, etc. — log-only, no state delta.
      break;
  }

  return patch;
}

export function phaseFor(agent: AgentId): string {
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
