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

- **Derive from the already-safe model, never the raw transcript.** The pack is
  built from `ParsedClaudeCodeSession` / `WorkflowEvent[]` (already content-free)
  and the `VisualBeat[]` summary — *not* from raw lines.
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
   reducer/selector. Unit-tested. No UI.
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
- The pack is generated identically from the synthetic sample and the real
  redacted fixture.
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

## Related

- [now-next-later-never.md](now-next-later-never.md) — roadmap placement
- [../architecture/redacted-real-fixture.md](../architecture/redacted-real-fixture.md) — the real-format proof this builds on
- [../architecture/claude-code-transcript-format.md](../architecture/claude-code-transcript-format.md) — privacy stance
- [../design/observed-office.md](../design/observed-office.md) — observed-mode model
