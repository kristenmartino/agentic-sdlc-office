"use client";

import { useState } from "react";
import type { BeatSeverity, VisualBeat } from "@/lib/observed-playback-reducer";
import { buildTimelineView } from "./observed-beat-view";

/**
 * Render spike for observed mode — a minimal, honest view of a real session's
 * `VisualBeat[]` (from `reduceObservedPlayback`). Purpose: judge whether a
 * dense session is *pleasant and legible to watch*, not just structurally
 * correct.
 *
 * Honesty/privacy: this component renders ONLY `VisualBeat` fields via the
 * pure `buildTimelineView` model. It never receives or reads raw event
 * payloads, so no prompt / command / stderr / thinking / MCP / attachment
 * text can appear. Smoothed on top (few beats), literal underneath: raw
 * event ids stay upstream on the VisualBeat[] while the render model exposes
 * only display-safe refs ("event 1", …) for drill-down — never the raw ids
 * (which embed the session id).
 *
 * Deliberately NOT here: sprite animation, fabricated specialist handoffs,
 * multi-session paths, the campus. This is the smallest surface that answers
 * the aesthetic make-or-break question.
 */

const SEVERITY_CHIP: Record<BeatSeverity, string> = {
  info: "bg-office-line/70 text-office-text ring-1 ring-office-line",
  success: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40",
  warning: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40",
  error: "bg-red-500/15 text-red-200 ring-1 ring-red-500/40",
};

const SEVERITY_DOT: Record<BeatSeverity, string> = {
  info: "bg-office-muted",
  success: "bg-emerald-400",
  warning: "bg-amber-400",
  error: "bg-red-400",
};

const STAGE_TINT: Record<BeatSeverity, string> = {
  info: "border-iris/30 bg-iris/5",
  success: "border-emerald-500/40 bg-emerald-500/10",
  warning: "border-amber-500/40 bg-amber-500/10",
  error: "border-red-500/40 bg-red-500/10",
};

export default function ObservedBeatTimeline({
  beats,
  defaultSelectedBeatId = null,
}: {
  beats: VisualBeat[];
  /** Render pre-selected (used by tests / deep-links). */
  defaultSelectedBeatId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelectedBeatId);
  const view = buildTimelineView(beats, selectedId);

  if (beats.length === 0) {
    return (
      <section
        className="rounded-lg border border-iris/30 bg-office-panel/60 p-4 text-[11px] text-office-muted italic"
        aria-label="Observed beat timeline"
      >
        No observed activity yet.
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border border-iris/30 bg-office-panel/60 p-3 flex flex-col gap-3"
      aria-label="Observed beat timeline"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-iris">
          Observed timeline
        </h3>
        <span className="text-[10px] font-mono text-office-muted">
          {view.summary.beatCount} beats · {view.summary.eventCount} events · read-only
        </span>
      </header>

      {/* The protagonist — one little agent, doing the current beat's action.
          Honest: a real session is one unnamed agent, so no specialist cast. */}
      {view.stage && (
        <div className={`flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 ${STAGE_TINT[view.stage.severity]}`}>
          <span
            className="text-base leading-none animate-pulse-soft motion-reduce:animate-none select-none"
            aria-hidden
          >
            🤖
          </span>
          <span className="text-base leading-none select-none" aria-hidden>
            {view.stage.glyph}
          </span>
          <span className="text-[11px] text-office-text">
            <span className="font-medium">the agent {view.stage.phrase}</span>
            <span className="text-office-muted"> · in {view.stage.zoneLabel}</span>
          </span>
        </div>
      )}

      {/* The flow — beats left→right in time order. */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1" role="list" aria-label="Beat sequence">
        {view.sequence.map((b, i) => (
          <div key={b.id} className="flex items-center gap-1 shrink-0" role="listitem">
            <button
              onClick={() => setSelectedId((cur) => (cur === b.id ? null : b.id))}
              aria-pressed={selectedId === b.id}
              title={`${b.label} · ${b.eventCount} events`}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition ${SEVERITY_CHIP[b.severity]} ${
                selectedId === b.id ? "outline outline-1 outline-iris" : "hover:brightness-125"
              }`}
            >
              {b.label}
              {b.eventCount > 1 && (
                <span className="ml-1 font-mono opacity-60">×{b.eventCount}</span>
              )}
            </button>
            {i < view.sequence.length - 1 && (
              <span className="text-[10px] text-office-muted/40" aria-hidden>
                →
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Where time went — one row per populated zone. The protagonist (🤖)
          stands in whichever lane it's currently in; the lane is highlighted. */}
      <div className="flex flex-col gap-1" aria-label="Zone lanes">
        {view.lanes.map((lane) => (
          <div
            key={lane.zone}
            className={`flex items-center gap-2 rounded px-1 py-0.5 transition ${
              lane.active ? "bg-iris/10 ring-1 ring-iris/30" : ""
            }`}
          >
            <span className={`w-16 shrink-0 text-[9px] uppercase tracking-wide text-right ${
              lane.active ? "text-iris" : "text-office-muted"
            }`}>
              {lane.label}
            </span>
            <span className="w-4 shrink-0 text-center text-xs leading-none select-none" aria-hidden>
              {lane.active ? "🤖" : ""}
            </span>
            <div className="flex flex-wrap gap-1">
              {lane.beats.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedId((cur) => (cur === b.id ? null : b.id))}
                  aria-pressed={selectedId === b.id}
                  title={b.label}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition ${SEVERITY_CHIP[b.severity]} ${
                    selectedId === b.id ? "outline outline-1 outline-iris" : "hover:brightness-125"
                  }`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[b.severity]}`} aria-hidden />
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Drill-down — event ids and counts only, never raw content. */}
      {view.selected && (
        <aside className="rounded border border-office-line bg-office-bg/60 p-2.5 text-[10px]" aria-label="Selected beat detail">
          <div className="flex items-center justify-between">
            <span className="font-medium text-office-text">{view.selected.label}</span>
            <span className="font-mono text-office-muted">
              {view.selected.zoneLabel} · {view.selected.action} · {view.selected.severity}
            </span>
          </div>
          <div className="mt-1 font-mono text-office-muted">
            {view.selected.signalCount} signal{view.selected.signalCount === 1 ? "" : "s"} ·{" "}
            {view.selected.eventCount} event{view.selected.eventCount === 1 ? "" : "s"}
          </div>
          <div className="mt-1.5">
            <p className="text-office-muted/70 uppercase tracking-wide text-[8px] mb-0.5">
              drill-down — {view.selected.eventCount} event{view.selected.eventCount === 1 ? "" : "s"} (refs only, no ids or content)
            </p>
            <div className="flex flex-wrap gap-1">
              {view.selected.eventRefs.map((ref) => (
                <span key={ref} className="font-mono px-1 py-0.5 rounded bg-office-line/60 text-office-muted">
                  {ref}
                </span>
              ))}
            </div>
          </div>
        </aside>
      )}
    </section>
  );
}
