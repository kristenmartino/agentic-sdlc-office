# State source of truth

Where to look when a doc and the code disagree.

## Ordering

1. **`src/types/*`** — the discriminated unions and interfaces are canonical for runtime field shapes. If `AgentStatus` is missing a value, the value doesn't exist.
2. **`src/lib/validate-scenario.ts`** — canonical for which combinations of those values are *legal* in an event stream. A status that passes TS but fails validation is by definition invalid.
3. **`src/state/apply-event.ts`** — canonical for how each event type mutates `OfficeState`. The docs may summarise this but the function is the spec.
4. **Docs under `docs/`** — human-readable companion. Lags. Don't trust against the above three; trust against each other only if all are recently updated.

## What this means in practice

- New status / room / mode / event type → change the type union first, then the validator (so existing scenarios still validate), then the reducer (so the new value actually does something), then the docs.
- Removing a status / event type → same order in reverse. Remove from docs last so search keeps finding both old and new names while the migration is in flight.
- Adding a scenario → write the events, run `pnpm test` (validator runs on every scenario in the registry), then update docs that count scenarios.

## Files that name canonical types

| Concern | Canonical file | Companion doc |
| --- | --- | --- |
| Agents (id, status, role, permission level) | [`src/types/agents.ts`](../../src/types/agents.ts) | [`docs/design/character-bible.md`](../design/character-bible.md), [`docs/agents/permissions.md`](../agents/permissions.md) |
| Rooms | [`src/types/rooms.ts`](../../src/types/rooms.ts) | [`docs/design/room-bible.md`](../design/room-bible.md) |
| ADLC modes | [`src/types/adlc.ts`](../../src/types/adlc.ts) | [`docs/product/adlc-model.md`](../product/adlc-model.md) |
| Work item | [`src/types/work-items.ts`](../../src/types/work-items.ts) | [`docs/workflow/work-item-model.md`](../workflow/work-item-model.md) |
| Workflow events | [`src/types/workflow-events.ts`](../../src/types/workflow-events.ts) | [`docs/workflow/event-model.md`](../workflow/event-model.md) |
| Governance (decisions, blockers, gates) | [`src/types/governance.ts`](../../src/types/governance.ts) | [`docs/workflow/decision-model.md`](../workflow/decision-model.md), [`docs/workflow/blocker-model.md`](../workflow/blocker-model.md), [`docs/workflow/quality-gates.md`](../workflow/quality-gates.md) |
| Scenarios (id, source, chain) | [`src/data/scenarios.ts`](../../src/data/scenarios.ts) | [`docs/demos/`](../demos/) |

## A note on the docs that aren't here

Some `docs/` files describe v0.2+ surfaces that don't have a type yet — e.g. meeting model details, permission bump windows, real worktree fields. Those are forward-looking by design and may carry TODOs. If you're checking those, treat them as design notes, not facts about the running app.
