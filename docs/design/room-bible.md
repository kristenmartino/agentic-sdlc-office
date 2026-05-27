# Room Bible

The 8 rooms of the v0.1 office. Each room maps to one or more ADLC modes and houses specific agents. The source-of-truth IDs and agent assignments live in [office-room-system.md](office-room-system.md); this file describes visual rules.

| Room ID | Name | Primary agents | Signature element | Lighting |
| --- | --- | --- | --- | --- |
| `lobby` | Lobby | (visitors only) | Welcome desk + arrival panel | Bright, neutral |
| `product-research` | Product / Research | Piper, Nova | Whiteboard wall + stack of papers | Warm, focused |
| `architecture-design` | Architecture / Design | Theo, Iris | Drafting table + system diagram | Cool, even |
| `dev-floor` | Dev Floor | Mira | Coding station + monitor cluster | Cool, slightly dim |
| `qa-lab` | QA Lab | Tess | Test bench + checklist board | Bright, clinical |
| `review-security` | Review / Security | Rune | Inspection desk + audit log | Cool, dim |
| `human-office` | Human Office | Cora, human | Larger desk + Decision Inbox panel | Warm, prominent |
| `archive` | Archive | (idle work items) | Filing wall + run replay panel | Dim, neutral |

## Per-room visual rules

- **Lobby** — entry point for new work items. A floating card animates in here when a work item is created. Empty in idle state.
- **Product / Research** — visible whiteboard updates with acceptance criteria when Piper writes them; bookshelf glows softly when Nova is reading.
- **Architecture / Design** — diagram surface shows system shapes drawn live; designer easel shows current screens.
- **Dev Floor** — Mira's monitor cluster cycles through "branch", "build", "PR" indicators based on current step.
- **QA Lab** — checklist board flips items as Tess completes them; red flag on regressions.
- **Review / Security** — audit log shows scrolling text; lock icon when Rune is reviewing.
- **Human Office** — visually emphasized (slightly larger, warmer light). The Decision Inbox panel is mounted on its back wall.
- **Archive** — completed work items drift here; a "replay" button is visible on each archived card.

## Movement rules

- Agents traverse between rooms along visible paths (corridor lines).
- A handoff between agents is depicted by an artifact packet moving between rooms before the receiving agent's status changes.
- An idle agent stays in their primary room.

## Density

The 8 rooms are arranged on a 2×4 grid (rows × columns), readable in one screen at 1280×720+. No scroll required at desktop sizes.

## Related

- Source-of-truth room IDs and agent assignments: [office-room-system.md](office-room-system.md)
- Art direction: [art-direction.md](art-direction.md)
- Character visuals: [character-bible.md](character-bible.md)
- Theme variants: [theme-roadmap.md](theme-roadmap.md)
