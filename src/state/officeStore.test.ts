import { beforeEach, describe, expect, it } from "vitest";
import { useOfficeStore, type OfficeState } from "./officeStore";
import { applyEvent } from "./apply-event";
import { SCENARIOS } from "@/data/scenarios";
import type { WorkflowEvent } from "@/types/workflow-events";

/**
 * Plays the full scripted scenario synchronously by calling tick(),
 * resolving decisions/approvals with the recommended option whenever
 * the run pauses on a human.
 */
function playToCompletion(scenarioId: "req-014" | "bug-032", maxSteps = 500) {
  const store = useOfficeStore.getState();
  store.loadScenario(scenarioId);
  useOfficeStore.getState().start();

  for (let i = 0; i < maxSteps; i++) {
    const s = useOfficeStore.getState();
    if (s.runState === "completed") return s;
    if (s.runState === "awaiting_human") {
      const open = s.decisions.find((d) => !d.resolved);
      if (!open) throw new Error("awaiting_human but no open decisions");
      const isApproval = open.id.startsWith("apr_");
      if (isApproval) s.resolveApproval(open.id, true);
      else s.resolveDecision(open.id, open.recommendation ?? open.options[0].id);
      continue;
    }
    if (s.runState !== "running") throw new Error(`unexpected runState: ${s.runState}`);
    s.tick();
  }
  throw new Error("exceeded maxSteps without completion");
}

describe("officeStore reducer", () => {
  beforeEach(() => {
    useOfficeStore.getState().reset();
  });

  it("REQ-014 plays from start to completion", () => {
    const final = playToCompletion("req-014");
    expect(final.runState).toBe("completed");
    expect(final.workItem.status).toBe("done");
    expect(final.log.length).toBe(SCENARIOS["req-014"].events.length);
  });

  it("BUG-032 plays from start to completion", () => {
    const final = playToCompletion("bug-032");
    expect(final.runState).toBe("completed");
    expect(final.workItem.status).toBe("done");
    expect(final.log.length).toBe(SCENARIOS["bug-032"].events.length);
  });

  it("transitions to awaiting_human on decision.requested and back to running on resolveDecision", () => {
    useOfficeStore.getState().loadScenario("req-014");
    const s = useOfficeStore.getState();
    s.start();

    // Tick until we hit the decision pause point.
    for (let i = 0; i < 200; i++) {
      const cur = useOfficeStore.getState();
      if (cur.runState === "awaiting_human") break;
      cur.tick();
    }

    const paused = useOfficeStore.getState();
    expect(paused.runState).toBe("awaiting_human");
    expect(paused.decisions.some((d) => !d.resolved)).toBe(true);

    const open = paused.decisions.find((d) => !d.resolved)!;
    paused.resolveDecision(open.id, open.options[0].id);

    expect(useOfficeStore.getState().runState).toBe("running");
  });

  it("seekTo lands in awaiting_human when the seek point has an unresolved decision", () => {
    useOfficeStore.getState().loadScenario("req-014");
    const events = SCENARIOS["req-014"].events;
    const decisionIdx = events.findIndex((e) => e.type === "decision.requested");
    expect(decisionIdx).toBeGreaterThan(0);

    // Seek to right after the decision.requested event — should be awaiting_human, not paused.
    useOfficeStore.getState().seekTo(decisionIdx + 1);

    const state = useOfficeStore.getState();
    expect(state.runState).toBe("awaiting_human");
    expect(state.decisions.some((d) => !d.resolved)).toBe(true);
  });

  it("tick surfaces awaiting_human when it would otherwise stall on an unresolved gate", () => {
    // Simulate a stalled state: seek past decision.requested AND the immediately-following
    // blocker.raised events so the next event would be the still-gated decision.resolved.
    useOfficeStore.getState().loadScenario("req-014");
    const events = SCENARIOS["req-014"].events;
    const resolvedIdx = events.findIndex((e) => e.type === "decision.resolved");
    expect(resolvedIdx).toBeGreaterThan(0);

    // Seek to exactly the decision.resolved cursor — next event to apply is the resolution itself.
    useOfficeStore.getState().seekTo(resolvedIdx);

    // Force runState into "running" to exercise the tick guard.
    useOfficeStore.setState({ runState: "running" });
    useOfficeStore.getState().tick();

    expect(useOfficeStore.getState().runState).toBe("awaiting_human");
    // Cursor should NOT have advanced — the gate held.
    expect(useOfficeStore.getState().cursor).toBe(resolvedIdx);
  });
});

describe("applyEvent (pure reducer)", () => {
  function freshState(): OfficeState {
    useOfficeStore.getState().reset();
    return useOfficeStore.getState();
  }

  it("agent.moved updates the moved agent's currentRoom and leaves others alone", () => {
    const state = freshState();
    const piperBefore = state.agents.find((a) => a.id === "piper")!;
    expect(piperBefore.currentRoom).toBe("product-research");

    const event: WorkflowEvent = {
      id: "evt_test_move",
      ts: new Date().toISOString(),
      actor: "piper",
      type: "agent.moved",
      subject: "piper",
      payload: { agentId: "piper", from: "product-research", to: "human-office" },
    };

    const patch = applyEvent(state, event);
    expect(patch.agents).toBeDefined();
    const piperAfter = patch.agents!.find((a) => a.id === "piper")!;
    const novaAfter = patch.agents!.find((a) => a.id === "nova")!;
    expect(piperAfter.currentRoom).toBe("human-office");
    expect(novaAfter.currentRoom).toBe("product-research"); // unchanged
    expect(patch.cursor).toBe(state.cursor + 1);
    expect(patch.log).toHaveLength(state.log.length + 1);
  });

  it("agent.status.changed sets the status and message", () => {
    const state = freshState();
    const event: WorkflowEvent = {
      id: "evt_test_status",
      ts: new Date().toISOString(),
      actor: "mira",
      type: "agent.status.changed",
      subject: "mira",
      payload: { agentId: "mira", from: "idle", to: "coding", message: "implementing tokens" },
    };

    const patch = applyEvent(state, event);
    const mira = patch.agents!.find((a) => a.id === "mira")!;
    expect(mira.status).toBe("coding");
    expect(mira.message).toBe("implementing tokens");
  });

  it("work_item.owner.changed updates owner, phase, and assignedAgentIds", () => {
    const state = freshState();
    const event: WorkflowEvent = {
      id: "evt_test_owner",
      ts: new Date().toISOString(),
      actor: "system",
      type: "work_item.owner.changed",
      subject: state.workItem.id,
      payload: { workItemId: state.workItem.id, from: null, to: "theo" },
    };

    const patch = applyEvent(state, event);
    expect(patch.workItem!.ownerAgentId).toBe("theo");
    expect(patch.workItem!.currentPhase).toBe("Planning");
    expect(patch.workItem!.assignedAgentIds).toContain("theo");
  });
});
