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

**Some zones map to status transitions the mapper emits today; others require a
small mapper addition.** This distinction matters — it's the difference between
"a rendering reframe" and "new mapper work." Don't conflate "the value exists in
the `AgentStatus` union" with "the mapper emits this transition."

**Already emitted today** (verified in `claude-code-transcript-mapper.ts` —
`setStatus` only ever emits these four):

| Zone | Lights up on | Status emitted today |
| --- | --- | --- |
| Reading Nook | `Read` / `Glob` / `Grep` tool_use | `reading` ✅ |
| Workbench | `Edit` / `Write` / `MultiEdit` + `artifact.produced` | `coding` ✅ |
| Test Lab | `Bash` test/build cmd + `quality_gate.passed/failed` | `testing` ✅ |
| (any zone) | tool failure | `failed` ✅ |

**Requires a small mapper addition** (the signal exists in the transcript but the
mapper currently drops it or emits it as a neutral message):

| Zone | Real signal | Today | Needs |
| --- | --- | --- | --- |
| Thinking Corner | `thinking` block | **dropped** (`continue`) | emit a neutral status *pulse* — shape only, **never the text** |
| Human Desk | `AskUserQuestion` | neutral `agent.message.sent` | a non-blocking `human_consulted` marker (see Governance — *not* `waiting_on_human`, which reads as present-tense "blocked on you") |
| Outbox | `pr-link` | `artifact.produced (code_pr)`, no status | a terminal Outbox/`done` visual state |
| (transition) | `compact_boundary` | marker message | a "tidying memory" visual beat |

`planning`, `designing`, `reviewing` zones exist in the status vocabulary but the
mapper never infers them — they stay dormant rather than fabricated. The point:
the zone *reframe* is cheap, but it is **not** free — budget the four small
mapper additions above as part of the MVP, not as "already done."

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
- **MVP: a "helper requested" badge, not a helper character.** `Task` /
  `TaskCreate` / `TaskUpdate` are **log-only today** — the mapper does not expand
  subagents, and locating/associating the sidechain `agent-*.jsonl` files is
  unbuilt. So for the MVP a fan-out shows a small "helper requested" badge on the
  protagonist, nothing more.
- **Helper characters + fractal drill-down are post-MVP (v0.3+).** The honest
  star topology — a helper pops into a side desk, works, leaves, and is clickable
  to descend into *its* own Level-2 office — is the right end state, but it
  depends on subagent expansion, which the discovery doc already scopes as a
  separate v0.3 task. Do **not** build drill-down into the MVP.

### Governance is the spine, and it's read-only

`AskUserQuestion` is the one real human-in-the-loop signal. It renders as a
charming "the agent turns to you" moment — **informational only**. Observed mode
never emits `decision.requested`/`approval.requested` (which would hang playback
with no resolver) and never surfaces a resolvable Decision Inbox item. If a
future feature wants to record these, it uses a new **non-blocking**
`human.consulted`-style event, never the scripted decision path.

**Use a dedicated `human_consulted` / `human_touchpoint` marker — not the
`waiting_on_human` status.** Precision worth recording: `waiting_on_human` is an
`AgentStatus` and is purely cosmetic today (a pulsing orange bubble + label in
`StatusBubble`/`AgentSprite`); it is *not* actionable. The actionable state is
the separate `awaiting_human` **runState**, which halts the tick loop and is what
this doc keeps out of observed mode. So the risk isn't state-machine coupling —
it's **honest tense**. The pulsing "waiting on human" bubble reads as present-tense
*"the app is blocked on you right now,"* which is a lie in a replay where the human
was consulted in the *past*. A `human_consulted` marker says "a human was asked
here" — past, informational, correct. Only fall back to `waiting_on_human` if the
renderer guarantees it reads as informational in observed mode.

## The watchability layer — a first-class reducer, not a design note

A real session is **fast and dense** — hundreds of interleaved tool calls. A
naïve literal render teleports the character on every event (visual chaos). This
is **make-or-break** and it is **part of the MVP**, not a later nicety (see
Sequencing — and note this is the one place this doc holds a position against the
review, which deferred it to a later phase; without it the single-session office
isn't watchable *at all*, so it can't be deferred).

Make it a **named, pure, testable module** that sits between the event stream and
the renderer — same ethos as `applyEvent` / `validateScenario` / `timelinePosition`.
Left as a vague "design note," dwell/aggregation logic will get bolted into a
React effect and become untestable.

```ts
// ObservedPlaybackReducer
//   Input:  WorkflowEvent[]      (the literal, ordered event stream)
//   Output: VisualBeat[]         (what the renderer actually animates)
//
// Responsibilities:
//   - coalesce repeated same-zone events into one sustained beat
//   - enforce a minimum dwell time per zone (no strobing)
//   - group edit→test→edit loops into a single composite "working" beat
//   - PRESERVE truth: every beat carries its underlying event count + ids,
//     so drill-down and the activity log stay literal (the smoothing is a
//     view concern, never a data-loss concern)

interface VisualBeat {
  id: string;                  // stable key for the renderer
  zone: ObservedZone;          // reading | coding | testing | thinking | human | outbox
  action:                      // the specific cute action — zone alone is too coarse
    | "read" | "edit" | "test_run" | "test_pass" | "test_fail"
    | "think" | "human_consulted" | "outbox" | "compact" | "blocked";
  severity?: "info" | "success" | "warning" | "error";  // drives color/tone
  startTs: string;
  endTs: string;
  eventCount: number;          // how many raw events collapsed into this beat
  eventIds: string[];          // drill-down handle — preserves literal truth
  label: string;               // e.g. "editing intensely (12 edits)"
  intensity?: number;          // optional, for animation weight
}
```

