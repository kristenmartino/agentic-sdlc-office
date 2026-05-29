# Observed Office — literal, cute, zoomable view of real sessions

Design spec for **observed mode**: rendering a *real* Claude Code session (and,
later, many of them) as a charming, legible, spatial scene a visual learner
would actually enjoy watching — not an idealized cartoon, and not a wall of
JSONL.

This doc captures a deliberate direction change and is the design source of
truth for observed mode. It does **not** change scripted mode.

## Why this exists (the pivot)

The original office dramatizes an **illustrative** model: 8 named specialists
(Piper→Nova→…→Cora) passing a work item through 8 rooms in a sequential relay.
That's a good *teaching cartoon* and scripted mode keeps it.

But real Claude Code sessions don't look like that. Grounded in two real data
points ([`real-transcript-discovery.md`](../architecture/real-transcript-discovery.md)
and a profiled multi-agent workflow run):

- A typical session is **one main agent** running a heavy, interleaved tool
  loop (read → edit → test → edit → test), **zero handoffs**, **no specialist
  division of labor**, ~10 `AskUserQuestion` human touchpoints, one compaction,
  ending by opening a PR.
- When a session *does* fan out, it's a **star** (one orchestrator → N generic,
  unlabeled, fractal workers → back to the orchestrator), **not** a relay.

So a *literal* render of a real session through the 8-specialist office shows
one room lit and seven dark — the "empty office" failure. The goal here is a
model that is **literal** (every animation maps 1:1 to a real event), **cute**
(a little character doing recognizable actions), and **legible** (a visual
learner can read it), all at once.

The honesty rule that makes both modes legitimate: **scripted mode is labeled
illustrative; observed mode is literal.** The app already carries this
distinction (`Scenario.source: "scripted" | "observed"`, observed read-only
banners, the `simulated P7` badges). No fabricated handoffs in observed mode.

## The zoom hierarchy

Observed mode is a 4-level zoom. Each level is "literal + cute," and each
nests inside the one above. **The single-session office (Level 1) is the MVP;**
everything above it is an additive layer that reuses it.

```
Campus / street      ── all your projects ───────────────  Level 4  (multi-project overview)
   └─ Building/floor  ── one project's lifecycle path ────  Level 3  (the "path" across sessions)
        └─ Office/zones ── one session ──────────────────  Level 2  (this doc's core)
             └─ Character + actions ── the events ────────  Level 1  (the cute vocabulary)
```

A visual learner can sit at any altitude: zoom all the way in to watch one
character work, or all the way out to glance at every project's health.

---

## Level 1–2: The Session Office (the MVP)

One real session = one office. Today's 8 specialist rooms are replaced, **for
observed mode only**, by **activity zones** that one character moves between.

### Zones

Crucially, the zones map onto `AgentStatus` values the mapper **already emits** —
so this is mostly a *rendering reframe*, not a new data pipeline.

| Zone | Lights up on (real event already emitted) | Existing status |
| --- | --- | --- |
| Reading Nook | `Read` / `Glob` / `Grep` tool_use | `reading` |
| Workbench | `Edit` / `Write` / `MultiEdit` + `artifact.produced` | `coding` |
| Test Lab | `Bash` test/build cmd + `quality_gate.passed/failed` | `testing` |
| Thinking Corner | `thinking` block (shape only — **never content**) | `thinking` |
| Human Desk | `AskUserQuestion` (read-only touchpoint) | `waiting_on_human` |
| Outbox | `pr-link` → `artifact.produced (code_pr)` | (terminal) |

`planning`, `designing`, `reviewing` zones exist in the status vocabulary and
can be added if real sessions surface those patterns; today the mapper doesn't
infer them, so they stay dormant rather than fabricated.

### The cute action vocabulary

The cuteness lives here — each real event has an instantly recognizable action.
This vocabulary *is* the visual-learner layer; it turns an event stream into
something watchable.

