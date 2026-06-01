import type { VisualBeat } from "@/lib/observed-playback-reducer";
import type { LocalTranscriptResult } from "./local-transcript-view";

/**
 * Pure selector for the observed stage's active source (#65/#66 polish).
 *
 * The observed stage shows exactly one session: the bundled demo **sample** by
 * default, or a successfully **loaded** local transcript once one is imported.
 * This decides which — so a loaded transcript *replaces* the sample instead of
 * stacking above it. A failed/cleared load leaves the sample active (the loader
 * card surfaces the safe error separately).
 *
 * Pure and deterministic; the `ObservedStage` component owns the loaded state
 * and renders whatever this returns.
 */

export type ObservedSourceKind = "sample" | "loaded";

export interface ActiveObservedSource {
  kind: ObservedSourceKind;
  beats: VisualBeat[];
  /** Evidence Pack markdown for the active source (null only if a sample lacks one). */
  markdown: string | null;
  /** Content-free status label for the stage header. */
  label: string;
}

export function selectActiveObservedSource(
  loaded: LocalTranscriptResult | null,
  sampleBeats: VisualBeat[],
  sampleMarkdown: string | null,
): ActiveObservedSource {
  // Only a SUCCESSFUL load takes over the stage; a parse/validation error
  // leaves the sample active (the loader card shows the safe error).
  if (loaded && loaded.ok) {
    return {
      kind: "loaded",
      beats: loaded.beats,
      markdown: loaded.evidenceMarkdown,
      label: "Viewing loaded local transcript",
    };
  }
  return {
    kind: "sample",
    beats: sampleBeats,
    markdown: sampleMarkdown,
    label: "Viewing bundled demo sample",
  };
}
