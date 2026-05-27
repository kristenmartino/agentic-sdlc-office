# Observer mode — v0.2 spike

A spike, not a feature. v0.1 still ships scripted scenarios. This doc records
the architectural plumbing put in place so v0.2 can wire in a real Claude Code
session parser without touching anything else.

## What it adds

- A third scenario, `observed-sample`, alongside `req-014` and `bug-032`.
- A `source: "scripted" | "observed"` discriminator on `Scenario`.
- A static JSON fixture at [`src/data/observed-sample.json`](../../src/data/observed-sample.json)
  that holds the shape a parsed Claude Code session will eventually produce.
- A parser stub at [`src/lib/claude-code-parser.ts`](../../src/lib/claude-code-parser.ts) — every
  entry point throws `ClaudeCodeParserNotImplementedError` on purpose.
- Read-only UI affordances when the active scenario is observed: the
  Decision Inbox shows a "read-only" notice instead of resolve controls, the
  scenario selector tags it with a `v0.2 · observed` chip, and a banner
  near the top of the page surfaces the captured session origin.

## What it deliberately doesn't do

- Parse real Claude Code transcripts. The format isn't finalised and the
  point of the spike is to stop guessing at it; we'll wire it in for v0.2.
- Tail-follow a live session. The fixture is captured-at-a-point-in-time.
- Map raw tool calls (Bash, Edit, Write, Read) onto the office's agent
  model. That mapping needs a Claude-Code-session walkthrough to settle.

## Why the fixture-first approach

The risk on a spike like this is finishing the parser only to find the rest
of the system (store, validator, UI) can't render its output. Sequencing it
the other way — define the contract, exercise it with a fixture, prove the
office still validates and plays it cleanly — front-loads the questions
that actually matter:

1. **Does the event model carry observed sessions?**
   Yes. `WorkflowEvent` is already actor-tagged (`mira` vs `human` vs
   `system`), so an observed run with one acting agent fits without any
   schema changes.
2. **Does the store path care?**
   No. `applyEvent` is source-agnostic. The same reducer handles a scripted
   run and an observed run.
3. **Does the timeline render a one-agent chain?**
   Yes. `PhaseTimeline` walks `scenario.chain`. A chain of length 1 renders
   one cell — minimal but honest about the observed run shape. For observed
   scenarios specifically, the position counter collapses adjacent duplicate
   owner changes so a long Mira session that fires several
   `owner.changed → mira` events doesn't run off the chain. Position is
   also clamped to `chain.length - 1` as a safety net. See
   [`src/lib/timeline-position.ts`](../../src/lib/timeline-position.ts).
4. **Where does read-only enforcement live?**
   In two places: the validator rejects any `decision.requested` or
   `approval.requested` event in an observed scenario, and the
   `DecisionInbox` component switches to a read-only surface when
   `source === "observed"`. Defence in depth — the data layer can't smuggle
   a resolve-eligible decision past the UI even by mistake.
5. **What about malformed external fixtures?**
   The validator now also checks `scenario.initialWorkItem` field-by-field
   (id, title, kind, status, currentMode, ownerAgentId, nextAgentId,
   assignedAgentIds, createdAt, updatedAt) and rejects any event whose
   `type` falls outside the 12-category taxonomy. For scripted scenarios
   these checks are no-ops; for observed scenarios (which load from JSON)
   they catch the kind of drift TypeScript can't see across an import
   boundary.

## Contract for the v0.2 parser

`parseClaudeCodeTranscript(rawJsonl: string): ParsedClaudeCodeSession`

The returned `ParsedClaudeCodeSession`:

```ts
{
  origin: {
    source: "claude-code-local" | "claude-code-cloud" | "fixture";
    sessionId: string;
    capturedAt: string;
    note?: string;
  };
  workItem: WorkItem;          // the work item the session was about
  chain: AgentId[];            // expected handoff order (informational for observed)
  events: WorkflowEvent[];     // chronological
}
```

This is everything the scenario registry needs to register an observed
scenario. There's no separate transformation step between "parser is done"
and "scenario is renderable" — the parser output *is* a scenario, minus
the `id`/`title`/`subtitle`/`kind` metadata that always lives on the
registry side.

The fixture at `observed-sample.json` is exactly this shape; the loader
routes it through `sessionFromFixture()` so fixture-driven code goes
through the same function the real parser output will use.

A companion helper, `deriveChainFromEvents()`, computes a `chain` from the
session's `work_item.owner.changed` events (collapsing adjacent duplicates).
Real parsers can call it to produce a sensible default, then override
where needed.

When the real parser lands:

- `mock-events-observed.ts` switches from `import observedJson from
  "./observed-sample.json"` to `parseClaudeCodeTranscript(rawJsonl)`.
- Nothing else changes. The `Scenario` entry, the store, the validator,
  the UI, and the tests all stay put.

## Why a stub error class, not a `TODO`

A typed error (`ClaudeCodeParserNotImplementedError`) is greppable, has a
single source of truth for the "this is the spike boundary" line, and means
any accidental call site fails at the right place with a useful message.
The alternative — returning `null` or empty events — would let a partial
implementation creep in invisibly.

## What's still open

- Capturing tool-call sequences as artifacts (one artifact per `Edit`? or
  per logical task?).
- Mapping multiple acting personas inside one transcript (subagents,
  user + agent interleaving) onto multiple office agents.
- Choosing the office agent for an observed run (today the fixture hard-codes
  `mira`; v0.2 will need rules — probably room-based on the kind of tool
  calls observed).
- Whether observer mode also captures hook outputs (`PreToolUse`,
  `PostToolUse`) or just transcript turns.

The shape of the raw input is now documented — see
[`claude-code-transcript-format.md`](claude-code-transcript-format.md) and
[`src/lib/claude-code-transcript.ts`](../../src/lib/claude-code-transcript.ts).
JSONL → typed raw lines is implemented; raw lines → `WorkflowEvent[]` is
the next PR.

See also: [`docs/product/now-next-later-never.md`](../product/now-next-later-never.md)
for where this sits in the roadmap.
