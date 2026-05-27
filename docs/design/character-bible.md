# Character Bible

Per-agent visual identity for v0.1. Used for placeholder rendering and for asset prompts later. Tone: professional + playful, not childish.

For each agent: a silhouette cue (shape that reads at 24px), a signature color, a signature prop, the room they live in, and a shared set of states.

States (shared across all agents — exactly the values of `AgentStatus` in [`src/types/agents.ts`](../../src/types/agents.ts); the scenario validator rejects any other value):

- `idle` — neutral pose, slow breathing animation
- `thinking` — tilted head, small dot loop
- `reading` — head down at file/book/screen, subtle scan motion
- `planning` — writing on a board or blueprint
- `designing` — arranging components, color/token cue
- `coding` — typing, terminal glow, cursor pulse
- `testing` — checklist/lab action, test pulse
- `reviewing` — magnifier or audit posture
- `talking` — speech bubble, slight bob
- `meeting` — grouped/roundtable posture
- `waiting_on_agent` — yellow wait indicator, gaze toward the target agent
- `waiting_on_human` — amber/red wait indicator, standing near the Human Office
- `blocked` — exclamation cue, arms crossed or stopped posture
- `done` — soft halo / checkmark, no confetti
- `failed` — red error cue, broken-test or bug indicator

These map 1:1 to `STATUS_COLOR` and `STATUS_LABEL` in [`src/components/office/StatusBubble.tsx`](../../src/components/office/StatusBubble.tsx). Add a state in code first, then this doc, then asset prompts.

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
- Props animate only when status indicates active work: `reading`, `planning`, `designing`, `coding`, `testing`, `reviewing`, `talking`, or `meeting`. Idle, waiting, blocked, done, and failed states hold still.
- A `done` state adds a soft halo, not confetti.
- A `failed` state shows a red error cue; the agent does not animate but the prop does not disappear.

## Related

- Art direction: [art-direction.md](art-direction.md)
- Rooms: [room-bible.md](room-bible.md)
