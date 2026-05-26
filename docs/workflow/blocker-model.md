# Blocker Model

When an agent cannot proceed without resolution.

## Blocker shape (draft)

```yaml
blocker:
  id: blk_...
  work_item: wi_...
  raised_by: <agent_id>
  kind: missing_info | dependency | decision_needed | gate_failed | external
  description: ...
  resolution: ...
  resolved_at: ...
```

## Visual treatment

A blocked agent shows a halted status bubble (color: red) and the work item drawer surfaces the blocker prominently. A blocker that maps to a decision turns into a Decision Inbox entry (see [decision-model.md](decision-model.md)).
