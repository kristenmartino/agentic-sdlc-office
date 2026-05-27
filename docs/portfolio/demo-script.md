# Demo Script

Two scripted scenarios. Aim for ~2 minutes per scenario, ~4 minutes total. Lines in quotes are what to say.

## Frame (15 s)

> "This is an Agentic Development Lifecycle — an SDLC where AI agents execute concurrent modes and humans govern from the side. I built a visual operating model of it. The agents are mocks for this v0.1, but the operating model is real."

Open the app at `http://localhost:3000`. Point out:

- The 8-room office layout (top of screen)
- The 8 agent silhouettes idle in their primary rooms
- The Phase Timeline ribbon at the top showing the handoff chain
- The Scenario selector and Demo Controls in the header
- The Decision Inbox and Activity Log on the right

---

## REQ-014 — Happy-path feature (~2 min)

> "I'll start with REQ-014 — Add dark mode to the dashboard. This is the canonical feature flow, hits every specialty in the office."

Confirm REQ-014 is selected. Click **Start Demo**.

### 0:00–0:30 — Intent → Research → Plan

> "Piper picks it up first. She's the Product Strategist — captures the intent, writes acceptance criteria. The work item drawer at the bottom updates with her acceptance list."

> "Then Nova — Researcher. She compares semantic-token vs direct-token systems. Read-only by design; she doesn't pick, she briefs."

> "Theo — Systems Architect — picks up the ADR work."

### 0:30–0:50 — The decision pause

> "Theo hits an architectural choice that needs a human. Watch — he physically walks from Architecture/Design to the Human Office. His status changes to `awaiting_human`, the run-state pill flips amber, and the Decision Inbox surfaces the question with two pro/con options and Theo's recommendation."

Pause the demo's natural narration. Read the question aloud:

> "Name dark-surface tokens semantically — like `--surface-1` — or directly — `--bg-primary`? Theo recommends semantic; semantic ages better, direct is more greppable. I'll go with his recommendation."

Click **Semantic** in the inbox. The demo resumes.

> "Notice — Mira was already in `waiting_on_agent` because she can't build without the token decision. Now she unblocks. Theo walks back to Architecture/Design."

### 0:50–1:30 — Design → Build → QA → Review

> "Iris does the UI spec — tokens defined, contrast checked. Mira builds — opens a draft PR. Tess writes regression tests. Rune does security and a11y review."

> "Watch the Phase Timeline at the top — it advances as ownership transfers. Past agents dim, current pill is in amber."

### 1:30–1:50 — The simulated P7 approval

> "Now Cora — Delivery Lead. She's the only agent who talks to the human directly. Watch — she leaves the Human Office, walks to Review/Security to collect Rune's review packet, then returns and surfaces a simulated P7 approval to merge the PR and deploy."

Point out the **red `P7 · sim` badge** and the line "**Simulated P7 approval — no real merge or deploy is performed**."

> "Critical detail: v0.1 never actually merges, deploys, or writes to GitHub. The badge makes that unambiguous. The product point is that P7 actions always require a human."

Click **Approve**.

### 1:50–2:00 — Done

> "Run completes. The final Cora pill turns green, a 'Done' chip appears. Activity Log shows 73 events in chronological order. I can click any of them to scrub state back to that point and replay from there — state persists across refreshes too."

---

## BUG-032 — Incident / Observe→Intent loop (~2 min)

> "Now an incident. BUG-032 — the dashboard date-range filter loses state on tab change. This is the Observe → Intent loop the product diagram talks about."

Switch the scenario dropdown to **BUG-032**. Note the **red incident banner** at the top.

Click **Start Demo**.

### 0:00–0:15 — Observation

> "Rune starts in `Observe` mode — she's watching telemetry. She sees the anomaly: 14% of sessions affected, started 27 minutes ago. She raises it as a work item."

### 0:15–1:00 — Expedited fix chain

> "Piper formalizes the bug. Nova traces root cause — references a prior fix from REQ-007. Theo scopes the fix tight — minimal patch, no wider refactor. Mira writes a 12-line hotfix. Tess does the regression test."

> "Note the chain skips Iris — no UI design needed for a code bug. The Phase Timeline shows that."

### 1:00–1:30 — Cora's courier round-trip + rollout decision

> "Cora — same courier pattern. She visits Review/Security to collect Rune's expedited review, then returns to surface the rollout choice."

The Decision Inbox shows:

> "Roll forward with the hotfix, or roll back the change that introduced the regression?"

Read it aloud. Pick **Roll forward**.

### 1:30–1:50 — Approval & done

> "Now the simulated P7 deploy approval. Same red badge. Same 'no real deploy' note. I approve."

The timeline flips its final pill green.

### 1:50–2:00 — The product point

> "The reason BUG-032 matters is the loop. The same office handles features *and* incidents. Rune detects in Observe mode; the work loops back through Intent → Generate → Validate → Govern. The product is a single visual model for both directions of agentic SDLC work."

---

## Out (15 s)

> "v0.1 is the mock. Next is connecting it to a real local Claude Code observer — same model, real activity. Roadmap and non-goals are in `docs/product/now-next-later-never.md`. Repo has 73 tests and CI on every PR. Thanks."

---

## Tips for a recorded demo

- 1080p capture, 30fps is plenty. Use Cleanshot or Loom for screen + window.
- Tighten REQ-014's tick interval by editing `TICK_MS` in [src/components/controls/DemoControls.tsx](../../src/components/controls/DemoControls.tsx) if 95s feels too slow.
- Open the Activity Log and Decision Inbox before recording so they're not first-appearance surprises.
- For the courier moments, slow the cursor so the viewer's eye can follow Cora's transit.
- Mention "no real LLM" at least twice — once at the top, once at the simulated P7. It pre-empts the "is this real?" question.
