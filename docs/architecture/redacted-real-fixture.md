# Redacted real-format transcript fixture

A second observed-mode fixture that proves the pipeline against a **real-format**
Claude Code transcript — the structure an actual session produces — rather than
only the hand-authored [`claude-code-transcript-sample.jsonl`](../../src/data/claude-code-transcript-sample.jsonl).

- **Fixture:** [`src/data/claude-code-transcript-real-redacted.jsonl`](../../src/data/claude-code-transcript-real-redacted.jsonl)
- **Proof test:** [`src/lib/observed-real-fixture.test.ts`](../../src/lib/observed-real-fixture.test.ts)
- **Status:** test-only. Not selectable in the UI.

## Source

A **disposable, local Claude Code session** run in a throwaway toy repo for the
sole purpose of producing this fixture — *not* this project's repo and not any
private/real project. The session did a trivial task (refactor a sample button,
run a test script), which yields the structures we want to exercise (`Read` →
`Edit` → `Bash` → `tool_result` → `summary`) with essentially no real content.

The raw transcript was **redacted by a human before handoff**. The tool that
consumed it received only the already-redacted file and treated it as untrusted
input (see "Audit" below). The raw transcript is never committed.

## Redaction policy

Shape and relationships are preserved; values are replaced. Specifically:

- **All identifiers are synthetic** (`sessionId`, `uuid`, `parentUuid`,
  `leafUuid`, `requestId`, `sourceToolAssistantUUID`, `slug`, tool-use ids) —
  e.g. `redacted-session-0001`, `u-0001…`, `tu-0001…`. Relationships (parent
  chains, `tool_use_id` ↔ `tool_result`) stay intact.
- **All timestamps are synthetic**, on a uniform incrementing base.
- **All paths are placeholders** (`/Users/example/sample-repo/…`) — no real
  username, home path, or repo path.
- **All content is stripped**: user prompts, assistant text, `tool_result`
  content, `stdout`/`stderr`, `Edit` strings, and `originalFile` are `[redacted]`.
- **No `thinking` blocks**, no attachment payloads, no MCP server names, no
  emails, URLs, branch names beyond a generic `main`, or token/key-shaped strings.

### Safe synthetic scaffolding (added after redaction)

To make the fixture a *useful* proof (a session with no title anchor and a fully
redacted command exercises almost nothing), three safe, content-free anchors
were added — none derived from the real session:

- a **placeholder user-prompt line** (generic text) so the mapper seeds a work
  item and `validateScenario` has something to validate;
- the `Bash` command set to a generic **`pnpm test`** so the mapper classifies a
  test run (the raw command is never rendered — only a category label is);
- the `parentUuid` chain repaired so it resolves coherently.

These are scaffolding, not redaction — they add fake data, they never un-redact
anything.

## Audit (before commit)

The redacted scratch file was scanned outside the repo for leakage —
**non-placeholder** home paths (`/Users/<real-user>`, `/home/<real-user>`,
`/root`), usernames, real UUIDs, emails, GitHub URLs, branch names, tokens/keys,
raw commands, raw stdout/stderr, raw prompts, raw assistant text, `thinking`,
attachments, MCP payloads — and run through the full pipeline to confirm the
**serialized render model contains none** of the transcript's identifiers,
paths, commands, or content. Only after that did it enter the repo.

The scan is **allowlist-aware**: the fixture intentionally retains the
placeholder path `/Users/example/sample-repo` to preserve path-shaped transcript
structure, so the audit rejects real home paths (`/Users/<real-user>`), not the
literal substring `/Users/`. The committed-fixture test
([`observed-real-fixture.test.ts`](../../src/lib/observed-real-fixture.test.ts))
encodes this: it asserts the raw bytes carry no private markers while allowing
the placeholder path.

## What it covers

The proof test asserts the whole observed path:

1. `parseRawTranscript` parses every line.
2. `validateRawTranscript` returns no issues.
3. `parseClaudeCodeTranscript` maps it into a `ParsedClaudeCodeSession`.
4. Wrapped as an observed `Scenario`, it passes `validateScenario`.
5. `reduceObservedPlayback` produces beats across **reading / coding / testing**.
6. `buildTimelineView` produces a render model with **no raw transcript leakage**
   (the load-bearing privacy assertion).

## What stays out of scope (deliberately)

This fixture proves the pipeline. It does **not** add product surface:

- **Not selectable in the UI** — not registered in the scenario list/selector.
- **No file loader** — nothing reads a session from disk at runtime.
- **No live tailing**, **no campus**, **no multi-work-item view**, **no new UI**.

Those remain future work, gated on this proof. See
[now-next-later-never.md](../product/now-next-later-never.md).
