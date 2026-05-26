# Decision Model

When an agent cannot proceed without a human (or higher-authority agent) choice.

## Decision shape (draft)

```yaml
decision:
  id: dec_...
  work_item: wi_...
  question: ...
  options:
    - id: a
      label: ...
      pros: [ ... ]
      cons: [ ... ]
    - id: b
      label: ...
  recommendation: a
  resolved: false
  resolved_by: ...
  resolved_at: ...
```

## Related

- Decision Inbox UI: TODO link to spec
- Decision log: [../governance/decision-log.md](../governance/decision-log.md)
- Approval policy: [../governance/approval-policy.md](../governance/approval-policy.md)
