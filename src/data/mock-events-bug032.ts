import type { WorkflowEvent } from "../types/workflow-events";
import { BUG_032_ID } from "./mock-work-items";

const BASE = Date.parse("2026-05-27T03:14:00.000Z"); // overnight alert
const STEP_MS = 2200; // tighter than REQ-014 — incident pace
const ts = (step: number) => new Date(BASE + step * STEP_MS).toISOString();

let _id = 0;
const eid = () => `evt_bug032_${String(++_id).padStart(4, "0")}`;

const DECISION_ID = "dec_bug032_rollout";
const BLOCKER_ID = "blk_bug032_rollout";
const APPROVAL_ID = "apr_bug032_hotfix";

const GATES = {
  intent: "gate_bug032_intent",
  plan: "gate_bug032_plan",
  build: "gate_bug032_build",
  qa: "gate_bug032_qa",
  security: "gate_bug032_security",
} as const;

const ART = {
  observation: "art_bug032_observation",
  bug_spec: "art_bug032_bug_spec",
  rca: "art_bug032_rca",
  fix_adr: "art_bug032_fix_adr",
  hotfix_pr: "art_bug032_hotfix_pr",
  regression: "art_bug032_regression_test",
  review: "art_bug032_review",
} as const;

/**
 * BUG-032 — Observe → Intent loop closure. Rune raises anomaly → Piper documents → fix chain.
 * Skips Iris (no UI design needed for a bugfix). Decision: roll forward vs roll back.
 */
