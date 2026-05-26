# Office / Room System

The 8 rooms of the v0.1 office.

| Room ID | Name | Primary modes | Primary agents | Purpose |
| --- | --- | --- | --- | --- |
| `lobby` | Lobby | — | (visitors) | Entry, work-item arrival surface |
| `product-research` | Product / Research | Intent | Piper, Nova | Capture intent, research prior art |
| `architecture-design` | Architecture / Design | Generate | Theo, Iris | Plan structure, design UI |
| `dev-floor` | Dev Floor | Generate | Mira | Implementation |
| `qa-lab` | QA Lab | Validate | Tess | Test, regress |
| `review-security` | Review / Security | Validate, Govern | Rune | Code review, audits |
| `human-office` | Human Office | Govern | Cora, human | Decision Inbox lives here |
| `archive` | Archive | — | — | Completed work, replay source |

## Layout principles

- Movement between rooms is *legible* — you can see when work changes hands.
- Each room has a signature element (props, lighting, signage) defined in [room-bible.md](room-bible.md).
- The Human Office is visually distinct (warmer light, larger desk) to signal where humans actually live.

## v0.1 collapsing

We are intentionally collapsing the 16-room "full office" design to 8 rooms for v0.1 (see DEC-003). Expansion happens in v0.4.

## Related

- Room visual rules: [room-bible.md](room-bible.md)
- Art direction: [art-direction.md](art-direction.md)
- Theme roadmap: [theme-roadmap.md](theme-roadmap.md)
