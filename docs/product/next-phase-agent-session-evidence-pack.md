# Next phase — Agent Session Evidence Pack

> Status: **planned / active next phase.** This document defines the direction;
> it is not an implementation. The first build PR is the `EvidencePack` data
> model + pure reducer (no UI). See the issue **EPIC — Agent Session Evidence
> Pack** on the board.

## Product thesis

AI coding agents now do real, multi-step work on their own. The bottleneck has
moved: it is no longer "can the agent do it?" but **"can a human quickly and
safely review what the agent did, and decide whether to trust it?"** Reading a
raw session transcript to answer that is slow, noisy, and leaks sensitive
content.

The **Agent Session Evidence Pack** turns an observed Claude Code session into a
**privacy-safe, skimmable review artifact** (markdown today; structured object
underneath) — the thing a human actually reads before approving agent work.

This is the project's product wedge: **AI coding-agent session replay + review
evidence**, not "a cute office app." The office visualization is the friendly
face; the evidence pack is the deliverable with a clear job-to-be-done.

## Target user

- **Primary:** the human who reviews/approves an agent's work — a developer or
  tech lead looking at a coding agent's session or PR and asking "what did it
  actually do, and what should I look at hardest?"
- **Secondary:** the agent operator who wants a shareable, sanitized record of a
  session (for a teammate, a PR description, or their own audit trail).

## Why this is the next wedge (not the file loader)

The observed-mode pipeline already converts a transcript into a structured,
privacy-safe event/beat model. A **file loader** is useful plumbing, but on its
own it just gets more transcripts into the same viewer. The **evidence pack** is
the marketable output of that pipeline: a concrete, reviewer-facing artifact
with an obvious value proposition. Build the artifact first; the loader feeds it
later.

## What the evidence pack answers

A reader should be able to answer all of these **without opening the raw
transcript**:

1. What was the agent asked to do? (work-item intent)
2. What did it read? (files touched — privacy-safe form)
3. What did it edit / write? (change summary)
4. What tests / builds / checks ran — and what passed/failed?
5. What blockers occurred?
6. Were there human touchpoints? (decisions / approvals — read-only for observed)
7. What artifacts were produced? (PRs, files)
8. An activity summary (reading / coding / testing shape + a compact timeline)
9. **What should a reviewer focus on?** (conservative, transparent highlights —
   e.g. failing checks, a file edited many times, a blocker)
10. **What was intentionally redacted / not rendered?** (an explicit footer)

## What it must NEVER include

The same privacy contract as the observed render model — by construction:

- raw prompts, raw assistant text, raw `thinking`
- raw Bash commands, raw `stdout` / `stderr`
- session IDs, raw event IDs (which embed the session id)
- MCP tool inputs / server names, attachment payloads
- absolute paths / usernames, tokens / keys / secrets

## Privacy / redaction principles

- **Build from the parsed event model via an explicit allowlist — do NOT assume
  `WorkflowEvent[]` is content-free.** Some events carry raw free text: e.g.
  `agent.message.sent.message` holds raw assistant text and raw user-prompt
  content (the observed *render model* is safe only because the reducer/view
  never read that field). The evidence pack must therefore consume **only
  allowlisted, content-safe inputs** — `VisualBeat` labels/counts, event
  `type`/`status`, safe artifact/gate/blocker metadata, and redaction notes —
  and must **ignore arbitrary free-text payloads** (e.g. `agent.message.sent`)
  unless they are known-safe mapper-generated category labels (e.g.
  `safeBashCommandLabel` output). Never read raw message text, prompts,
  commands, stderr/stdout, thinking, raw ids, raw paths, or raw event ids.
- **Category labels + counts, not payloads.** "Ran test command", "edited 1
  file ×3", "read 2 files" — never the command, never the diff.
- **Reuse the existing redaction helpers** (`src/lib/redact.ts`) for any string
  that is allowed through (e.g. a file *basename*), and prefer counts to names
  when in doubt.
