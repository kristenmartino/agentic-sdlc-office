# Work Item Model

A work item is the unit of work the office moves through the ADLC.

Canonical definition lives in [`src/types/work-items.ts`](../../src/types/work-items.ts). This doc is the human-readable companion; if it and the type disagree, the type wins.

## Lifecycle

`WorkItemStatus` (the discriminated union enforced by TS and validated at runtime):

| Status | Set by | Meaning |
| --- | --- | --- |
| `captured` | `work_item.created` | Just arrived. Title only — no acceptance, no plan. |
| `refined` | `work_item.refined` | Acceptance + out-of-scope captured. Ready for research/plan. |
| `researching` | (planned) | Research mode owned by Nova. |
| `planning` | (planned) | Plan / ADR owned by Theo. |
| `designing` | (planned) | UI spec owned by Iris. |
| `building` | (planned) | Code being written by Mira. |
| `validating` | (planned) | Tests / QA owned by Tess. |
| `reviewing` | (planned) | Review / security owned by Rune. |
| `awaiting_human` | run state | Surfaced by the store when a decision or approval is open. |
| `done` | `work_item.completed` | Finished. |

In v0.1 the reducer sets `captured` on creation, `refined` on `work_item.refined`, and `done` on `work_item.completed`. The intermediate phase statuses are reserved — the reducer can adopt them as the scripted scenarios get richer, without changing the type.

The agent currently holding the item lives at `currentPhase` (a free-text label like `"Planning"` or `"Researching"`), derived from `ownerAgentId` via `phaseFor()` in [`src/state/apply-event.ts`](../../src/state/apply-event.ts).

## Fields

```ts
interface WorkItem {
  id: string;                    // wi_*
  title: string;
  kind: "feature" | "bug" | "research" | "task";
  status: WorkItemStatus;
  currentMode: ADLCMode;         // Intent | Generate | Validate | Govern | Deploy | Observe | Multi
  currentPhase: string;          // "Planning", "Researching", ...

  ownerAgentId: AgentId | null;  // who holds it right now
  nextAgentId: AgentId | null;   // who's about to receive it (during a handoff)
  assignedAgentIds: AgentId[];   // everyone who has touched it
  humanDecisionNeeded: boolean;  // mirrors any open decision

  branch: string | null;         // v0.2 — git branch the work item lives on
  worktreePath: string | null;   // v0.2 — local worktree path

  modeHistory: ModeChange[];     // append-only audit trail of mode shifts
  artifactIds: string[];
  decisionIds: string[];
  blockerIds: string[];
  qualityGateIds: string[];

  acceptance: string[];          // bullets captured by Piper in Intent
  outOfScope: string[];          // explicit non-goals

  createdAt: string;             // ISO 8601 UTC
  updatedAt: string;
}

interface ModeChange {
  ts: string;
  from: ADLCMode | null;
  to: ADLCMode;
  by: AgentId;
}
```

## Modes (`ADLCMode`)

`Intent | Generate | Validate | Govern | Deploy | Observe | Multi`. Set on `work_item.mode.changed`; the reducer appends to `modeHistory`. `Multi` is reserved for concurrent-mode scenarios (v0.2+); v0.1 scenarios run one mode at a time.

## Invariants

- `ownerAgentId === null` is valid only before the first `work_item.owner.changed` event.
- `nextAgentId` is set by `handoff.requested` and cleared by `work_item.owner.changed`.
- `assignedAgentIds` is append-only and de-duped by the reducer.
- `branch` and `worktreePath` are null for all v0.1 scenarios (no real git interaction yet).
- `humanDecisionNeeded` is recomputed on every decision/approval state change — never set independently.

## Where each field is mutated

| Field | Event(s) |
| --- | --- |
| `title`, `status: "captured"` | `work_item.created` |
| `status: "refined"`, `acceptance`, `outOfScope` | `work_item.refined` |
| `ownerAgentId`, `currentPhase`, `assignedAgentIds`, `nextAgentId: null` | `work_item.owner.changed` |
| `currentMode`, `modeHistory` | `work_item.mode.changed` |
| `status: "done"` | `work_item.completed` |
| `nextAgentId` | `handoff.requested` |
| `artifactIds[]` | `artifact.produced` |
| `decisionIds[]`, `humanDecisionNeeded: true` | `decision.requested`, `approval.requested` |
| `humanDecisionNeeded` (recompute) | `decision.resolved`, `approval.resolved` |
| `blockerIds[]` | `blocker.raised` |
| `qualityGateIds[]` | `quality_gate.passed`, `quality_gate.failed` |
| `updatedAt` | every state-mutating event |

## Related

- TS type: [`src/types/work-items.ts`](../../src/types/work-items.ts)
- Reducer: [`src/state/apply-event.ts`](../../src/state/apply-event.ts)
- Event model: [event-model.md](event-model.md)
- Handoff model: [handoff-model.md](handoff-model.md)
- Decision model: [decision-model.md](decision-model.md)
- Quality gates: [quality-gates.md](quality-gates.md)
