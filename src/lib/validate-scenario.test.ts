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

  it("flags an empty currentPhase", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, currentPhase: "" },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.currentPhase must be a non-empty string"))).toBe(true);
  });

  it("flags a non-boolean humanDecisionNeeded", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      // @ts-expect-error — simulating external JSON that supplied a string
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, humanDecisionNeeded: "yes" },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.humanDecisionNeeded must be boolean"))).toBe(true);
  });

  it("flags a non-string-or-null branch", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      // @ts-expect-error — simulating external JSON that supplied a number
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, branch: 42 },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.branch must be string | null"))).toBe(true);
  });

  it("flags a non-string-or-null worktreePath", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      // @ts-expect-error — simulating external JSON that supplied an object
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, worktreePath: { path: "/x" } },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.worktreePath must be string | null"))).toBe(true);
  });

  it("flags a non-array artifactIds", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      // @ts-expect-error — string smuggled in where an array was expected
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, artifactIds: "art_one" },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.artifactIds must be an array"))).toBe(true);
  });

  it("flags a non-string entry inside an ID array", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      initialWorkItem: {
        ...SCENARIOS["observed-sample"].initialWorkItem,
        // @ts-expect-error — number smuggled into a string[]
        decisionIds: ["dec_a", 7],
      },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.decisionIds[1] must be a string"))).toBe(true);
  });

  it("flags non-array acceptance / outOfScope", () => {
    const bad1: Scenario = {
      ...SCENARIOS["observed-sample"],
      // @ts-expect-error — object instead of string[]
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, acceptance: { items: [] } },
    };
    const bad2: Scenario = {
      ...SCENARIOS["observed-sample"],
      // @ts-expect-error — null instead of array
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, outOfScope: null },
    };
    expect(validateScenario(bad1).some((i) => i.message.includes("initialWorkItem.acceptance must be an array"))).toBe(true);
    expect(validateScenario(bad2).some((i) => i.message.includes("initialWorkItem.outOfScope must be an array"))).toBe(true);
  });

  it("flags a non-array modeHistory", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      // @ts-expect-error — object instead of array
      initialWorkItem: { ...SCENARIOS["observed-sample"].initialWorkItem, modeHistory: {} },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("initialWorkItem.modeHistory must be an array"))).toBe(true);
  });

  it("flags malformed modeHistory entries (bad timestamp, mode, and agent)", () => {
    const bad: Scenario = {
      ...SCENARIOS["observed-sample"],
      initialWorkItem: {
        ...SCENARIOS["observed-sample"].initialWorkItem,
        modeHistory: [
          // @ts-expect-error — simulating external JSON
          { ts: "not-a-date", from: null, to: "Bogus", by: "bogus" },
        ],
      },
    };
    const issues = validateScenario(bad);
    expect(issues.some((i) => i.message.includes("modeHistory[0].ts: not a valid ISO 8601 timestamp"))).toBe(true);
    expect(issues.some((i) => i.message.includes("modeHistory[0].to: unknown mode 'Bogus'"))).toBe(true);
    expect(issues.some((i) => i.message.includes("modeHistory[0].by: unknown agent 'bogus'"))).toBe(true);
  });

  it("modeHistory[i].from = null is allowed (first mode set on the item)", () => {
    const ok: Scenario = {
      ...SCENARIOS["observed-sample"],
      initialWorkItem: {
        ...SCENARIOS["observed-sample"].initialWorkItem,
        modeHistory: [
          { ts: "2026-05-27T15:00:00.000Z", from: null, to: "Generate", by: "mira" },
        ],
      },
    };
    const issues = validateScenario(ok);
    expect(issues.some((i) => i.message.includes("modeHistory"))).toBe(false);
  });
});
