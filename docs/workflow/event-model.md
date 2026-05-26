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
  actor: cora | piper | nova | theo | iris | mira | tess | rune | human
  type: work_item.created | handoff.requested | decision.requested | blocker.raised | quality_gate.passed | ...
  subject: work_item|decision|artifact id
  payload: { ... }
```

## Event types (draft)

- `work_item.*` — created, refined, completed
- `handoff.*` — requested, accepted
- `artifact.*` — produced, referenced
- `decision.*` — requested, resolved
- `blocker.*` — raised, cleared
- `quality_gate.*` — passed, failed

## Related

- Work item model: [work-item-model.md](work-item-model.md)
- Handoff model: [handoff-model.md](handoff-model.md)
- Decision model: [decision-model.md](decision-model.md)
- Blocker model: [blocker-model.md](blocker-model.md)
- Quality gates: [quality-gates.md](quality-gates.md)
- Data model (TS types): [../architecture/data-model.md](../architecture/data-model.md)