| Real event | Cute action |
| --- | --- |
| `Read`/`Glob`/`Grep` | character pulls a file off a shelf and reads it |
| `Edit`/`Write` | types at the bench; a file icon updates |
| `Bash` test → pass | runs to the test bench; green check / small celebration |
| `Bash` test → fail | red mark; character frowns |
| `thinking` | thought bubble (shape only, **no text** — privacy policy) |
| `AskUserQuestion` | turns to *you*, "?" bubble, waits at the Human Desk |
| `pr-link` | drops an envelope in the Outbox |
| subagent spawned | a helper character pops in, works a side desk, leaves |
| `compact_boundary` | a brief "tidying memory" beat |
| `blocker.raised` (hook/api error) | character stops, alert icon |

### The character(s)

- **One protagonist** for a normal session (mapped to the default office agent).
  No ensemble cast in observed mode — real sessions don't have one.
- **Helpers appear only on real fan-out.** A `Task`/subagent spawn pops a helper
  character into a side desk; it does its work and leaves (the honest star
  topology). Each helper is itself drillable — clicking it descends into *its*
  sub-session, which renders as its own Level-2 office (the fractal structure).

### Governance is the spine, and it's read-only

`AskUserQuestion` is the one real human-in-the-loop signal. It renders as a
charming "the agent turns to you" moment — **informational only**. Observed mode
never emits `decision.requested`/`approval.requested` (which would hang playback
with no resolver) and never surfaces a resolvable Decision Inbox item. If a
future feature wants to record these, it uses a new **non-blocking**
`human.consulted`-style event, never the scripted decision path.

## The watchability layer (the genuinely hard part)

A real session is **fast and dense** — hundreds of interleaved tool calls. A
naïve literal render teleports the character on every event (visual chaos).
Three mechanisms make literal *watchable*:

1. **Speed control.** Reuse the existing tick-based playback; let the user
   scrub/slow/fast-forward. (Already present for scripted mode.)
2. **Dwell / debounce.** The character stays in a zone until N contrary events,
   so an `edit→test→edit→test` loop reads as "working at the bench, occasionally
   checking tests" rather than a strobe.
3. **Aggregation.** Bursts collapse: 10 rapid edits render as "editing
   intensely" (one sustained action with a counter), not 10 separate hops.

This layer is where the design risk lives: too little smoothing = chaos; too
much = a lie about what actually happened. Tuning it against a real dense
session is the first thing to prototype.

---

## Level 3: The Project (the building / floor) — "the path"

One project = one `~/.claude/projects/<encoded-cwd>/` folder = N sessions.

