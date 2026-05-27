# Approval Policy

When a human must approve before an agent proceeds. This is the master rule list; per-agent specifics live in [../agents/permissions.md](../agents/permissions.md) and per-action escalations in [../agents/escalation-rules.md](../agents/escalation-rules.md).

## Default

- **Read** operations: no approval.
- **Write to own artifacts** (research notes, design drafts, scoped code in a branch): no approval.
- **Write to shared artifacts** (PR drafts, docs that affect multiple agents): no approval, but log the change.
- **Write to protected state** (merging, deploying, sending external messages, modifying CI/secrets): **requires human approval.**
- **Irreversible operations** (delete files at scale, force-push, drop data): **always requires human approval, every time.**

## Per-action table

| Action | Required level | Approval needed? | Notes |
| --- | --- | --- | --- |
| Read repo / docs / prompts | P0 | No | — |
| Write research notes / design specs | P2 | No | Lands as a commit under `/docs` |
| Modify or add tests | P3 | No | Within test directories only |
| Edit production code in a feature scope | P4 | No (within scope) | Outside scope → escalate to Cora |
| Open a draft PR | P5 | No | PR title prefixed `[draft]` |
| Mark PR ready for review | P5 → P6 | No | Triggers Rune review automatically |
| Merge to a non-protected branch | P5 | No | Allowed for stacked branches |
| Merge to `main` | **P7** | **Yes** | Decision Inbox entry; human-only |
| Deploy to non-prod | **P6** | No | Via allowlisted adapter |
| Deploy to production | **P7** | **Yes** | Decision Inbox entry; human-only |
| Send an external message (Slack, email) | **P7** | **Yes** | Human-only, every time |
| Delete files at scale (>10 files) | **P7** | **Yes** | Irreversible — always approve |
| Force-push to any branch | **P7** | **Yes** | Irreversible |
| Modify CI / secrets / `.github/workflows` | **P7** | **Yes** | High blast radius |
| Install a new dependency | **P6** | **Yes** | Adds supply-chain surface |
| Run a cost-incurring job (LLM batch, build farm) | **P6** | **Yes** | Budget guard |
| Edit `.claude/` runtime config | **P7** | **Yes** | Affects agent behavior |

## Approval channel

All approvals flow through the **Decision Inbox** (see [../workflow/decision-model.md](../workflow/decision-model.md)). Agents do not DM the human; they emit a `decision.requested` event, which surfaces in the inbox. The human's resolution emits `decision.resolved`, which unblocks the agent.

## Logging

Every approval-gated action produces an audit pair:
1. `approval.requested` — when the agent asks
2. `approval.resolved` — when the human answers

Both are part of the event stream and replayable.

## Related

- Permissions: [../agents/permissions.md](../agents/permissions.md)
- Escalation rules: [../agents/escalation-rules.md](../agents/escalation-rules.md)
- Decision model: [../workflow/decision-model.md](../workflow/decision-model.md)
