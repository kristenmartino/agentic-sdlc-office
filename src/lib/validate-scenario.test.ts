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
    expect(issues.some((i) => i.message.includes("invalid 'to' status"))).toBe(true);
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

  it("flags an empty chain", () => {
    const bad: Scenario = { ...SCENARIOS["req-014"], chain: [] };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("chain must be a non-empty array"))).toBe(true);
  });

  it("flags an unknown agent in the chain", () => {
    const bad: Scenario = {
      ...SCENARIOS["req-014"],
      // @ts-expect-error — intentionally bad value for testing
      chain: ["piper", "bogus", "theo"],
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("unknown agent 'bogus'"))).toBe(true);
  });

  it("flags chain length not matching owner.changed count", () => {
    const bad: Scenario = { ...SCENARIOS["req-014"], chain: ["piper", "nova"] };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("does not match work_item.owner.changed count"))).toBe(true);
  });

  it("BUG-032 chain with duplicate Rune still validates clean", () => {
    // The known good case — Rune appears twice in BUG-032's chain (observer + reviewer).
    const issues = validateScenario(SCENARIOS["bug-032"]);
    expect(issues).toEqual([]);
  });

  it("observed-sample has no issues", () => {
    const issues = validateScenario(SCENARIOS["observed-sample"]);
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it("does not enforce chain length on observed scenarios", () => {
    // Observed sessions don't have a 1:1 chain ↔ owner.changed relationship.
    // The observed sample only owner-changes once (to mira) but the chain has length 1,
    // so no issue. Confirm by inflating the chain — should still validate.
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      chain: ["mira", "tess", "rune"],
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("does not match work_item.owner.changed count"))).toBe(false);
  });

  it("flags decision.requested in an observed scenario", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      events: [
        ...SCENARIOS["observed-sample"].events,
        {
          id: "evt_obs_bad",
          ts: "2026-05-27T14:30:50.000Z",
          actor: "mira",
          type: "decision.requested",
          subject: "dec_obs_bad",
          payload: {
            decision: {
              id: "dec_obs_bad",
              workItemId: "wi_observed_001",
              question: "Should we ship?",
              context: "",
              options: [],
              recommendation: null,
              raisedBy: "mira",
              resolved: false,
              chosenOptionId: null,
              resolvedBy: null,
              resolvedAt: null,
              reversible: "yes",
            },
          },
        },
      ],
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("observer mode is read-only"))).toBe(true);
  });
});
