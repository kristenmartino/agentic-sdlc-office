import { describe, expect, it } from "vitest";
import { SCENARIOS, type Scenario } from "@/data/scenarios";
import { validateScenario } from "./validate-scenario";

describe("validateScenario", () => {
  it("REQ-014 has no issues", () => {
    const issues = validateScenario(SCENARIOS["req-014"]);
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it("BUG-032 has no issues", () => {
    const issues = validateScenario(SCENARIOS["bug-032"]);
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it("flags an invalid status value", () => {
    const bad: Scenario = {
      ...SCENARIOS["req-014"],
      events: [
        {
          id: "evt_bad",
          ts: "2026-05-26T18:00:00.000Z",
          actor: "cora",
          type: "agent.status.changed",
          subject: "cora",
          payload: { agentId: "cora", from: "idle", to: "working" },
        },
      ],
    };
    const issues = validateScenario(bad);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].message).toContain("invalid 'to' status");
  });

  it("flags a decision.resolved with no matching decision.requested", () => {
    const bad: Scenario = {
      ...SCENARIOS["req-014"],
      events: [
        {
          id: "evt_orphan",
          ts: "2026-05-26T18:00:00.000Z",
          actor: "human",
          type: "decision.resolved",
          subject: "dec_orphan",
          payload: { decisionId: "dec_orphan", chosenOptionId: "a" },
        },
      ],
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("no matching decision.requested"))).toBe(true);
  });
});