Plus **speed control** (reuse the existing tick-based playback — scrub / slow /
fast-forward; already present for scripted mode).

This module is where the design risk lives: too little smoothing = chaos; too
much = a lie about what happened. The invariant that keeps it honest is
*preserve-truth*: beats are a presentation grouping over the real events, never a
replacement for them. **Prototyping this reducer against one real dense session —
and judging whether the result is pleasant to watch — is the single first thing
to build.**

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

**Prerequisite — the join key (and it's not as simple as "use the branch").**
Stitching sessions into a path requires a stable key the mapper currently throws
away (`workItem.branch` is `null`; each session mints its own
`wi_observed_<sessionId>`). But branches get reused, renamed, deleted, and shared
across unrelated sessions, and `gitBranch` is present on *many* but not *all*
transcript lines — so "populate branch from `gitBranch`" alone over-claims
continuity. Use a **precedence with explicit confidence**, and never draw a path
edge above the confidence the data supports:

| Join key (in precedence order) | Confidence |
| --- | --- |
| PR URL, **or** repo + PR number (from `pr-link`) | **high** |
| repo + `gitBranch` + `cwd` | **medium** |
| bare PR number (no repo) | **low** — a PR number isn't globally unique |
| encoded project folder + `sessionId` (fallback) | **low** (no real cross-session claim) |

This directly answers the orchestrator-chaining panel's "reconstruction
fragility" warning: a *wrong* lifecycle graph is worse than honestly showing
disconnected sessions. Render low-confidence links as dotted/uncertain, or not at
all — never as a confident relay.

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
  memory. The campus reads a lightweight index and lazy-loads a full transcript
  only on zoom-in. Draft index shape (define it *before* any campus UI work, so
  it doesn't sprawl — but this is Level 4, not to be built until 1–3 prove out):

  ```ts
  interface ObservedSessionIndexEntry {
    sessionId: string;
    projectKey: string;          // the join key (see Level 3 precedence)
    cwdHash: string;             // hashed, never the raw path
    repo?: string;
    branch?: string;
    prUrl?: string;
    title: string;               // custom-title > user prompt > ai-title
    startedAt: string;
    endedAt?: string;
    eventCount: number;
    lastStatus: AgentStatus;
    producedArtifactKinds: string[];
    blockerCount: number;
    humanTouchpointCount: number;  // AskUserQuestion count
    transcriptPath?: string;       // local-only; opaque/redacted in UI
  }
  ```

  `projectKey` is derived from the same precedence as the Level-3 join key, so
  Levels 3 and 4 can never invent incompatible keys:

  ```ts
  projectKey =
      `pr:${normalizedPrUrl}`                       // high   (PR URL, or repo + PR#)
    | `repo-branch:${repo}#${branch}#${cwdHash}`    // medium
    | `session:${encodedProjectFolder}#${sessionId}` // low (no cross-session claim)
  ```

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
- Zone reframe + the event→cute-action vocabulary, **plus four small mapper
  additions** (thinking pulse, human-desk status, outbox terminal, compaction
  beat) — the zone reframe is cheap but not free (Level 1–2).
- The `ObservedPlaybackReducer` (`WorkflowEvent[] → VisualBeat[]`) + speed control.
- The branch/PR join key **with confidence precedence** + a session index (Level 3).
- Subagent expansion → real helper characters + drill-down (v0.3; MVP is a badge).
- The campus overview + lazy metadata index + cross-project Decision Inbox
  (Level 4).

## Sequencing (each step independently shippable)

**Spike 0 — the watchability prototype (do this first, before anything else).**
One real dense transcript → `WorkflowEvent[]` → `ObservedPlaybackReducer` →
`VisualBeat[]` → rough visual playback. The *entire* question that gates the
product: **is a real dense session pleasant to watch once smoothed?** This is a
throwaway prototype, not production UI — no zones polish, no campus, no join key.
If the answer is "no, even smoothed it's noise or it's a lie," stop here; nothing
downstream matters. Keeping this separate from the MVP protects against a bloated
"MVP" that stalls before the hard question is even asked.

1. **MVP — single-session literal cute office** — zones (the four already-emitted
   + the four small mapper additions: thinking pulse, `human_consulted`, outbox,
   compaction) + the productionized `ObservedPlaybackReducer` + the cute action
   vocabulary + a privacy-safe activity log. Subagent fan-out shows only a
   **"helper requested" badge**.
2. **Capture the branch/PR join key** (with the confidence precedence) — cheap,
   no-regret, unlocks Level 3.
3. **Single-project path** — stitch one project's sessions into a lifecycle
   thread, links drawn only at the confidence the join key supports.
4. **Subagent expansion + helper characters / drill-down** (v0.3) — locate and
   associate sidechain `agent-*.jsonl` files; promote the badge to a real
   drillable helper.
5. **Multi-project campus** — the metadata index + overview + cross-project
   Decision Inbox. Furthest out; don't build until 1–3 are worth zooming into.

The watchability reducer appears in **both** Spike 0 (throwaway, to answer the
gating question) and the MVP (productionized). It is never *deferred* — see the
note below.

> **One disagreement with the review, recorded deliberately:** the review's
> sequencing bullets placed the watchability reducer *after* the MVP, but its own
> closing line calls "prototype one dense session with a watchability reducer" the
> right next move. Those conflict; this doc keeps watchability **in** the MVP,
> because a single-session office without it isn't watchable at all. Everything
> else from the review (zone-status precision, the reducer as a first-class
> module, subagent drill-down → v0.3, join-key confidence, the index schema) is
> adopted.

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
