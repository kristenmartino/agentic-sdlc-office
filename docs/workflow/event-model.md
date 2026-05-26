# Event Model

Every change in the office is an event. Events are the source of truth — UI state is derived.

## Why events

- Replayable for demos
- Auditable for governance
- Decouples agents from each other

## Event shape (draft)

```yaml
event:
  id: evt_...
  ts: 2026-05-26T00:00:00Z
  actor: cora | ava | ... | human
  type: work_item.created | handoff.requested | decision.requested | ...
  subject: work_item|decision|artifact id
  payload: { ... }
```

## Event types

TODO — enumerate.

## Related

- Work item model: [work-item-model.md](work-item-model.md)
- Handoff model: [handoff-model.md](handoff-model.md)
- Decision model: [decision-model.md](decision-model.md)
