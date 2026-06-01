"use client";

import { useState } from "react";
import type { VisualBeat } from "@/lib/observed-playback-reducer";
import ObservedBeatTimeline from "./ObservedBeatTimeline";
import EvidencePackPanel from "./EvidencePackPanel";
import LocalTranscriptLoader from "./LocalTranscriptLoader";
import { selectActiveObservedSource } from "./observed-stage-view";
import type { LocalTranscriptResult } from "./local-transcript-view";

/**
 * ObservedStage — owns "which observed session is on stage" (#65/#66 polish).
 *
 * The stage shows exactly one session at a time: the bundled demo `sample`
 * (passed in from the page's playback) by default, or a successfully loaded
 * local transcript once one is imported. A loaded transcript REPLACES the
 * sample (rather than stacking); Clear (or a failed load) returns to the sample.
 *
 * The loaded-vs-sample decision is the pure `selectActiveObservedSource`; this
 * component just holds the loaded state and renders the chosen source through
 * the same safe `ObservedBeatTimeline` / `EvidencePackPanel` components, so no
 * raw transcript content can reach the UI either way.
 */
export default function ObservedStage({
  sampleBeats,
  sampleMarkdown,
}: {
  sampleBeats: VisualBeat[];
  sampleMarkdown: string | null;
}) {
  const [loaded, setLoaded] = useState<LocalTranscriptResult | null>(null);
  const active = selectActiveObservedSource(loaded, sampleBeats, sampleMarkdown);

  return (
    <>
      <LocalTranscriptLoader result={loaded} onResult={setLoaded} onClear={() => setLoaded(null)} />

      <div className="flex items-center gap-2 px-1">
        <span
          className={`text-[10px] font-mono uppercase tracking-wide ${
            active.kind === "loaded" ? "text-emerald-300" : "text-office-muted"
          }`}
        >
          {active.label}
        </span>
        {active.kind === "loaded" && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30">
            local · read-only
          </span>
        )}
      </div>

      <ObservedBeatTimeline beats={active.beats} />
      <EvidencePackPanel markdown={active.markdown} />
    </>
  );
}
