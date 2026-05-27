# Data Model

TypeScript-first data model. Source of truth lives in `src/types/` — see [state-source-of-truth.md](state-source-of-truth.md) for the ordering rules between code and these docs. This doc is the human-readable companion.

## Entities

| Entity | TS module | Notes |
| --- | --- | --- |
| ADLC mode | [src/types/adlc.ts](../../src/types/adlc.ts) | Enum of modes including `Multi` |
| Agent | [src/types/agents.ts](../../src/types/agents.ts) | Identity, role, room, status |
| Room | [src/types/rooms.ts](../../src/types/rooms.ts) | The 8 rooms of the office |
| Work item | [src/types/work-items.ts](../../src/types/work-items.ts) | The unit of work |
| Workflow event | [src/types/workflow-events.ts](../../src/types/workflow-events.ts) | The event-sourcing record |
| Governance | [src/types/governance.ts](../../src/types/governance.ts) | Decisions, blockers, quality gates |

## Conventions

- IDs are prefixed strings: `agt_`, `room_`, `wi_`, `evt_`, `dec_`, `blk_`, `gate_`.
- Timestamps are ISO 8601 UTC.
- Status enums are explicit unions — no `string` placeholders.

## Related

- Event model: [../workflow/event-model.md](../workflow/event-model.md)
- Work item model: [../workflow/work-item-model.md](../workflow/work-item-model.md)