- **Transparency by default.** Every pack ends with a redaction note stating
  what is deliberately omitted, so the artifact is honest about its blind spots.
- **Enforced by test**, not just convention — the same forbidden-content
  assertion style as `observed-real-fixture.test.ts`.

## MVP scope (the build phase this unlocks)

Pure logic + docs. **No UI, no file loader, no downloads, no GitHub writes.**

1. **`EvidencePack` data model** — a typed object: session metadata, work-item
   intent, activity summary, files/artifacts, quality gates (pass/fail),
   blockers, human touchpoints, reviewer-focus highlights, redaction notes. No
   raw payload fields.
2. **`buildEvidencePack(session | events): EvidencePack`** — pure, deterministic
   reducer/selector. Reads **only allowlisted, content-safe fields** (see Privacy
   principles); never raw `message`/command/text payloads. Unit-tested. No UI.
3. **`renderEvidencePackMarkdown(pack): string`** — pure renderer → safe
   markdown, including the redaction disclaimer.
4. **Tests against both fixtures** — the synthetic sample *and* the real redacted
   fixture: the pack has the expected sections and contains none of the
   forbidden raw content.

## Future scope (explicitly later, gated on the MVP)

- Export / download the pack (browser file API).
- In-app panel that renders the pack alongside the timeline.
- PR-review version (a GitHub PR comment / attached artifact) — **no GitHub
  writes in MVP**.
- Local "load a session from disk" file loader feeding the pack.
- Multi-session evidence (a project path stitched via a branch/PR join key).

## Success criteria

- A human can read the markdown pack and answer the 10 questions above **without
  opening the raw transcript**.
- The serialized pack contains **zero** raw payload content (test-enforced).
- The pack is generated through the same code path for the synthetic sample and
  the real redacted fixture (the packs differ in content; the path is identical).
- `buildEvidencePack` and the renderer are **pure and fully unit-tested**; no UI,
  parser, or file-loader changes required to ship the MVP.

## Risks / open questions

- **File-path granularity.** How much is safe — basename, redacted path, or just
  a count? Default to the safest (counts; basenames only behind `redact.ts`).
- **"What to focus on" heuristic.** Risk of being confidently wrong. Keep it
  conservative and transparent (surface signals like failed checks / heavy edits
  / blockers; never editorialize beyond the data).
- **Output format.** MVP is markdown; a structured JSON twin can come later.
- **Milestone naming.** The existing `v0.2` milestone is titled "Agent Runtime
  Simulation," which predates this direction — rename vs. retire is an open call
  (not done in this planning PR).

## Build sequence (recommended)

1. Docs + issues plan *(this PR)*.
2. `EvidencePack` data model + `buildEvidencePack` reducer (pure).
3. `renderEvidencePackMarkdown` renderer.
4. Tests against synthetic + real redacted fixture.
5. *Then* maybe the local file loader.

## Implementation notes — model + reducer PR (#59, #60)

