# Agentic SDLC Office

> A visual control room for AI-native software delivery. It helps humans understand, supervise, and govern autonomous coding agents across requirements, worktrees, files, diffs, tests, decisions, approvals, and PRs.

`v0.1` is a **mock visual workflow prototype** — eight specialist AI agents move work through an eight-room office while a human governs from a Decision Inbox. No real LLM calls yet; the demo is scripted from an event stream and runs entirely client-side.

## What you'll see

- **Two scripted scenarios.** `REQ-014 Add dark mode` (happy-path feature) and `BUG-032 Dashboard filter` (Observe → Intent incident loop). Switch via the dropdown at the top of the page.
- **One observed scenario (v0.2 preview).** `Observed — Refactor button` plays a sample Claude Code session in read-only mode. The Decision Inbox shows a read-only notice; a banner near the top tags the session origin. Today the events come from a static fixture; v0.2 wires in the real transcript parser.
- **8 agents, 8 rooms.** Each agent has a distinct silhouette, a primary room, and a real-time status. Click any sprite to open the Agent Drawer.
- **Visible handoffs.** Sprites physically move between rooms when ownership transfers. A Phase Timeline at the top of the office shows where the work item is in the chain.
- **Human-in-the-loop.** The Decision Inbox surfaces token-naming decisions, roll-forward vs roll-back choices, and **simulated P7 approvals** for merges/deploys.
- **Replay + scrub.** The Activity Log shows every event in chronological order; click any past event to scrub state to that point. localStorage keeps state across refreshes.

## ⚠ Simulated only

The Decision Inbox can show entries like `Merge PR #42 to main and deploy via flag`. These are **simulated P7 approvals**. v0.1 never:

- writes to GitHub
- merges any branch
- runs any deploy
- calls any real LLM

The red `P7 · sim` badge on approval cards is the visual reminder.

## Setup

```sh
pnpm install --frozen-lockfile
pnpm dev
# → http://localhost:3000
```

Node 18.18+. The Next.js app is App Router (Next 15 + React 19).

## Demo flow (~2 min)

1. Open `http://localhost:3000` — empty office, 8 agents idle in their primary rooms.
2. Pick **REQ-014** in the scenario dropdown (default).
3. Click **Start Demo**.
4. Watch the handoff chain: Piper → Nova → Theo.
5. **Pause point 1:** Theo physically moves to the Human Office and the Decision Inbox surfaces the token-naming question. Pick either option to resume.
6. Continues: Iris → Mira → Tess → Rune.
7. **Pause point 2:** Cora visits Review/Security to collect Rune's review, returns to Human Office, surfaces the simulated P7 merge approval. Approve to finish.
8. Run completes; the Phase Timeline flips its final pill green.

Then switch to **BUG-032** for the incident flow (Rune starts in Observe mode, hands off to Piper, expedited fix chain, roll-forward vs roll-back decision).

See [docs/portfolio/demo-script.md](docs/portfolio/demo-script.md) for the full narrated script.

## Tests + checks

```sh
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run — 81 tests across reducer, validator, parser stub, and Claude Code hooks
pnpm build        # next build
```

CI runs all three on every PR ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Repo layout

```
.claude/               Claude Code subagent definitions + runtime guardrail hooks
docs/
  product/             Project brief, ADLC model, MVP scope, roadmap
  agents/              Role catalog, permission ladder (P0–P7), escalation rules
  design/              Art direction, character bible, room bible, office system
  workflow/            Event model, work item / handoff / decision / blocker / quality gate models
  architecture/        Data model
  governance/          Decision log, risk register, approval policy, night-mode policy
  demos/               REQ-014 + BUG-032 scenario specs
  portfolio/           Case study outline, demo script
prompts/               Product source-of-truth agent prompts
src/
  app/                 Next.js App Router entry
  components/          Office, drawers, decision inbox, activity log, phase timeline, controls
  state/               Zustand store + pure applyEvent reducer
  data/                Mock agents, rooms, work items, per-scenario event streams + observed-sample fixture
  lib/                 Scenario validator, Claude Code parser (v0.2 stub)
  types/               ADLC, agents, rooms, work items, workflow events, governance
```

## Architecture in one paragraph

State is event-sourced. A scenario is a sorted array of `WorkflowEvent`s; the pure `applyEvent` reducer ([src/state/apply-event.ts](src/state/apply-event.ts)) folds them into the `OfficeState`. The Zustand store ([src/state/officeStore.ts](src/state/officeStore.ts)) drives playback via `tick()` on an interval, handles human-in-the-loop pauses via an `awaiting_human` run state, persists across refreshes via `zustand/middleware/persist`, and supports scrub-to-event-N via `seekTo()`. The UI is plain DOM + Tailwind + Framer Motion (`layoutId` for sprite movement).

## Status & roadmap

See [docs/product/now-next-later-never.md](docs/product/now-next-later-never.md). Short version:

- **Now (v0.1)** — the mock prototype you're looking at
- **Next (v0.2)** — local Claude Code event ingestion, real artifacts
- **Later (v0.3 → v1.0)** — GitHub read/write, polished demo, deployable portfolio
- **Future bets** (contingent on validation) — SaaS, auth, teams
- **Strategic non-goals** — won't replace the SDLC, won't allow unsupervised prod deploys

## Screenshots / GIFs

> Capture pass deferred. Placeholders below; replace with PNG/GIF in [`/assets/exported/`](assets/exported/) after running the demo.

- [ ] `assets/exported/screenshots/office-idle.png` — empty office, 8 agents
- [ ] `assets/exported/screenshots/req-014-decision.png` — Theo in Human Office, Decision Inbox open
- [ ] `assets/exported/screenshots/req-014-completed.png` — green final pill + "Done" chip
- [ ] `assets/exported/screenshots/bug-032-incident-banner.png` — red incident overlay
- [ ] `assets/exported/gifs/req-014-handoff-chain.gif` — full play (90 s)
- [ ] `assets/exported/gifs/cora-courier.gif` — Cora's review-security round-trip

## Contributing

Issue templates under [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE) cover **Feature**, **Decision**, **Asset**, **Prompt**, and **Bug**. Decisions land in [docs/governance/decision-log.md](docs/governance/decision-log.md). Prompts are versioned product source-of-truth under [`/prompts/`](prompts/); the Claude Code runtime view is under [`.claude/agents/`](.claude/agents/) — see [.claude/README.md](.claude/README.md) for the two-source pattern.
