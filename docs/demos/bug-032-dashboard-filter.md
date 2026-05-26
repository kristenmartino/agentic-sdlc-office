# Demo: BUG-032 Dashboard Filter

The incident-response counterpart to [req-014-dark-mode.md](req-014-dark-mode.md). A bug enters the office and forces the Observe → Intent loop to close.

## Setup

- Work item: `BUG-032 — Dashboard filter drops the date range`
- Starting state: Rune raises an anomaly from observation.

## Beats (handoff sequence)

1. **Rune** flags the anomaly in Review / Security.
2. **Piper** confirms the bug, opens a work item, sets priority.
3. **Nova** investigates root cause and pulls comparable past incidents.
4. **Theo** scopes the fix shape; rules out wider refactor.
5. **Mira** produces a fix candidate on the Dev Floor.
6. **Tess** reproduces, runs regression in the QA Lab.
7. **Rune** approves expedited review.
8. **Cora** routes deploy approval to the Human Office.

## Open decision in this run

`Roll forward or roll back?` — surfaced via Decision Inbox.

## What we are showing off

- Observe can re-trigger Intent (the loop closes).
- Incident theme overlays (see [../design/theme-roadmap.md](../design/theme-roadmap.md)).
- Higher urgency visuals — faster animations, attention pulses.