A project's SDLC **path** is the **inter-session relay** established in the
orchestrator-chaining analysis: it is *not* a live in-app baton pass between
orchestrators (that doesn't exist in the data). It is a sequence of distinct
sessions stitched by **durable artifacts**:

```
session A (opens PR) ──▶ session B (reviews PR) ──▶ session C (fixes) ──▶ merge
        Generate              Validate                  Generate         Govern
```

This is exactly the loop this very project runs (build → external review →
follow-up fix session), and the cross-model review loop (Claude builds → another
model reviews → Claude revises → human merges) is its sharpest instance.

**Prerequisite — the join key.** Stitching sessions into a path requires a
stable key the mapper currently throws away: `workItem.branch` is left `null`
and each session mints its own `wi_observed_<sessionId>`. Populate
`workItem.branch` from the transcript's `gitBranch`, and index sessions by
PR/branch ref. Cheap, no-regret, and it's the only thing standing between
"a pile of sessions" and "a project path."

Render: the floor shows the ordered sessions as rooms-along-a-corridor (or a
ribbon), each drillable into its Level-2 office. Phase labels (Generate /
Validate / …) are **emergent** from what each session produced (opened a PR ⇒
a build session; only read + commented on a PR ⇒ a review session), never a
state machine an orchestrator drives.

## Level 4: The Campus (multi-project overview)

All projects at a glance. This is where the product becomes a **personal
command center** for everything your agents are doing — the original
control-room pitch, now honestly grounded in data you already have (~10+ project
folders on disk today).

- **Ambient, not constantly animated.** Most projects are dormant at any moment.
  The campus shows status (last active, current phase, blocked, PR awaiting your
  review) — a busy building vs. a sleepy one. Only the project you zoom into
  animates live.
- **Cross-project Decision Inbox** — the payoff feature: *"3 projects need you —
  a PR awaiting merge here, a blocked session there."* Governance at portfolio
  scale, which nothing else renders cutely.
- **Metadata-only at this level.** You cannot hold 50 sessions × ~24 MB in
  memory. The campus reads a lightweight index (title, last activity, PR status)
  and lazy-loads a full transcript only on zoom-in.

## Honesty & privacy invariants (carried forward, already built)

These hold at every zoom level and are non-negotiable:

- **Read-only.** Observed mode never writes, merges, deploys, or emits
  resolvable decisions/approvals.
- **`thinking` is never rendered.** Shape/indicator only, never the text.
- **Redaction on everything rendered.** Bash commands → category labels only;
  stderr/paths/GitHub URLs sanitized; MCP server names dropped; attachments
  opaque. (Shipped in the redaction work — load-bearing at multi-project scale.)
- **No fabricated handoffs.** Observed motion is the one character's real zone
  hops + real subagent spawns. The 8-agent relay stays in scripted mode only.

## What this reuses vs. what's new

**Reuses (most of the stack already exists):**
- Event-sourced model (`WorkflowEvent[]`, `applyEvent`) — fits unchanged.
- The transcript mapper (parses real sessions → events) — needs the zone/phase
  reframe and the join key, but the parse/validate/redact pipeline is built.
- Sprite + room rendering + Framer Motion movement — rooms become zones.
- StatusBubble, ActivityLog, tick playback, observed read-only banners.
- Redaction + governance touchpoint handling.

**New:**
- Zone reframe + the event→cute-action vocabulary (Level 1–2).
- The watchability layer: speed / dwell / aggregation.
- The branch/PR join key + a session index (Level 3).
- The campus overview + lazy metadata index + cross-project Decision Inbox
  (Level 4).

## Sequencing (each step independently shippable)

1. **Single-session literal cute office** — zones + action vocabulary +
   watchability. The MVP; nothing above matters until this is worth watching.
2. **Capture the branch/PR join key** — cheap, no-regret, unlocks Level 3.
3. **Single-project path** — stitch one project's sessions into a lifecycle thread.
4. **Multi-project campus** — overview + cross-project Decision Inbox.

## Open questions / risks

- **Density tuning is unproven.** Whether dwell+aggregation produces something
  charming (vs. either chaotic or dishonestly smooth) needs a prototype against
  a real dense session. This is the make-or-break.
- **Observed mode permanently loses the ensemble charm.** Real sessions are
  "one character doing a lot," not eight handing off. If the relay was the
  cutest part, that charm lives only in scripted mode now.
- **n is small.** Session-shape assumptions rest on two real samples (one solo,
  one fan-out). More real sessions may reveal patterns the zone set misses.
- **"Literal" reopens the ingestion path.** Unlike the illustrative cartoon,
  this needs the parser/file-loader work to actually run on real files. The
  redaction work already shipped is what makes that safe.

## Related

- Real session shape: [`../architecture/real-transcript-discovery.md`](../architecture/real-transcript-discovery.md)
- Transcript format + privacy stance: [`../architecture/claude-code-transcript-format.md`](../architecture/claude-code-transcript-format.md)
- Scripted (illustrative) model: [`character-bible.md`](character-bible.md), [`room-bible.md`](room-bible.md)
- Event model: [`../workflow/event-model.md`](../workflow/event-model.md)
