import type { AgentStatus } from "@/types/agents";
import type { WorkflowEvent } from "@/types/workflow-events";

/**
 * ObservedPlaybackReducer — Spike 0 for observed mode.
 *
 * Collapses a dense, literal `WorkflowEvent[]` stream into a much smaller
 * sequence of `VisualBeat`s the renderer can animate without strobing. The
 * make-or-break structural question from
 * [`docs/design/observed-office.md`](../../docs/design/observed-office.md):
 * *does a real dense session collapse into sane, truthful beats?*
 *
 * Design contract:
 *
 * - **Pure.** `WorkflowEvent[]` in, `VisualBeat[]` out. No React, no store,
 *   no IO, no `Date.now`/`Math.random`. Same ethos as `applyEvent`,
 *   `validateScenario`, `timelinePosition`.
 * - **Preserve truth.** Every non-lifecycle (activity) event id lands in
 *   exactly one beat — including detail events that arrive *before* the first
 *   activity beat (they buffer and fold into it; a message-only session gets
 *   one generic `note` beat). `eventCount === eventIds.length`. Smoothing is a
 *   *view* grouping over the real events, never a replacement.
 * - **Privacy by construction.** Labels are generated from *action + a count
 *   of action signals only*, never from event payload text. The reducer cannot
 *   leak a raw prompt, command, stderr, or thinking string into a label. The
 *   one place it reads `payload.message` is to match a single known-safe
 *   *constant* (the runtime's compaction marker) for classification — never
 *   for display.
 *
 * Coalescing: consecutive events with the **same action** fold into one beat.
 * `agent.message.sent` and non-PR `artifact.produced` *attach* (detail) — they
 * bump `eventCount` but not `signalCount`, so a coding beat with 5 edits + 5
 * chatter messages labels honestly as "editing intensely (5 edits)", not 10.
 */

export type ObservedZone =
  | "reading"
  | "coding"
  | "testing"
  | "thinking"
  | "human"
  | "outbox"
  | "activity"; // meta zone for system/orphan beats (compaction, note fallback)

export type BeatAction =
  | "read"
  | "edit"
  | "test_run"
  | "test_pass"
  | "test_fail"
  | "think"
  | "human_consulted"
  | "outbox"
  | "compact"
  | "blocked"
  | "note"; // generic fallback so no activity event is ever lost

export type BeatSeverity = "info" | "success" | "warning" | "error";

export interface VisualBeat {
  /** Stable, deterministic key for the renderer. */
  id: string;
  zone: ObservedZone;
  action: BeatAction;
  severity: BeatSeverity;
  /** ISO timestamp of the earliest folded event. */
  startTs: string;
  /** ISO timestamp of the latest folded event. */
  endTs: string;
  /**
   * Total raw events folded in (action signals + attached detail). Always
   * === eventIds.length. This is the drill-down count.
   */
  eventCount: number;
  /**
   * Count of *action signals* of this beat's action (e.g. actual edits) —
   * excludes attached messages/artifacts. This is what the label uses, so the
   * label can't overstate "N edits".
   */
  signalCount: number;
  /** Drill-down handle — every raw event id that folded in. Preserves truth. */
  eventIds: string[];
  /** Content-free, generated from action + signalCount only. */
  label: string;
}

/** The runtime's compaction marker (a known-safe constant — not arbitrary text). */
const COMPACT_MARKER = "Conversation compacted by the runtime";

/** A classification of one event: a beat signal, an attach (detail), or skip. */
type Signal =
  | { kind: "beat"; zone: ObservedZone | "__current__"; action: BeatAction; severity: BeatSeverity }
  | { kind: "attach" }
  | { kind: "skip" };

const STATUS_SIGNAL: Partial<Record<AgentStatus, Signal>> = {
  reading: { kind: "beat", zone: "reading", action: "read", severity: "info" },
  coding: { kind: "beat", zone: "coding", action: "edit", severity: "info" },
  testing: { kind: "beat", zone: "testing", action: "test_run", severity: "info" },
  thinking: { kind: "beat", zone: "thinking", action: "think", severity: "info" },
  // The mapper emits the existing `waiting_on_human` status; the reducer
  // relabels it to the past-tense `human_consulted` action so the beat reads
  // "a human was asked here" (informational), never present-tense "blocked on
  // you now" — see the doc's governance section.
  waiting_on_human: { kind: "beat", zone: "human", action: "human_consulted", severity: "info" },
  // `failed` is a state, not a place — keep the current zone, mark it an error.
  failed: { kind: "beat", zone: "__current__", action: "blocked", severity: "error" },
  // planning / designing / reviewing / talking / meeting / waiting_on_agent /
  // blocked / done / idle stay dormant for observed mode (per the doc) — skip.
};

/**
 * Distinguish a real PR-link artifact from an edit artifact. Both use
 * `kind: "code_pr"` (the mapper has no separate code-change kind), so kind
 * alone is NOT enough — an edit artifact would otherwise render as "opened a
 * PR". A real PR is identified by a `/pull/<n>` ref or a `PR #<n>` summary.
 */
function isPrArtifact(artifact: { kind?: string; ref?: string; summary?: string }): boolean {
  if (artifact.kind !== "code_pr") return false;
  const ref = artifact.ref ?? "";
  const summary = artifact.summary ?? "";
  return /\/pull\/\d+/.test(ref) || /^PR #\d+\b/.test(summary);
}

