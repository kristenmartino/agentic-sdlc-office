# Agentic SDLC Office

> A visual control room for AI-native software delivery. It helps humans understand, supervise, and govern autonomous coding agents — making the work visible, replayable, inspectable, and human-governed.

The app has **two modes**, and they answer two different questions:

| Mode | What it is | Best for |
| --- | --- | --- |
| **Scripted** (v0.1) | An idealized 8-agent SDLC office — work moves through eight specialist rooms in a relay while a human governs from a Decision Inbox. Hand-authored event streams; no real LLM calls. | The *operating-model cartoon* — teaching/portfolio demo of how an agentic SDLC is *meant* to flow. |
| **Observed** (v0.2 preview) | A read-only Claude Code *transcript playback model* — one protagonist moving through activity zones (reading → coding → testing → …), built from transcript-shaped events. The current demo plays a synthetic sample matching the real transcript shape; loading a real redacted session is future work. | The *honest-tool direction* — what an agent session actually did, smoothed enough to watch. |

Scripted mode is the illustration; observed mode is the literal view. The app is explicit about which is which (a `v0.2 · observed` chip, a read-only banner, and `simulated P7` badges in scripted mode).

## What you'll see

### Scripted mode — the 8-agent relay
- **Two scenarios.** `REQ-014 — Add dark mode` (happy-path feature) and `BUG-032 — Filter loses date range` (Observe → Intent incident loop).
- **8 agents, 8 rooms.** Each agent (Cora, Piper, Nova, Theo, Iris, Mira, Tess, Rune) has a distinct silhouette, a primary room, and a live status. Sprites physically move between rooms as ownership transfers; a Phase Timeline shows position in the chain.
- **Human-in-the-loop.** The Decision Inbox surfaces decisions and **simulated P7 approvals** for merges/deploys.
- **Replay + scrub.** The Activity Log lists every event; click any past event to scrub state to that point. localStorage persists across refreshes.

