# Escalation Rules

When and how an agent surfaces work. The single human-facing channel is the Decision Inbox; Cora is the only agent who places things there.

## Any agent may *request* human input

Any agent (Piper, Nova, Theo, Iris, Mira, Tess, Rune) can emit `decision.requested` when they hit a real choice. The event lands in Cora's queue. Cora formats it as a Decision Packet and adds it to the Decision Inbox. The human resolves it. The resolution emits `decision.resolved`, which unblocks the original agent.

Agents do **not** post directly to the human. The single-channel discipline is what makes the inbox useful.

## Always escalate to a human (via Cora)

- Irreversible actions: production deploys, external messages, financial actions, mass deletions.
- Actions that exceed the agent's permission level (see [permissions.md](permissions.md)).
- Two agents in unresolvable disagreement about scope or approach.
- The same step has failed 3+ times.
- A High-rated security finding from Rune.
- Cost guardrail trip (LLM token or job budget).

## Escalate to Cora (intra-office, no human yet)

- Routing conflicts (two agents want the same work item).
- A quality gate failed and the owning agent doesn't know how to proceed.
- An ADLC-mode boundary question (e.g. "is this Generate or Validate?").
- A blocker that may be resolvable by reassigning the work item.

Cora may resolve these without waking the human if they're internal.

## Wake-the-human conditions (overnight)

See [../governance/night-mode-policy.md](../governance/night-mode-policy.md). At minimum:
- Unresolved blocker > 2 hours with no other work item moving.
- Event stream stops for > 15 minutes.
- Any High-rated security finding.

## Output format

Every escalation produces an event pair:
- `decision.requested` with `{ work_item, question, options, recommendation }`, OR
- `blocker.raised` with `{ work_item, kind, description }`.

Resolution events `decision.resolved` and `blocker.cleared` are the unblock signal.

## Related

- Permissions: [permissions.md](permissions.md)
- Approval policy: [../governance/approval-policy.md](../governance/approval-policy.md)
- Decision model: [../workflow/decision-model.md](../workflow/decision-model.md)
- Night mode: [../governance/night-mode-policy.md](../governance/night-mode-policy.md)