function classify(event: WorkflowEvent): Signal {
  switch (event.type) {
    case "agent.status.changed": {
      const to = (event.payload as { to?: AgentStatus }).to;
      return (to && STATUS_SIGNAL[to]) ?? { kind: "skip" };
    }

    case "quality_gate.passed":
      return { kind: "beat", zone: "testing", action: "test_pass", severity: "success" };
    case "quality_gate.failed":
      return { kind: "beat", zone: "testing", action: "test_fail", severity: "error" };

    case "artifact.produced": {
      const artifact = (event.payload as { artifact?: { kind?: string; ref?: string; summary?: string } }).artifact ?? {};
      // Only a genuine PR link is an outbox beat; edit artifacts (also
      // kind:"code_pr") are detail within the current coding activity.
      if (isPrArtifact(artifact)) {
        return { kind: "beat", zone: "outbox", action: "outbox", severity: "success" };
      }
      return { kind: "attach" };
    }

    case "blocker.raised":
      return { kind: "beat", zone: "__current__", action: "blocked", severity: "error" };

    case "agent.message.sent": {
      // The single known-safe constant the reducer matches for classification.
      // (Long-term: a dedicated compaction event type would be cleaner than a
      // string match — tracked in the design doc.)
      if ((event.payload as { message?: string }).message === COMPACT_MARKER) {
        return { kind: "beat", zone: "activity", action: "compact", severity: "info" };
      }
      return { kind: "attach" };
    }

    // Lifecycle — bracket the timeline, not beats. Remain in the raw log.
    case "run.started":
    case "run.paused":
    case "run.completed":
    case "work_item.created":
    case "work_item.refined":
    case "work_item.owner.changed":
    case "work_item.mode.changed":
    case "work_item.completed":
      return { kind: "skip" };

    default:
      // Anything not yet modeled for observed playback (room.*, meeting.*,
      // permission.*, handoff.*, decision.*, approval.*) is skipped rather
      // than fabricated into a beat.
      return { kind: "skip" };
  }
}

const DEFAULT_ZONE: ObservedZone = "coding";

/**
 * Reduce a literal event stream to a watchable beat sequence.
 *
 * Pure. Deterministic ids (`beat_0000`, `beat_0001`, …). Returns `[]` for an
 * empty or activity-free (lifecycle-only) stream.
 */
export function reduceObservedPlayback(events: WorkflowEvent[]): VisualBeat[] {
  const beats: VisualBeat[] = [];
  let current: VisualBeat | null = null;
  let currentZone: ObservedZone = DEFAULT_ZONE;
  let seq = 0;
  // Detail events seen before any beat is open. They are NOT lost: they fold
  // into the next beat that opens, or become a generic `note` beat at the end.
  const pending: WorkflowEvent[] = [];

  const nextId = () => `beat_${String(seq++).padStart(4, "0")}`;

  const flush = () => {
    if (current) {
      current.label = labelFor(current.action, current.signalCount);
      beats.push(current);
      current = null;
    }
  };

  for (const event of events) {
    const sig = classify(event);

    if (sig.kind === "skip") continue;

    if (sig.kind === "attach") {
      if (current) {
        // Detail within the current activity: bump total count, not signals.
        current.eventIds.push(event.id);
        current.eventCount = current.eventIds.length;
        current.endTs = event.ts;
      } else {
        // No beat yet — buffer; will fold into the next beat (or a note beat).
        pending.push(event);
      }
      continue;
    }

    // sig.kind === "beat"
    const zone = sig.zone === "__current__" ? currentZone : sig.zone;

    if (current && current.action === sig.action) {
      // Same action — coalesce. This IS a signal, so bump signalCount too.
      current.eventIds.push(event.id);
      current.eventCount = current.eventIds.length;
      current.signalCount += 1;
      current.endTs = event.ts;
      continue;
    }

    flush();

    // Open a new beat. Any buffered leading detail folds in first (it happened
    // before this activity, so it owns the earlier startTs).
    const pendingIds = pending.map((e) => e.id);
    const startTs = pending[0]?.ts ?? event.ts;
    pending.length = 0;
    current = {
      id: nextId(),
      zone,
      action: sig.action,
      severity: sig.severity,
      startTs,
      endTs: event.ts,
      eventIds: [...pendingIds, event.id],
      eventCount: pendingIds.length + 1,
      signalCount: 1, // the opening event is one action signal
      label: "",
    };
    currentZone = zone;
  }

  flush();

  // A session made entirely of detail (e.g. only assistant text, no tool
  // activity) still must not lose its events: emit one generic note beat.
  if (beats.length === 0 && pending.length > 0) {
    beats.push({
      id: nextId(),
      zone: "activity",
      action: "note",
      severity: "info",
      startTs: pending[0].ts,
      endTs: pending[pending.length - 1].ts,
      eventIds: pending.map((e) => e.id),
      eventCount: pending.length,
      signalCount: 0, // no action signals — pure detail
      label: labelFor("note", 0),
    });
  }

  return beats;
}

function labelFor(action: BeatAction, signalCount: number): string {
  switch (action) {
    case "read":
      return signalCount > 1 ? `read ${signalCount} files` : "reading";
    case "edit":
      return signalCount > 1 ? `editing intensely (${signalCount} edits)` : "editing";
    case "test_run":
      return "running tests";
    case "test_pass":
      return "tests passed";
    case "test_fail":
      return "tests failed";
    case "think":
      return "thinking";
    case "human_consulted":
      return "human consulted";
    case "outbox":
      return "opened a PR";
    case "compact":
      return "compacted context";
    case "blocked":
      return "blocked";
    case "note":
      return "activity observed";
  }
}