### Observed mode — transcript playback
- **One scenario today:** `Observed — Refactor button (v0.2 preview)`, played from a synthetic sample that matches the real Claude Code transcript shape. (Loading a real redacted session is future work — see the roadmap.)
- **One protagonist, activity zones.** A real session is one agent, not eight specialists — so observed mode shows a single 🤖 protagonist moving through activity zones (Reading, Coding, Testing, Thinking, Human, Outbox), with a cute per-action vocabulary ("the agent is at the workbench", "passed the checks").
- **An honest, smoothed timeline.** Hundreds of raw events collapse into a small sequence of `VisualBeat`s (e.g. `reading ×2 → editing ×3 → running tests → tests passed`) — smoothed on top, literal underneath (each beat keeps its event count; drill-down shows display-safe refs).
- **Read-only by contract.** Observed mode never surfaces resolvable decisions/approvals — the Decision Inbox shows a read-only notice. The 8-room relay is hidden (it's the scripted model); switch to a scripted scenario to see it.

## ⚠ Simulated / read-only — never touches anything real

- **Scripted mode** can show `Merge PR #42 to main and deploy via flag` — these are **simulated P7 approvals** (red `P7 · sim` badge).
- **Observed mode** is strictly read-only playback.

Neither mode ever: writes to GitHub · merges a branch · runs a deploy · calls a real LLM.

**Privacy (observed mode):** raw prompts, Bash commands, stderr, `thinking` content, MCP inputs, attachments, and session ids are **never rendered**. Beat labels are generated from the *action category* only; Bash shows a category label, not the command; the drill-down shows `event 1 / event 2` refs, not the session-id-bearing raw ids. See [docs/architecture/claude-code-transcript-format.md](docs/architecture/claude-code-transcript-format.md).

## Setup

```sh
pnpm install --frozen-lockfile
pnpm dev
# → http://localhost:3000
```

Node 18.18+. Next.js App Router (Next 15 + React 19).

## How to demo

**Scripted relay (~2 min each):**
1. Pick **REQ-014 — Add dark mode** (default) → **Start Demo**.
2. Watch the handoff chain Piper → Nova → Theo; at the decision pause, Theo walks to the Human Office and the Decision Inbox surfaces the token-naming question — pick an option to resume.
3. Continues Iris → Mira → Tess → Rune → Cora; Cora collects the review and surfaces the simulated P7 merge approval. Approve to finish.
4. Switch to **BUG-032** for the incident flow (Observe → Intent loop, expedited fix chain, roll-forward vs roll-back).

**Observed playback:**
1. Pick **Observed — Refactor button (v0.2 preview)** → **Start Demo**.
2. Watch the 🤖 protagonist move Reading → Coding → Testing as the timeline forms; the stage banner shows the current action and turns green on "passed the checks".
3. Click any beat for the drill-down (event refs + counts only — no raw content).

Full narrated script: [docs/portfolio/demo-script.md](docs/portfolio/demo-script.md).

## What this is / is not

**It is:**
- A visual governance / control-room prototype for the agentic SDLC.
- An experiment in making AI-agent work **visible, replayable, inspectable, and human-governed** — in two registers: a scripted operating-model demo and an observed transcript-playback model.

**It is not:**
- A production autonomous deploy system.
- A hosted SaaS, or an auth/billing app.
- A replacement for GitHub / Jira / CI/CD — it sits *on top* as a visualization/governance layer.
- A real GitHub writer or LLM runner (it reads and replays; it never acts).

## Tests + checks

```sh
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run — 302 tests (reducer, validator, transcript parse/validate/map, playback reducer, view model, redaction, Claude Code hooks)
pnpm build        # next build
```

CI runs all three on every PR ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Architecture in one paragraph

State is event-sourced. A scenario is a sorted array of `WorkflowEvent`s; the pure `applyEvent` reducer ([src/state/apply-event.ts](src/state/apply-event.ts)) folds them into `OfficeState`. The Zustand store ([src/state/officeStore.ts](src/state/officeStore.ts)) drives playback via `tick()`, handles human pauses via an `awaiting_human` run state, persists via `zustand/middleware/persist`, and supports scrub via `seekTo()`. **Observed mode** adds a transcript pipeline: `parseRawTranscript` → `validateRawTranscript` → `mapTranscriptToSession` (in [src/lib/](src/lib/)) turn a Claude Code JSONL transcript into `WorkflowEvent`s; `reduceObservedPlayback` collapses those into watchable `VisualBeat`s; `ObservedBeatTimeline` renders them. Redaction ([src/lib/redact.ts](src/lib/redact.ts)) keeps rendered output content-free. UI is DOM + Tailwind + Framer Motion.

## Repo layout

```
.claude/               Claude Code subagent definitions + runtime guardrail hooks (committed);
                       local preview config (launch.json) is gitignored
docs/
  product/             Project brief, ADLC model, MVP scope, roadmap
  agents/              Role catalog, permission ladder (P0–P7), escalation rules
  design/              Art direction, character/room bibles, office system, observed-office spec
  workflow/            Event / work-item / handoff / decision / blocker / quality-gate models
  architecture/        Data model, source-of-truth, Claude Code transcript format + discovery
  governance/          Decision log, risk register, approval policy
  demos/ · portfolio/  Scenario specs · case study, demo script
prompts/               Product source-of-truth agent prompts
src/
  app/                 Next.js App Router entry (mode-aware page)
  components/          office/ (scripted relay), observed/ (beat timeline + view model), drawers, controls
  state/               Zustand store + pure applyEvent reducer
  data/                Mock agents/rooms/work items, scripted event streams, observed + transcript fixtures
  lib/                 Scenario validator, runtime-unions, transcript parser/validator/mapper,
                       observed playback reducer, redaction, timeline-position
  types/               ADLC, agents, rooms, work items, workflow events, governance, transcript
```

## Status & roadmap

See [docs/product/now-next-later-never.md](docs/product/now-next-later-never.md). Short version:

- **Done — Scripted v0.1.** Two scenarios, 8-room relay, movement choreography, Decision Inbox, replay/scrub, persistence, CI.
- **Done — Observed v0.2 preview.** Transcript parse/validate/map pipeline, privacy-safe redaction, `ObservedPlaybackReducer`, `ObservedBeatTimeline`, activity zones, protagonist + action vocabulary — all on the synthetic observed sample.
- **Future work (not built):** real redacted transcript fixture · local "load a session from disk" file loader · SVG protagonist + smooth motion polish · inter-session project path · multi-project campus.
- **Strategic non-goals:** won't replace the SDLC, won't allow unsupervised prod deploys, no auth/billing/SaaS in the prototype.

## Screenshots / GIFs

> Capture pass deferred. Paths below are relative to [`assets/exported/`](assets/exported/); drop the captures there after running the demo.

- [ ] `screenshots/req-014-decision.png` — Theo in Human Office, Decision Inbox open (scripted)
- [ ] `screenshots/observed-timeline.png` — protagonist + zone lanes mid-playback (observed)
- [ ] `gifs/req-014-handoff-chain.gif` — full scripted play
- [ ] `gifs/observed-playback.gif` — 🤖 moving through zones

## Contributing

Issue templates under [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE) cover **Feature**, **Decision**, **Asset**, **Prompt**, and **Bug**. Decisions land in [docs/governance/decision-log.md](docs/governance/decision-log.md). Prompts are versioned product source-of-truth under [`/prompts/`](prompts/); the Claude Code runtime view is under [`.claude/agents/`](.claude/agents/) — see [.claude/README.md](.claude/README.md) for the two-source pattern.
