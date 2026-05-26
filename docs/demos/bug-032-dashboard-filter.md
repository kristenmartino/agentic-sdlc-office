# Demo: BUG-032 Dashboard Filter

The incident-response counterpart to [req-014-dark-mode.md](req-014-dark-mode.md). A bug enters the office and forces the Observe → Intent loop to close.

## Setup

- Work item: `BUG-032 — Dashboard filter drops the date range`
- Starting state: Rune raises an anomaly from observation.

## Beats

1. **Observe.** Rune flags the anomaly.
2. **Intent.** Cora confirms the bug, opens a work item.
3. **Generate.** Nova produces a fix candidate.
4. **Validate.** Vale reproduces, runs regression.
5. **Govern.** Mira approves expedited deploy.
6. **Deploy.** Tess rolls out.
7. **Observe.** Rune confirms recovery.

## What we are showing off

- The loop closes — Observe can re-trigger Intent.
- Incident theme overlays (see [../design/theme-roadmap.md](../design/theme-roadmap.md)).
