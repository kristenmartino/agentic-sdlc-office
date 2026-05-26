# Quality Gates

Checkpoints between ADLC modes. A work item cannot move past a gate without passing it.

## Default gates

| Gate | Owner | Passes when |
| --- | --- | --- |
| Intent complete | Piper | Acceptance criteria written and reviewed |
| Plan reviewed | Theo | Architecture decision logged; risks called out |
| UI reviewed | Iris | Design tokens defined; key screens drawn |
| Build green | Mira | Build passes; no failing tests |
| QA green | Tess | Test plan executed; no P0/P1 bugs open |
| Security cleared | Rune | Review checklist passed; no critical findings |
| Human approved | Cora | Human has approved any irreversible action |

## Gate shape (draft)

```yaml
quality_gate:
  id: gate_...
  work_item: wi_...
  name: ...
  owner: <agent_id>
  status: pending | passed | failed | waived
  notes: ...
```