export const BUG_032_EVENTS: WorkflowEvent[] = [
  { id: eid(), ts: ts(0),  actor: "system", type: "run.started", subject: BUG_032_ID, payload: {} },

  // --- Rune in Observe mode: spots the anomaly ---
  { id: eid(), ts: ts(1),  actor: "rune",   type: "agent.status.changed", subject: "rune",
    payload: { agentId: "rune", from: "idle", to: "reviewing", message: "Telemetry anomaly on dashboard filter" } },
  { id: eid(), ts: ts(2),  actor: "rune",   type: "agent.message.sent", subject: "rune",
    payload: { agentId: "rune", message: "Date-range filter losing state on tab change — 14% of sessions affected." } },
  { id: eid(), ts: ts(3),  actor: "rune",   type: "work_item.created", subject: BUG_032_ID,
    payload: { title: "BUG-032 — Dashboard filter drops the date range" } },
  { id: eid(), ts: ts(4),  actor: "system", type: "work_item.mode.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: null, to: "Observe" } },
  { id: eid(), ts: ts(5),  actor: "system", type: "work_item.owner.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: null, to: "rune" } },
  { id: eid(), ts: ts(6),  actor: "rune",   type: "artifact.produced", subject: BUG_032_ID,
    payload: { artifact: { id: ART.observation, workItemId: BUG_032_ID, producedBy: "rune",
      kind: "review_report", ref: "/docs/observability/anomaly-2026-05-27.md",
      summary: "Filter date-range cleared on tab change. Affects 14% of sessions. Started 27 minutes ago.", ts: ts(6) } } },
  { id: eid(), ts: ts(7),  actor: "rune",   type: "agent.status.changed", subject: "rune",
    payload: { agentId: "rune", from: "reviewing", to: "done" } },
  { id: eid(), ts: ts(8),  actor: "rune",   type: "handoff.requested", subject: BUG_032_ID,
    payload: { fromAgentId: "rune", toAgentId: "piper" } },

  // --- Piper: Intent (formalize the bug) ---
  { id: eid(), ts: ts(9),  actor: "piper",  type: "handoff.accepted", subject: BUG_032_ID,
    payload: { fromAgentId: "rune", toAgentId: "piper" } },
  { id: eid(), ts: ts(10), actor: "system", type: "work_item.owner.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: "rune", to: "piper" } },
  { id: eid(), ts: ts(11), actor: "piper",  type: "work_item.mode.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: "Observe", to: "Intent" } },
  { id: eid(), ts: ts(12), actor: "piper",  type: "agent.status.changed", subject: "piper",
    payload: { agentId: "piper", from: "idle", to: "reading", message: "Documenting reproduction" } },
  { id: eid(), ts: ts(13), actor: "piper",  type: "work_item.refined", subject: BUG_032_ID,
    payload: { acceptance: [
      "Filter date-range persists across tab changes.",
      "No regression on other dashboard filters.",
      "Regression test covers the failure case.",
    ], outOfScope: ["Filter UI redesign", "Adding new filter dimensions"] } },
  { id: eid(), ts: ts(14), actor: "piper",  type: "artifact.produced", subject: BUG_032_ID,
    payload: { artifact: { id: ART.bug_spec, workItemId: BUG_032_ID, producedBy: "piper",
      kind: "acceptance_criteria", ref: "/docs/demos/bug-032-dashboard-filter.md",
      summary: "Bug confirmed. Reproduction documented. P1 — affects active users.", ts: ts(14) } } },
  { id: eid(), ts: ts(15), actor: "piper",  type: "quality_gate.passed", subject: BUG_032_ID,
    payload: { gate: { id: GATES.intent, workItemId: BUG_032_ID, name: "Intent complete",
      owner: "piper", status: "passed", notes: "Bug spec finalized." } } },
  { id: eid(), ts: ts(16), actor: "piper",  type: "agent.status.changed", subject: "piper",
    payload: { agentId: "piper", from: "reading", to: "done" } },
  { id: eid(), ts: ts(17), actor: "piper",  type: "handoff.requested", subject: BUG_032_ID,
    payload: { fromAgentId: "piper", toAgentId: "nova" } },

  // --- Nova: root cause ---
  { id: eid(), ts: ts(18), actor: "nova",   type: "handoff.accepted", subject: BUG_032_ID,
    payload: { fromAgentId: "piper", toAgentId: "nova" } },
  { id: eid(), ts: ts(19), actor: "system", type: "work_item.owner.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: "piper", to: "nova" } },
  { id: eid(), ts: ts(20), actor: "nova",   type: "agent.status.changed", subject: "nova",
    payload: { agentId: "nova", from: "idle", to: "reading", message: "Tracing filter state in dashboard component" } },
  { id: eid(), ts: ts(21), actor: "nova",   type: "artifact.produced", subject: BUG_032_ID,
    payload: { artifact: { id: ART.rca, workItemId: BUG_032_ID, producedBy: "nova",
      kind: "research_brief", ref: "/docs/research/bug-032-rca.md",
      summary: "Root cause: filter state reset on tab unmount. Similar issue in BUG-019 (resolved). Tab persistence pattern from REQ-007 applies.", ts: ts(21) } } },
  { id: eid(), ts: ts(22), actor: "nova",   type: "agent.status.changed", subject: "nova",
    payload: { agentId: "nova", from: "reading", to: "done" } },
  { id: eid(), ts: ts(23), actor: "nova",   type: "handoff.requested", subject: BUG_032_ID,
    payload: { fromAgentId: "nova", toAgentId: "theo" } },

  // --- Theo: minimal-scope fix plan ---
  { id: eid(), ts: ts(24), actor: "theo",   type: "handoff.accepted", subject: BUG_032_ID,
    payload: { fromAgentId: "nova", toAgentId: "theo" } },
  { id: eid(), ts: ts(25), actor: "system", type: "work_item.owner.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: "nova", to: "theo" } },
  { id: eid(), ts: ts(26), actor: "theo",   type: "work_item.mode.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: "Intent", to: "Generate" } },
  { id: eid(), ts: ts(27), actor: "theo",   type: "agent.status.changed", subject: "theo",
    payload: { agentId: "theo", from: "idle", to: "planning", message: "Scoping a minimal hotfix" } },
  { id: eid(), ts: ts(28), actor: "theo",   type: "artifact.produced", subject: BUG_032_ID,
    payload: { artifact: { id: ART.fix_adr, workItemId: BUG_032_ID, producedBy: "theo",
      kind: "adr", ref: "/docs/architecture/adr-bug-032-fix.md",
      summary: "Minimal patch: persist filter state via URL params. Rejects wider refactor — stable enough to deploy hot.", ts: ts(28) } } },
  { id: eid(), ts: ts(29), actor: "theo",   type: "quality_gate.passed", subject: BUG_032_ID,
    payload: { gate: { id: GATES.plan, workItemId: BUG_032_ID, name: "Plan reviewed",
      owner: "theo", status: "passed", notes: "Hotfix scope confirmed." } } },
  { id: eid(), ts: ts(30), actor: "theo",   type: "agent.status.changed", subject: "theo",
    payload: { agentId: "theo", from: "planning", to: "done" } },
  { id: eid(), ts: ts(31), actor: "theo",   type: "handoff.requested", subject: BUG_032_ID,
    payload: { fromAgentId: "theo", toAgentId: "mira" } },

  // --- Mira: build the hotfix ---
  { id: eid(), ts: ts(32), actor: "mira",   type: "handoff.accepted", subject: BUG_032_ID,
    payload: { fromAgentId: "theo", toAgentId: "mira" } },
  { id: eid(), ts: ts(33), actor: "system", type: "work_item.owner.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: "theo", to: "mira" } },
  { id: eid(), ts: ts(34), actor: "mira",   type: "agent.status.changed", subject: "mira",
    payload: { agentId: "mira", from: "idle", to: "coding", message: "Writing hotfix patch" } },
  { id: eid(), ts: ts(35), actor: "mira",   type: "artifact.produced", subject: BUG_032_ID,
    payload: { artifact: { id: ART.hotfix_pr, workItemId: BUG_032_ID, producedBy: "mira",
      kind: "code_pr", ref: "draft PR #58",
      summary: "Persists filter date-range to URL params. 12 LOC. Reuses tab persistence helper.", ts: ts(35) } } },
  { id: eid(), ts: ts(36), actor: "mira",   type: "quality_gate.passed", subject: BUG_032_ID,
    payload: { gate: { id: GATES.build, workItemId: BUG_032_ID, name: "Build green",
      owner: "mira", status: "passed", notes: "Build + unit tests pass." } } },
  { id: eid(), ts: ts(37), actor: "mira",   type: "agent.status.changed", subject: "mira",
    payload: { agentId: "mira", from: "coding", to: "done" } },
  { id: eid(), ts: ts(38), actor: "mira",   type: "handoff.requested", subject: BUG_032_ID,
    payload: { fromAgentId: "mira", toAgentId: "tess" } },

  // --- Tess: regression + reproduction ---
  { id: eid(), ts: ts(39), actor: "tess",   type: "handoff.accepted", subject: BUG_032_ID,
    payload: { fromAgentId: "mira", toAgentId: "tess" } },
  { id: eid(), ts: ts(40), actor: "system", type: "work_item.owner.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: "mira", to: "tess" } },
  { id: eid(), ts: ts(41), actor: "tess",   type: "work_item.mode.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: "Generate", to: "Validate" } },
  { id: eid(), ts: ts(42), actor: "tess",   type: "agent.status.changed", subject: "tess",
    payload: { agentId: "tess", from: "idle", to: "testing", message: "Writing failing test first" } },
  { id: eid(), ts: ts(43), actor: "tess",   type: "agent.message.sent", subject: "tess",
    payload: { agentId: "tess", message: "Test reproduces the original bug. Fix makes it pass. 0 regressions on other filters." } },
  { id: eid(), ts: ts(44), actor: "tess",   type: "artifact.produced", subject: BUG_032_ID,
    payload: { artifact: { id: ART.regression, workItemId: BUG_032_ID, producedBy: "tess",
      kind: "test_plan", ref: "/tests/bug-032-filter-persistence.spec.ts",
      summary: "Failing-then-passing regression. Plus 4 adjacent filters verified intact.", ts: ts(44) } } },
  { id: eid(), ts: ts(45), actor: "tess",   type: "quality_gate.passed", subject: BUG_032_ID,
    payload: { gate: { id: GATES.qa, workItemId: BUG_032_ID, name: "QA green",
      owner: "tess", status: "passed", notes: "All acceptance criteria pass; no regressions." } } },
  { id: eid(), ts: ts(46), actor: "tess",   type: "agent.status.changed", subject: "tess",
    payload: { agentId: "tess", from: "testing", to: "done" } },
  { id: eid(), ts: ts(47), actor: "tess",   type: "handoff.requested", subject: BUG_032_ID,
    payload: { fromAgentId: "tess", toAgentId: "rune" } },

  // --- Rune: expedited review ---
  { id: eid(), ts: ts(48), actor: "rune",   type: "handoff.accepted", subject: BUG_032_ID,
    payload: { fromAgentId: "tess", toAgentId: "rune" } },
  { id: eid(), ts: ts(49), actor: "system", type: "work_item.owner.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: "tess", to: "rune" } },
  { id: eid(), ts: ts(50), actor: "rune",   type: "agent.status.changed", subject: "rune",
    payload: { agentId: "rune", from: "done", to: "reviewing", message: "Expedited security review" } },
  { id: eid(), ts: ts(51), actor: "rune",   type: "artifact.produced", subject: BUG_032_ID,
    payload: { artifact: { id: ART.review, workItemId: BUG_032_ID, producedBy: "rune",
      kind: "review_report", ref: "PR #58 review",
      summary: "Small surface area. No new attack surface. URL-param state is fine for this. Approved.", ts: ts(51) } } },
  { id: eid(), ts: ts(52), actor: "rune",   type: "quality_gate.passed", subject: BUG_032_ID,
    payload: { gate: { id: GATES.security, workItemId: BUG_032_ID, name: "Security cleared",
      owner: "rune", status: "passed", notes: "0 findings; expedited review." } } },
  { id: eid(), ts: ts(53), actor: "rune",   type: "agent.status.changed", subject: "rune",
    payload: { agentId: "rune", from: "reviewing", to: "done" } },
  { id: eid(), ts: ts(54), actor: "rune",   type: "handoff.requested", subject: BUG_032_ID,
    payload: { fromAgentId: "rune", toAgentId: "cora" } },

  // --- Cora: surface the rollout choice ---
  { id: eid(), ts: ts(55), actor: "cora",   type: "handoff.accepted", subject: BUG_032_ID,
    payload: { fromAgentId: "rune", toAgentId: "cora" } },
  { id: eid(), ts: ts(56), actor: "system", type: "work_item.owner.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: "rune", to: "cora" } },
  { id: eid(), ts: ts(57), actor: "cora",   type: "work_item.mode.changed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID, from: "Validate", to: "Govern" } },
  { id: eid(), ts: ts(58), actor: "cora",   type: "agent.status.changed", subject: "cora",
    payload: { agentId: "cora", from: "idle", to: "working", message: "Rollout decision needed" } },
  { id: eid(), ts: ts(59), actor: "cora",   type: "decision.requested", subject: DECISION_ID,
    payload: { decision: {
      id: DECISION_ID,
      workItemId: BUG_032_ID,
      raisedBy: "cora",
      question: "Roll forward with the hotfix, or roll back the change that introduced the regression?",
      context: "Bug entered with last week's tab-persistence refactor (PR #51). Hotfix is small and tested. Rollback reverts to before tabs persisted.",
      options: [
        { id: "forward", label: "Roll forward — deploy PR #58 hotfix",
          pros: ["Keeps tab persistence", "Small, tested change"],
          cons: ["Adds one more change to the prod history"] },
        { id: "back", label: "Roll back PR #51 entirely",
          pros: ["Returns to a known-good state"],
          cons: ["Loses tab persistence", "Bigger revert; affects other surfaces"] },
      ],
      recommendation: "forward",
      reversible: "yes",
    } } },

  { id: eid(), ts: ts(60), actor: "cora",   type: "blocker.raised", subject: BUG_032_ID,
    payload: { blocker: { id: BLOCKER_ID, workItemId: BUG_032_ID, raisedBy: "cora",
      kind: "decision_needed", description: "Rollout direction needs a human." } } },
  { id: eid(), ts: ts(61), actor: "cora",   type: "agent.status.changed", subject: "cora",
    payload: { agentId: "cora", from: "working", to: "waiting_on_human" } },

  // [PAUSE 1: decision]
  { id: eid(), ts: ts(62), actor: "human",  type: "decision.resolved", subject: DECISION_ID,
    payload: { decisionId: DECISION_ID, chosenOptionId: "forward", resolvedBy: "human" } },
  { id: eid(), ts: ts(63), actor: "system", type: "blocker.cleared", subject: BUG_032_ID,
    payload: { blockerId: BLOCKER_ID, resolution: "Roll forward chosen." } },
  { id: eid(), ts: ts(64), actor: "cora",   type: "agent.status.changed", subject: "cora",
    payload: { agentId: "cora", from: "waiting_on_human", to: "working", message: "Requesting hotfix deploy" } },

  { id: eid(), ts: ts(65), actor: "cora",   type: "approval.requested", subject: APPROVAL_ID,
    payload: { approval: {
      id: APPROVAL_ID,
      workItemId: BUG_032_ID,
      action: "Merge PR #58 and deploy hotfix to production",
      level: "P7",
      raisedBy: "cora",
    } } },

  // [PAUSE 2: approval]
  { id: eid(), ts: ts(66), actor: "human",  type: "approval.resolved", subject: APPROVAL_ID,
    payload: { approvalId: APPROVAL_ID, granted: true, resolvedBy: "human" } },
  { id: eid(), ts: ts(67), actor: "cora",   type: "agent.status.changed", subject: "cora",
    payload: { agentId: "cora", from: "working", to: "done" } },
  { id: eid(), ts: ts(68), actor: "system", type: "work_item.completed", subject: BUG_032_ID,
    payload: { workItemId: BUG_032_ID } },
  { id: eid(), ts: ts(69), actor: "system", type: "run.completed", subject: BUG_032_ID, payload: {} },
];
