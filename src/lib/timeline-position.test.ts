import { describe, expect, it } from "vitest";
import { timelinePosition } from "./timeline-position";
import type { AgentId } from "@/types/agents";
import type { WorkflowEvent } from "@/types/workflow-events";

function ownerChange(to: AgentId): WorkflowEvent {
  return {
    id: `evt_${to}_${Math.random().toString(36).slice(2, 7)}`,
    ts: "2026-05-27T15:00:00.000Z",
    actor: "system",
    type: "work_item.owner.changed",
    subject: "wi_test",
    payload: { workItemId: "wi_test", from: null, to },
  };
}

function noise(): WorkflowEvent {
  return {
    id: `evt_noise_${Math.random().toString(36).slice(2, 7)}`,
    ts: "2026-05-27T15:00:00.000Z",
    actor: "system",
    type: "agent.message.sent",
    subject: "mira",
    payload: { agentId: "mira", message: "noise" },
  };
}

describe("timelinePosition — scripted scenarios", () => {
  const chain: AgentId[] = ["piper", "nova", "theo", "iris", "mira", "tess", "rune", "cora"];

  it("returns -1 before any owner.changed has fired", () => {
    expect(timelinePosition([noise(), noise()], chain, "scripted")).toBe(-1);
  });

  it("advances 1:1 with owner.changed events", () => {
    expect(timelinePosition([ownerChange("piper")], chain, "scripted")).toBe(0);
    expect(
      timelinePosition([ownerChange("piper"), ownerChange("nova")], chain, "scripted"),
    ).toBe(1);
    expect(
      timelinePosition(
        [ownerChange("piper"), ownerChange("nova"), ownerChange("theo")],
        chain,
        "scripted",
      ),
    ).toBe(2);
  });

  it("clamps at chain.length - 1 if the log somehow has more owner changes than the chain", () => {
    const log = chain.map((a) => ownerChange(a));
    log.push(ownerChange("rune")); // one extra
    expect(timelinePosition(log, chain, "scripted")).toBe(chain.length - 1);
  });
});

describe("timelinePosition — observed scenarios", () => {
  it("collapses adjacent duplicate owner.changed events before counting", () => {
    // Mira swaps ownership with herself three times — should still be 'position 0' on a single-Mira chain.
    const log: WorkflowEvent[] = [
      ownerChange("mira"),
      ownerChange("mira"),
      ownerChange("mira"),
    ];
    expect(timelinePosition(log, ["mira"], "observed")).toBe(0);
  });

  it("counts non-adjacent reappearances of the same agent", () => {
    const chain: AgentId[] = ["rune", "piper", "rune"];
    const log: WorkflowEvent[] = [
      ownerChange("rune"),
      ownerChange("piper"),
      ownerChange("rune"),
    ];
    expect(timelinePosition(log, chain, "observed")).toBe(2);
  });

  it("clamps at chain.length - 1 if more distinct owners appear than the chain knows about", () => {
    const chain: AgentId[] = ["mira"];
    const log: WorkflowEvent[] = [
      ownerChange("mira"),
      ownerChange("tess"), // chain doesn't know about Tess
      ownerChange("rune"),
    ];
    expect(timelinePosition(log, chain, "observed")).toBe(0);
  });

  it("returns -1 when there are no owner.changed events yet", () => {
    expect(timelinePosition([noise()], ["mira"], "observed")).toBe(-1);
  });
});
