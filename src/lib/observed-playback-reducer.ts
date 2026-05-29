import type { AgentStatus } from "@/types/agents";
import type { WorkflowEvent } from "@/types/workflow-events";

/**
 * ObservedPlaybackReducer — Spike 0 for observed mode.
 *
 * Collapses a dense, literal `WorkflowEvent[]` stream into a much smaller
 * sequence of `VisualBeat`s the renderer can animate without strobing. This
 * is the make-or-break structural question from
 * [`docs/design/observed-office.md`](../../docs/design/observed-office.md):
 * *does a real dense session collapse into sane, truthful beats?*
 *
 * Design contract:
 *
 * - **Pure.** `WorkflowEvent[]` in, `VisualBeat[]` out. No React, no store,
 *   no IO, no `Date.now`/`Math.random`. Same ethos as `applyEvent`,
 *   `validateScenario`, `timelinePosition`.
 * - **Preserve truth.** Every beat carries `eventIds` (and `eventCount ===
 *   eventIds.length`). Smoothing is a *view* grouping over the real events,
 *   never a replacement — the activity log and drill-down stay literal.
 * - **Privacy by construction.** Labels are generated from *action + count
 *   only*, never from event payload text. The reducer cannot leak a raw
 *   prompt, command, stderr, or thinking string into a beat label because it
 *   never reads `payload.message` for display. (Input is already redacted by
 *   the mapper; the reducer adds no new exposure surface.)
 *
 * Coalescing rule: consecutive events with the **same action** fold into one
 * beat (10 edits → one "editing intensely (10 edits)" beat). `agent.message.sent`
 * and non-PR `artifact.produced` *attach* to the current beat (bump count,
 * extend end) rather than spawning their own — they're detail within an
 * activity, not a zone hop. Lifecycle events (`run.*`, `work_item.*`) are not
 * beats; they bracket the timeline and remain in the raw log.
 *
 * Minimum-dwell *timing* (how long a beat must stay on screen) is a renderer
 * concern layered on top — the reducer handles the structural collapse.
 */

export type ObservedZone =
  | "reading"
  | "coding"
  | "testing"
  | "thinking"
  | "human"
  | "outbox";

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
  | "blocked";

export type BeatSeverity = "info" | "success" | "warning" | "error";

export interface VisualBeat {
  /** Stable, deterministic key for the renderer. */
  id: string;
  zone: ObservedZone;
  action: BeatAction;
  severity: BeatSeverity;
  /** ISO timestamp of the first folded event. */
  startTs: string;
  /** ISO timestamp of the last folded event. */
  endTs: string;
  /** How many raw events collapsed into this beat. Always === eventIds.length. */
  eventCount: number;
  /** Drill-down handle — every raw event id that folded in. Preserves truth. */
  eventIds: string[];
  /** Content-free, generated from action + count only (privacy by construction). */
  label: string;
}

/** A classification of one event: a beat signal, an attach, or skip. */
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
      const kind = (event.payload as { artifact?: { kind?: string } }).artifact?.kind;
      // A PR artifact is the terminal "sent it out" beat; other artifacts
      // (code edits) are detail within the current coding activity.
      if (kind === "code_pr") {
        return { kind: "beat", zone: "outbox", action: "outbox", severity: "success" };
      }
      return { kind: "attach" };
    }

    case "blocker.raised":
      return { kind: "beat", zone: "__current__", action: "blocked", severity: "error" };

    case "agent.message.sent":
      return { kind: "attach" };

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
 * empty or activity-free stream.
 */
export function reduceObservedPlayback(events: WorkflowEvent[]): VisualBeat[] {
  const beats: VisualBeat[] = [];
  let current: VisualBeat | null = null;
  let currentZone: ObservedZone = DEFAULT_ZONE;
  let seq = 0;

  // Fold an event into the open beat (detail / coalesce): bump count + extend end.
  const fold = (beat: VisualBeat, ev: WorkflowEvent) => {
    beat.eventIds.push(ev.id);
    beat.eventCount = beat.eventIds.length;
    beat.endTs = ev.ts;
  };

  // Finalize the open beat (generate its content-free label) and push it.
  const flush = () => {
    if (current) {
      current.label = labelFor(current.action, current.eventCount);
      beats.push(current);
      current = null;
    }
  };

  for (const event of events) {
    const sig = classify(event);

    if (sig.kind === "skip") continue;

    if (sig.kind === "attach") {
      // Detail within the current activity. If nothing is open yet, the
      // detail has no home — it stays in the raw log only.
      if (current) fold(current, event);
      continue;
    }

    // sig.kind === "beat"
    const zone = sig.zone === "__current__" ? currentZone : sig.zone;

    if (current && current.action === sig.action) {
      // Same action — coalesce (this is the dense-stream collapse).
      fold(current, event);
      continue;
    }

    flush();
    current = {
      id: `beat_${String(seq++).padStart(4, "0")}`,
      zone,
      action: sig.action,
      severity: sig.severity,
      startTs: event.ts,
      endTs: event.ts,
      eventCount: 1,
      eventIds: [event.id],
      label: "", // finalized on flush
    };
    currentZone = zone;
  }

  flush();
  return beats;
}

function labelFor(action: BeatAction, count: number): string {
  switch (action) {
    case "read":
      return count > 1 ? `read ${count} files` : "reading";
    case "edit":
      return count > 1 ? `editing intensely (${count} edits)` : "editing";
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
  }
}
