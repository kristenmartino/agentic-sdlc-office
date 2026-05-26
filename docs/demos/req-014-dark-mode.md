# Demo: REQ-014 Add Dark Mode

The canonical happy-path scenario. A feature request enters the office and moves through every specialty without incident.

## Setup

- Work item: `REQ-014 — Add dark mode to dashboard`
- Starting state: empty office, agents idle in their primary rooms

## Beats (handoff sequence)

1. **Piper** captures intent in Product / Research. Writes acceptance criteria.
2. **Nova** researches prior art (token systems, accessibility constraints).
3. **Theo** plans the implementation in Architecture / Design — token naming, dark-token override strategy.
4. **Iris** designs the dark variants and microcopy for the toggle.
5. **Mira** builds on the Dev Floor — branch, implementation, PR.
6. **Tess** validates in the QA Lab — contrast checks, regression on key flows.
7. **Rune** reviews for security/UX issues in Review / Security.
8. **Cora** brings the open decision (e.g. naming `--surface-1` vs `--bg-1`) to the Human Office.

## Open decision in this run

`What do we name the dark surface tokens?` — surfaced to Kristen via the Decision Inbox.

## What we are showing off

- Agents move between rooms; handoffs are visible.
- Decisions surface only when a human is needed.
- The activity log shows the whole run.
- The work item drawer shows artifacts, blockers, and quality gates per beat.
- Replayable from the event stream.