Landed in [`src/types/evidence-pack.ts`](../../src/types/evidence-pack.ts) (the
typed `EvidencePack` model) and [`src/lib/evidence-pack.ts`](../../src/lib/evidence-pack.ts)
(the pure `buildEvidencePack(input)` reducer), with
[`src/lib/evidence-pack.test.ts`](../../src/lib/evidence-pack.test.ts) asserting
the contract against both the synthetic sample and the real redacted fixture.
Type/function names match this plan; two privacy decisions are worth calling out
for the renderer PR (#61):

- **Work-item title is never exposed.** The mapper seeds `workItem.title` from
  the raw user prompt, and an arbitrary prompt can't be proven content-safe, so
  the pack always uses a constant fallback (`"Observed session"`). The reducer
  doesn't read the raw title at all.
- **`thinking` → `reasoning` in the activity summary.** The observed model's
  `thinking` zone and the `think` action's `"thinking"` label are content-free,
  but the literal substring collides with the `thinking` forbidden-content probe
  (which exists to catch raw chain-of-thought). The reducer surfaces that phase
  as `reasoning` so the serialized pack is *provably* free of the substring
  without dropping the beat. Every other zone/action/label passes through as-is.

`buildEvidencePack` takes `{ session, events?, beats?, generatedAt? }`: it
derives beats via `reduceObservedPlayback` when not supplied, and `generatedAt`
is injectable (defaulting to the session's `capturedAt`) so the reducer stays
deterministic with no `Date.now`. A post-review hardening also treats the public
`beats` override as untrusted: beat labels are regenerated from `action` +
`signalCount`, zone/action keys are allowlisted (unknown → `"other"`), and
`signalCount` is coerced — so a caller-supplied beat can't smuggle content in.

## Implementation notes — markdown renderer PR (#61)

Landed in [`src/lib/evidence-pack-markdown.ts`](../../src/lib/evidence-pack-markdown.ts)
(`renderEvidencePackMarkdown(pack)`), with
[`src/lib/evidence-pack-markdown.test.ts`](../../src/lib/evidence-pack-markdown.test.ts)
asserting the section set + the forbidden-content gate over the rendered markdown
for both fixtures. The function name matches this plan. Key decision:

- **The renderer takes ONLY the `EvidencePack` — never the session/events/beats.**
  The pack is the content-safe boundary (`buildEvidencePack` enforces the
  allowlist), so the renderer structurally cannot reach raw transcript content;
  it just formats the pack's own fields and emits the pack's redaction footer
  verbatim. Pure and deterministic (no IO, no `Date.now`, no mutation).

The pack is also surfaced read-only in observed mode (the in-app panel, #71),
so a human can review the markdown alongside the timeline.

## Reviewer-focus validation (test-only)

The synthetic sample and the real redacted fixture are both *clean* runs, so the
pack's **Reviewer focus** section reads "No focus signals" — correct, but it
doesn't prove the section's value. That value shows up when a session has
something to review. `src/lib/evidence-pack-reviewer-focus.test.ts` drives a
deliberately risky synthetic stream (a failed quality gate, a blocker, an
AskUserQuestion touchpoint, heavy editing, a PR) through the real path
(`buildEvidencePack` → `renderEvidencePackMarkdown`) and asserts the section
becomes genuinely useful:

```
## Reviewer focus

- **WARNING** — 1 quality gate failed
- **WARNING** — 1 blocker raised
- **NOTE** — heavy editing observed (7 edits)
- **NOTE** — 1 human touchpoint observed
```

The same test is adversarial about privacy: each raw payload is stuffed with
content that must never surface (home paths, a `pnpm test` command, stderr, an
API key, a GitHub token, a private repo URL, raw model reasoning, raw
event/gate/blocker ids), and the test asserts none of it appears in the
serialized pack or the rendered markdown. So a risky session stays just as
content-safe as a clean one — the focus section gets *useful*, not *leaky*.

**Sequencing:** export / download (#63) should be evaluated only after this
focus-section behavior is validated — the artifact has to be worth saving before
a save button is worth building. That validation passed, so export landed next.

## Implementation notes — export / download (#63)

A "↓ .md" button on the observed-mode panel downloads the pack as
`agent-session-evidence-pack.md` (`src/components/observed/evidence-pack-download.ts`).
It stays inside the same privacy boundary: the export receives ONLY the
already-rendered markdown string — never the session, events, or beats — and
passes it through verbatim under a fixed, content-safe filename. Pure descriptor
(`buildEvidencePackBlobParts`) is node-tested; `downloadEvidencePackMarkdown` is
a thin browser trigger that no-ops off the DOM (SSR/tests). Still no file loader,
clipboard, GitHub writes, or network — just the browser file API.

## Related

- [now-next-later-never.md](now-next-later-never.md) — roadmap placement
- [../architecture/redacted-real-fixture.md](../architecture/redacted-real-fixture.md) — the real-format proof this builds on
- [../architecture/claude-code-transcript-format.md](../architecture/claude-code-transcript-format.md) — privacy stance
- [../design/observed-office.md](../design/observed-office.md) — observed-mode model
