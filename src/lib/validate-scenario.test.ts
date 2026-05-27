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

  it("flags unknown event.type strings (catches external fixture drift)", () => {
    // Cast through unknown to simulate a JSON-loaded event whose `type`
    // field doesn't match any known WorkflowEventType. TS can't see this
    // across an import boundary; the validator now catches it at runtime.
    const rogueEvent = {
      id: "evt_unknown_type",
      ts: "2026-05-27T14:31:00.000Z",
      actor: "mira",
      type: "agent.broke.something",
      subject: "mira",
      payload: {},
    } as unknown as Scenario["events"][number];

    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      events: [...SCENARIOS["observed-sample"].events, rogueEvent],
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("unknown event.type: agent.broke.something"))).toBe(true);
  });
});

describe("validateScenario — initialWorkItem fields", () => {
  it("flags an empty work item id", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, id: "" },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.id must be a non-empty string"))).toBe(true);
  });

  it("flags an empty title", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, title: "" },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.title must be a non-empty string"))).toBe(true);
  });

  it("flags an unknown WorkItemKind", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      // @ts-expect-error — intentionally bad value to simulate external JSON
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, kind: "epic" },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.kind: unknown value 'epic'"))).toBe(true);
  });

  it("flags an unknown WorkItemStatus", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      // @ts-expect-error — intentionally bad value
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, status: "wip" },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.status: unknown value 'wip'"))).toBe(true);
  });

  it("flags an unknown ADLC mode", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      // @ts-expect-error — intentionally bad value
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, currentMode: "Discovery" },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.currentMode: unknown value 'Discovery'"))).toBe(true);
  });

  it("flags an unknown ownerAgentId", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      // @ts-expect-error — intentionally bad value
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, ownerAgentId: "bogus" },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.ownerAgentId: unknown agent 'bogus'"))).toBe(true);
  });

  it("flags an unknown nextAgentId", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      // @ts-expect-error — intentionally bad value
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, nextAgentId: "bogus" },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.nextAgentId: unknown agent 'bogus'"))).toBe(true);
  });

  it("flags unknown agent IDs in assignedAgentIds", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      initialWorkItem: {
        ...SCENARIOS["observed-sample"].initialWorkItem,
        // @ts-expect-error — intentionally bad value
        assignedAgentIds: ["mira", "bogus"],
      },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.assignedAgentIds[1]: unknown agent 'bogus'"))).toBe(true);
  });

  it("flags a non-ISO createdAt timestamp", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      initialWorkItem: {
        ...SCENARIOS["observed-sample"].initialWorkItem,
        createdAt: "yesterday at 4pm",
      },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.createdAt: not a valid ISO 8601 timestamp"))).toBe(true);
  });

  it("flags a non-ISO updatedAt timestamp", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      initialWorkItem: {
        ...SCENARIOS["observed-sample"].initialWorkItem,
        updatedAt: "2026/05/27",
      },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.updatedAt: not a valid ISO 8601 timestamp"))).toBe(true);
  });

  it("a null ownerAgentId is allowed (pre-handoff state)", () => {
    const ok: Scenario = {
      ...SCENARIOS["observed-sample"],
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, ownerAgentId: null },
    };
    const issues = validateScenario(ok);
    expect(issues.some((i) => i.message.includes("ownerAgentId"))).toBe(false);
  });
});
