# Event Model

Every change in the office is an event. Events are the source of truth — UI state is derived.

Canonical definition lives in [`src/types/workflow-events.ts`](../../src/types/workflow-events.ts); the scenario validator in [`src/lib/validate-scenario.ts`](../../src/lib/validate-scenario.ts) enforces actor / status / room / mode unions at runtime. If this doc and those files disagree, the code wins.

## Why events

- **Replayable.** A scenario is just a sorted array of events; the pure `applyEvent` reducer folds them into office state.
- **Auditable.** Every UI change traces back to one event in the activity log.
- **Decoupled.** Agents emit events; they don't reach into each other's state.
- **Seek-friendly.** `seekTo(N)` reconstructs state by replaying events 0..N from a fresh base.

## Event shape

```ts
interface WorkflowEvent {
  id: string;        // evt_*
  ts: string;        // ISO 8601 UTC
  actor: AgentId | "human" | "system";
  type: WorkflowEventType;
  subject: string;   // id of the thing the event is about (work item / agent / decision / artifact / ...)
  payload: Record<string, unknown>;
}
```

The payload is loosely typed at the boundary but narrowed in the reducer per event type. Several common shapes are exported as helper interfaces (`AgentStatusChangedPayload`, `AgentMovedPayload`, `WorkItemOwnerChangedPayload`, `WorkItemModeChangedPayload`).

## Event taxonomy

Twelve categories. The validator rejects any `event.type` outside this set at runtime — so JSON fixtures loaded from disk can't sneak unknown types past TypeScript. New types must be added to `WorkflowEventType`, to `VALID_EVENT_TYPES` in the validator, and to the reducer's switch before they can be emitted.

| Category | Types | Reducer behavior |
| --- | --- | --- |
| Run lifecycle | `run.started`, `run.paused`, `run.completed` | Flips `runState` |
| Work item lifecycle | `work_item.created`, `work_item.refined`, `work_item.owner.changed`, `work_item.mode.changed`, `work_item.completed` | Updates `workItem` and (on owner change) `agents[].assignedWorkItemId` |
| Agent lifecycle | `agent.started`, `agent.finished`, `agent.status.changed`, `agent.moved`, `agent.message.sent` | Updates `agents[].status`, `agents[].currentRoom`, `agents[].message` |
| Rooms | `room.entered`, `room.exited` | Log-only in v0.1; movement is driven by `agent.moved` |
| Handoffs | `handoff.requested`, `handoff.accepted`, `handoff.completed` | `handoff.requested` updates `workItem.nextAgentId` and `agents[].nextAgentId`; the others are log-only |
| Artifacts | `artifact.produced` | Pushes to `artifacts[]` and `workItem.artifactIds[]`, sets `agents[].currentArtifactId` |
| Decisions | `decision.requested`, `decision.resolved` | `requested` pushes a decision and flips `workItem.humanDecisionNeeded`; the store also drops `runState` to `awaiting_human` |
| Blockers | `blocker.raised`, `blocker.cleared` | Pushes/resolves a `Blocker`; sets `agents[].blockedBy` on raise |
| Quality gates | `quality_gate.passed`, `quality_gate.failed` | Pushes a `QualityGate` with the appropriate status |
| Approvals (P7) | `approval.requested`, `approval.resolved` | Modelled as a synthetic two-option decision (`approve` / `deny`); same `awaiting_human` semantics |
| Meetings | `meeting.started`, `meeting.ended` | Log-only in v0.1 |
| Permission bumps | `permission.bumped`, `permission.expired` | Log-only in v0.1; v0.2 will surface bump windows in the agent drawer |

## Pauses (human-in-the-loop)

`decision.requested` and `approval.requested` are the two events that pause the run. The store transitions `runState: running → awaiting_human` and the tick loop stops calling the reducer until the user resolves the open decision. The matching `*.resolved` event is then applied and the loop resumes.

If a `seekTo()` lands between a `*.requested` and its matching `*.resolved`, the store lands in `awaiting_human` directly — no tick is needed.

## Replay & validation

- **Replay**: load any scenario, call `seekTo(N)` to reconstruct state at event N. The activity log is click-to-scrub.
- **Validation** (offline): `validateScenario()` checks actor unions, agent / room / status / mode unions, that every `decision.resolved` has a matching `decision.requested`, that every approval is similarly matched, and that the `chain` field on scripted scenarios matches the number of `work_item.owner.changed` events.
- **Observer scenarios** (v0.2 spike): when added, the validator additionally rejects `decision.requested` or `approval.requested` events because observer mode is read-only.

## Related

- TS types: [`src/types/workflow-events.ts`](../../src/types/workflow-events.ts)
- Reducer: [`src/state/apply-event.ts`](../../src/state/apply-event.ts)
- Store: [`src/state/officeStore.ts`](../../src/state/officeStore.ts)
- Validator: [`src/lib/validate-scenario.ts`](../../src/lib/validate-scenario.ts)
- Work item model: [work-item-model.md](work-item-model.md)
- Handoff model: [handoff-model.md](handoff-model.md)
- Decision model: [decision-model.md](decision-model.md)
- Blocker model: [blocker-model.md](blocker-model.md)
- Quality gates: [quality-gates.md](quality-gates.md)
- Data model (TS types): [../architecture/data-model.md](../architecture/data-model.md)
