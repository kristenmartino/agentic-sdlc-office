# Character Bible

Per-agent visual identity for v0.1. Used for placeholder rendering and for asset prompts later. Tone: professional + playful, not childish.

For each agent: a silhouette cue (shape that reads at 24px), a signature color, a signature prop, the room they live in, and 6 states.

States (shared across all agents):
- `idle` — neutral pose, slow breathing animation
- `thinking` — tilted head, small dot loop
- `working` — leaning forward, prop in use
- `talking` — open mouth, slight bob
- `blocked` — arms crossed, exclamation cue
- `done` — small celebratory glow

## Cora — Delivery Lead / Orchestrator

- **Silhouette:** rounded square with a small headset arc
- **Color:** warm amber (`#E6A23C`)
- **Prop:** clipboard with a glowing edge
- **Room:** Human Office
- **Notes:** the only agent that can stand at the human's desk

## Piper — Product Strategist

- **Silhouette:** tall rectangle with a notebook outline
- **Color:** soft coral (`#FF6B6B`)
- **Prop:** open notebook
- **Room:** Product / Research

## Nova — Researcher

- **Silhouette:** rounded rectangle, magnifier overlay
- **Color:** deep blue (`#3B5BDB`)
- **Prop:** magnifying glass
- **Room:** Product / Research
- **Notes:** carries small stacks of paper when handing off

## Theo — Systems Architect

- **Silhouette:** wide rectangle with right-angled headline
- **Color:** slate (`#495057`)
- **Prop:** drafting compass
- **Room:** Architecture / Design

## Iris — UI Designer

- **Silhouette:** circle with a brush angle
- **Color:** lavender (`#9775FA`)
- **Prop:** color palette swatch
- **Room:** Architecture / Design

## Mira — Builder

- **Silhouette:** square with a screen overlay
- **Color:** green (`#37B24D`)
- **Prop:** monitor showing a cursor
- **Room:** Dev Floor

## Tess — QA Engineer

- **Silhouette:** rounded square with a checkbox
- **Color:** teal (`#0CA678`)
- **Prop:** clipboard with check marks
- **Room:** QA Lab

## Rune — Reviewer / Security

- **Silhouette:** square with a lock outline
- **Color:** dark indigo (`#5F3DC4`)
- **Prop:** magnifier + lock
- **Room:** Review / Security
- **Notes:** subtle red highlight when raising an anomaly

## Visual rules

- All silhouettes read at 24px minimum.
- Agents never share a primary color; collisions hurt at-a-glance recognition.
- Props animate only when status indicates activity (`working`, `talking`).
- A `done` state adds a soft halo, not confetti.

## Related

- Art direction: [art-direction.md](art-direction.md)
- Rooms: [room-bible.md](room-bible.md)
