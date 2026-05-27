# Night Mode Policy

What agents may do when no human is watching. "Night" = any window where no human is expected to respond to the Decision Inbox within 30 minutes.

## Allowed at night

- Read-only work: research, indexing, reading docs, analyzing existing code (any agent at P0–P1).
- Scoped code writes within an open work item that has acceptance criteria (P4) — but **PRs stay in draft**.
- Test writes (P3).
- Doc writes (P2).
- Generating drafts of artifacts that won't be visible externally (design specs, research notes).
- Local builds and tests against existing acceptance criteria.

## Not allowed at night

- Merging anything (P7).
- Deploying anything (P7).
- External messages — Slack, email, comments on third-party platforms (P7).
- Force-push, branch deletion, file deletion at scale (P7).
- Installing new dependencies (P6, requires approval).
- CI / secrets / workflow file edits (P7).
- Cost-incurring jobs that exceed the per-run budget (P6, requires approval).
- Resolving Decision Inbox entries on the human's behalf (P7).
- Picking up a new work item that wasn't in flight at sundown — finish what's open; don't start what's new.

## Wake conditions

Cora wakes the human (paging channel, not Decision Inbox) when:
- A P7 action becomes necessary to make any progress on the current work item.
- A blocker has been unresolved for > 2 hours and no other work item is unblocked.
- An agent has failed the same step 3+ times.
- Test or build infrastructure is down.
- A security finding rated High or higher is raised by Rune.
- The event stream has stopped emitting for > 15 minutes (likely runtime fault).

## Budget guardrails (overnight)

- LLM tokens: cap per agent per hour configured in `src/data/`.
- Total run time: hard stop at 8 hours; pause and wait for morning review.
- File-change rate: > 200 files touched in 1 hour triggers an automatic pause + Cora morning report.

## Morning report

When the human returns, Cora delivers a single summary in the Decision Inbox:
- Work items advanced
- Blockers raised (open / cleared)
- Decisions waiting
- Risk surface (anything Rune flagged)
- Budget consumed

## Related

- Permissions: [../agents/permissions.md](../agents/permissions.md)
- Approval policy: [approval-policy.md](approval-policy.md)
- Decision model: [../workflow/decision-model.md](../workflow/decision-model.md)
