# MVP Scope — v0.1 Mock Visual Workflow Prototype

## Goal

Prove the operating model: a visible office where 8 agents move work through specialties, surface decisions to a human, and produce a replayable event log. No real LLM calls in v0.1.

## In scope

- [ ] 8-room office layout (see [../design/office-room-system.md](../design/office-room-system.md))
- [ ] 8 agents: Cora, Piper, Nova, Theo, Iris, Mira, Tess, Rune
- [ ] Status bubbles per agent
- [ ] Work item drawer
- [ ] Agent drawer
- [ ] Decision Inbox
- [ ] Scripted REQ-014 demo end-to-end ([../demos/req-014-dark-mode.md](../demos/req-014-dark-mode.md))
- [ ] Event log + replay

## Out of scope (for v0.1)

- Real agent runtime / real LLM calls
- GitHub integration
- Multi-tenant / auth
- Polished sprite art (placeholders OK)
- Animation polish (Rive deferred — see DEC-006)

## v0.1 Definition of Done

You can open the app and demo:

1. The office shows 8 rooms with 8 agents idle.
2. `REQ-014 Add dark mode` appears as a work item.
3. Piper → Nova → Theo → Iris → Mira → Tess → Rune → Cora handoff plays automatically.
4. The Decision Inbox surfaces one open question and waits for human input.
5. The activity log reflects the full run.
6. The work item drawer shows artifacts, blockers, quality gates per stage.

## Related

- Now / Next / Later / Never: [now-next-later-never.md](now-next-later-never.md)
- Roadmap: [roadmap.md](roadmap.md)
- Open questions: [open-questions.md](open-questions.md)
