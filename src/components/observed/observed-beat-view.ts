import type { ObservedZone, VisualBeat } from "@/lib/observed-playback-reducer";

/**
 * Pure render model for the ObservedBeatTimeline.
 *
 * Splitting the data-shaping out of the `.tsx` (the same pattern as
 * `timelinePosition` vs `PhaseTimeline`) keeps it unit-testable in vitest's
 * node environment and keeps the component a thin presentational layer.
 *
 * Privacy by construction: this model is built **only** from `VisualBeat`
 * fields, and it deliberately **drops raw event ids**. Mapper-generated ids
 * embed the session id (`evt_<sessionId>_NNNN`), so printing them would leak
 * identifying transcript metadata — which is exactly what a privacy-claiming
 * surface must not do. The render model therefore carries:
 *   - the safe deterministic beat id (`beat_NNNN`, no session info) for keys,
 *   - display-safe `eventRefs` (`"event 1"`, `"event 2"`, …) for drill-down,
 *   - counts and content-free labels.
 * Raw `eventIds` stay on the upstream `VisualBeat[]` (and the store log) for a
 * future click-through to the raw log; they never enter this render model, so
 * the serialized view contains no session id and no payload content. The
 * privacy tests assert both end-to-end.
 */

/** Canonical lane order. `activity` is the meta lane (compaction / note). */
export const ZONE_ORDER: readonly ObservedZone[] = [
  "reading",
  "coding",
  "testing",
  "thinking",
  "human",
  "outbox",
  "activity",
];

export const ZONE_LABEL: Record<ObservedZone, string> = {
  reading: "Reading",
  coding: "Coding",
  testing: "Testing",
  thinking: "Thinking",
  human: "Human",
  outbox: "Outbox",
  activity: "Activity",
};

/**
 * A display-safe projection of a `VisualBeat` for the strip/lanes. Carries
 * everything the renderer needs — and deliberately **no `eventIds`**, so no
 * session-id-bearing id can reach the DOM. `id` is the safe `beat_NNNN`.
 */
export interface BeatChip {
  id: string;
  zone: ObservedZone;
  action: VisualBeat["action"];
  severity: VisualBeat["severity"];
  label: string;
  eventCount: number;
}

export interface ZoneLane {
  zone: ObservedZone;
  label: string;
  beats: BeatChip[];
}

export interface BeatDetail {
  id: string;
  zone: ObservedZone;
  zoneLabel: string;
  action: VisualBeat["action"];
  severity: VisualBeat["severity"];
  label: string;
  /** Total raw events folded in (drill-down count). */
  eventCount: number;
  /** Action-signal count (what the label is based on). */
  signalCount: number;
  startTs: string;
  endTs: string;
  /**
   * Display-safe drill-down references (`"event 1"`, …) — one per folded
   * event, in order. NOT the raw event ids (which embed the session id).
   */
  eventRefs: string[];
}

export interface TimelineView {
  summary: { beatCount: number; eventCount: number };
  /** Beats in time order — the "flow". Safe chips, no raw ids. */
  sequence: BeatChip[];
  /** Populated zones only, in canonical order — the "where time went". */
  lanes: ZoneLane[];
  /** The drill-down detail for the selected beat, or null. */
  selected: BeatDetail | null;
}

function toChip(beat: VisualBeat): BeatChip {
  return {
    id: beat.id,
    zone: beat.zone,
    action: beat.action,
    severity: beat.severity,
    label: beat.label,
    eventCount: beat.eventCount,
  };
}

export function beatDetail(beat: VisualBeat): BeatDetail {
  return {
    id: beat.id,
    zone: beat.zone,
    zoneLabel: ZONE_LABEL[beat.zone],
    action: beat.action,
    severity: beat.severity,
    label: beat.label,
    eventCount: beat.eventCount,
    signalCount: beat.signalCount,
    startTs: beat.startTs,
    endTs: beat.endTs,
    // Display-safe refs only — raw eventIds (with session id) never leave the
    // upstream VisualBeat; the count drives the ref list.
    eventRefs: beat.eventIds.map((_, i) => `event ${i + 1}`),
  };
}

/**
 * Build the full render model from a beat sequence and an optional selection.
 * Pure and deterministic. The result is session-id-free and content-free.
 */
export function buildTimelineView(
  beats: VisualBeat[],
  selectedId?: string | null,
): TimelineView {
  const eventCount = beats.reduce((n, b) => n + b.eventCount, 0);

  const byZone = new Map<ObservedZone, BeatChip[]>();
  for (const beat of beats) {
    const chip = toChip(beat);
    const list = byZone.get(beat.zone);
    if (list) list.push(chip);
    else byZone.set(beat.zone, [chip]);
  }

  const lanes: ZoneLane[] = ZONE_ORDER.filter((z) => byZone.has(z)).map((zone) => ({
    zone,
    label: ZONE_LABEL[zone],
    beats: byZone.get(zone)!,
  }));

  const selectedBeat = selectedId ? beats.find((b) => b.id === selectedId) : undefined;

  return {
    summary: { beatCount: beats.length, eventCount },
    sequence: beats.map(toChip),
    lanes,
    selected: selectedBeat ? beatDetail(selectedBeat) : null,
  };
}
