# Roadmap — Now / Next / Later / Future / Non-Goals

Scope discipline. If it isn't on this board, it isn't planned for the named release. Items in **Future Product Bets** are not committed — they're the candidate moves *if* the v0.1–v1.0 work proves user demand.

## Now (v0.1)

- 8-room office UI
- 8 placeholder agents with state, sprites, and movement choreography
- Work item drawer
- Agent drawer
- Decision Inbox (with simulated P7 banner)
- Scripted REQ-014 and BUG-032 demos
- Event log + replay (click-to-scrub)
- `awaiting_human` run state surfaced in the UI
- Guardrails and tested mock scenarios
- CI on every PR
- Persisted state (localStorage)

## Next (v0.2) — observed mode

**The observed-mode arc is built (on the synthetic sample).** Observed mode renders a real Claude Code session as a single-protagonist, zone-based activity timeline — the literal counterpart to the scripted relay. Done:

- ✅ Transcript pipeline: `parseRawTranscript` → `validateRawTranscript` → `mapTranscriptToSession` ([docs/architecture/claude-code-transcript-format.md](../architecture/claude-code-transcript-format.md))
- ✅ Privacy-safe redaction — no raw prompts / commands / stderr / thinking / MCP input / attachments / session ids reach the UI
- ✅ `ObservedPlaybackReducer` — dense events → watchable `VisualBeat`s (truth-preserving, content-free)
- ✅ `ObservedBeatTimeline` — sequence strip + activity zone lanes + safe drill-down
- ✅ Coherent observed-mode page (zone timeline is the stage; the relay grid is scripted-only)
- ✅ Cute protagonist + per-action vocabulary
- ✅ Design spec ([docs/design/observed-office.md](../design/observed-office.md)) + reducer/view tests

Still open for v0.2 → v0.3 (not built):

- Real **redacted transcript fixture** (prove the pipeline on an actual session; redaction owned by a human)
- Local **"load a session from disk"** file loader
- Multiple work items in flight at once
- Basic worktree / branch awareness (capture the branch/PR join key)
- Inter-session **project path** (stitch a project's sessions via the join key)
- Local persistence beyond demo state (e.g. IndexedDB)

## Later (v0.3 → v1.0)

- GitHub integration: Issues, PRs, Actions read/write
- Real repo / file / diff visibility
- Theme variants (night, incident, demo)
- Polished sprite art and animation — incl. observed-mode SVG protagonist + smooth `layoutId` motion (today it's an emoji avatar that jumps between lanes)
- Multi-project **campus** overview (campus → project → session → activity zoom)
- Portfolio case study and deployed demo
- Local-first usable product mode (desktop or local web app)
- Decision Inbox writes back to a real decision log on disk

## Future Product Bets

Not planned for v0.1–v1.0. May become relevant only after validation that the local-first version delivers real value.

- Multi-tenant SaaS
- Real authentication / billing
- Team workspaces
- Organization-level permissions
- Cloud sync between local and a hosted control plane
- Paid plans / subscriptions
- Enterprise / self-hosted deployment
- Audit-log export, compliance reporting
- Agent marketplace
- Production-team pilots

## Strategic Non-Goals

These are commitments about what this project *will not be*, regardless of how big the future product gets:

- **Will not** claim to replace GitHub, Jira, Linear, CI/CD, or the SDLC itself. It sits *on top* as a visual governance / control layer.
- **Will not** allow unsupervised production deploys. P7 actions are always human-approved.
- **Will not** make auth or billing part of the v0.1–v1.0 MVP.
- **Will not** ship multi-tenant SaaS before the local-first single-user experience proves itself.
- **Will not** position the product as "replacing the SDLC." Position it as making agentic SDLC work visible, governable, replayable, and safer.

## Positioning (one-liner for portfolio/pitch)

> A visual control room for AI-native software delivery. It helps humans understand, supervise, and govern autonomous coding agents across requirements, worktrees, files, diffs, tests, decisions, approvals, and PRs.
