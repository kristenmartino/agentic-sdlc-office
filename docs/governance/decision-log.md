# Decision Log

Append-only record of decisions resolved during v0.1. Each entry links back to its Decision issue.

| # | Date | Decision | Chosen | Reversible? | Issue / PRs |
| --- | --- | --- | --- | --- | --- |
| DEC-001 | 2026-05-27 | Visual style for v0.1 | Polished vector silhouettes (placeholder, not pixel art) | Partially | [#11](https://github.com/kristenmartino/agentic-sdlc-office/issues/11) · shipped in [#18](https://github.com/kristenmartino/agentic-sdlc-office/pull/18), [#19](https://github.com/kristenmartino/agentic-sdlc-office/pull/19) |
| DEC-002 | 2026-05-27 | Visual engine | DOM/CSS + React (Next.js 15, React 19, Tailwind, Framer Motion) — no PixiJS / Phaser / Rive in v0.1 | Yes (engine swap cost is real but tractable before assets exist) | [#12](https://github.com/kristenmartino/agentic-sdlc-office/issues/12) · shipped in [#18](https://github.com/kristenmartino/agentic-sdlc-office/pull/18) |
| DEC-003 | 2026-05-27 | First MVP room set | 8-room collapsed MVP (Lobby, Product/Research, Architecture/Design, Dev Floor, QA Lab, Review/Security, Human Office, Archive) | Yes (adding rooms later is additive) | [#13](https://github.com/kristenmartino/agentic-sdlc-office/issues/13) · shipped in [#18](https://github.com/kristenmartino/agentic-sdlc-office/pull/18) |
| DEC-004 | 2026-05-27 | First demo scenario | REQ-014 Add dark mode (happy path). BUG-032 added later as incident counterpart. | Yes | [#14](https://github.com/kristenmartino/agentic-sdlc-office/issues/14) · shipped in [#18](https://github.com/kristenmartino/agentic-sdlc-office/pull/18), [#21](https://github.com/kristenmartino/agentic-sdlc-office/pull/21) |
| DEC-005 | 2026-05-27 | Project name / codename | "Agentic SDLC Office" stays as the working title through v1.0 | Yes (rename is easy until external links accumulate) | [#15](https://github.com/kristenmartino/agentic-sdlc-office/issues/15) |
| DEC-006 | 2026-05-27 | Use Rive in v0.1, or defer? | Defer Rive — v0.1 uses Framer Motion `layoutId` for sprite movement. Revisit in v0.4. | Yes | [#16](https://github.com/kristenmartino/agentic-sdlc-office/issues/16) · shipped in [#18](https://github.com/kristenmartino/agentic-sdlc-office/pull/18), [#19](https://github.com/kristenmartino/agentic-sdlc-office/pull/19) |
| DEC-007 | 2026-05-27 | Asset generation stack | Placeholders first (inline SVG silhouettes + room decor). Upgrade to Figma/Firefly/Scenario after DEC-001 lands. | Yes | [#17](https://github.com/kristenmartino/agentic-sdlc-office/issues/17) · shipped in [#19](https://github.com/kristenmartino/agentic-sdlc-office/pull/19) |

## How to add an entry

1. Resolve the Decision issue with the chosen option.
2. Append a row above with the date (UTC), decision title, chosen option, reversibility, and PR links.
3. If reversible: note the condition that would cause us to revisit (in the Chosen column or in the PR description).
4. Close the GitHub Decision issue with a comment summarizing the resolution.

## Decisions deferred to v0.2+

- Real Claude Code event ingestion model (read-only first, then write).
- Local storage backend beyond `localStorage` (IndexedDB? embedded SQLite?).
- Whether v0.4 keeps placeholder visuals or commissions a final art pass.

See [`docs/product/now-next-later-never.md`](../product/now-next-later-never.md) for the broader roadmap context.
