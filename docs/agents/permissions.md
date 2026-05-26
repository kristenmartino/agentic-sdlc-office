# Agent Permissions

What each agent is and is not allowed to do. Default is least-privilege; dangerous actions escalate to a higher permission level or to a human (see [escalation-rules.md](escalation-rules.md)).

## Permission ladder

| Level | Meaning |
| --- | --- |
| P0 | Read-only |
| P1 | Read + write to own scratch/artifacts |
| P2 | Read + write to shared artifacts (PR drafts, docs) |
| P3 | Open PRs against branches |
| P4 | Merge to non-protected branches |
| P5 | Deploy to non-prod environments |
| P6 | Merge to `main` / protected branches |
| P7 | Deploy to production |
| Human Only | Always requires a human |

## Per-agent matrix

| Agent | Reads | Writes (autonomous) | Requires approval for |
| --- | --- | --- | --- |
| Cora | All | Routing, status updates, decision packets | Anything irreversible |
| Piper | TODO | Intent docs, acceptance criteria | TODO |
| Nova | TODO | Research notes, references | TODO |
| Theo | TODO | Architecture docs, ADRs | TODO |
| Iris | TODO | UI specs, design tokens | TODO |
| Mira | TODO | Code in branches, PRs | Merging to `main`, deploys |
| Tess | TODO | Test plans, test runs, bug reports | TODO |
| Rune | TODO | Reviews, audits, threat models | TODO |

## Related

- Escalation rules: [escalation-rules.md](escalation-rules.md)
- Approval policy: [../governance/approval-policy.md](../governance/approval-policy.md)
- Night mode policy: [../governance/night-mode-policy.md](../governance/night-mode-policy.md)
