# MVP Scope — v0.1 Mock Visual Workflow Prototype

## Goal

Prove the operating model: a visible office where 8 agents move work through specialties, surface decisions to a human, and produce a replayable event log. No real LLM calls in v0.1.

## In scope (status reflects shipped work)

- [x] 8-room office layout (see [../design/office-room-system.md](../design/office-room-system.md)) — PR #18
- [x] 8 agents with SVG silhouettes and per-room decor — PR #18, #19
- [x] Status bubbles per agent (15 statuses) — PR #18, #23
- [x] Work item drawer with artifacts / decisions / blockers / quality gates — PR #18, #23
- [x] Agent drawer with permission level, current artifact, blocked-by, next handoff — PR #18, #23
- [x] Decision Inbox with recommended-option pro/con cards — PR #18
- [x] **Simulated P7 banner** on irreversible approvals — PR #23
- [x] Scripted REQ-014 demo end-to-end (72 events) — PR #18
- [x] Scripted BUG-032 demo end-to-end (Observe → Intent loop, 70 events) — PR #21
- [x] Scenario selector with incident styling for bugs — PR #21
- [x] Event log + click-to-replay — PR #22
- [x] localStorage persistence across refreshes — PR #22
- [x] `awaiting_human` run state surfaced in the UI — PR #23
- [x] Handoff indicator (`from → to → artifact` pill) — PR #23
- [x] Movement choreography (agents physically move rooms; Cora as courier) — PR #27
- [x] Phase Timeline ribbon with completed (Done) terminal state — PR #27, #29
- [x] Activity Log shows chronological playback step `#NNN` — PR #29

## Quality bar

- [x] Scenario validator catches unknown actors, statuses, rooms, modes, orphan resolutions, chain mismatches — PR #23, #29
- [x] Pure `applyEvent` reducer extracted for unit-test isolation — PR #25
- [x] Vitest covers reducer + validator + Claude Code hooks (73 tests) — PR #23, #25, #29
- [x] GitHub Actions CI on every PR (`install → typecheck → test → build`) — PR #23
- [x] Claude Code runtime guardrails (`.claude/settings.json` + `bash-guard.js` + `write-guard.js`), fail-closed, with hook tests in CI — PR #24, #25, #26

## Out of scope (for v0.1)

- Real agent runtime / real LLM calls
- GitHub API reads/writes
- Multi-tenant / auth / billing
- Polished final sprite art (placeholder SVG silhouettes are fine)
- Animation polish beyond Framer Motion `layoutId` (Rive deferred — see DEC-006)
- Multiple work items in flight simultaneously

## v0.1 Definition of Done — met

You can open the app and demo:

1. ✅ The office shows 8 rooms with 8 agents idle.
2. ✅ `REQ-014 Add dark mode` (or `BUG-032`) appears as a work item.
3. ✅ Full handoff chain plays automatically.
4. ✅ The Decision Inbox surfaces an open question and waits for human input.
5. ✅ The activity log reflects the full run with click-to-scrub.
6. ✅ The work item drawer shows artifacts, blockers, quality gates per stage.
7. ✅ A simulated P7 approval surfaces before the run completes.
8. ✅ State persists across page refreshes.

## Related

- Now / Next / Later / Future Bets / Non-Goals: [now-next-later-never.md](now-next-later-never.md)
- Roadmap: [roadmap.md](roadmap.md)
- Demo script: [../portfolio/demo-script.md](../portfolio/demo-script.md)
- Decision log: [../governance/decision-log.md](../governance/decision-log.md)
