import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { selectActiveObservedSource } from "./observed-stage-view";
import {
  parseLocalTranscriptToObservedView,
  type LocalTranscriptResult,
} from "./local-transcript-view";
import { buildTimelineView } from "./observed-beat-view";
import { reduceObservedPlayback } from "@/lib/observed-playback-reducer";
import { OBSERVED_SAMPLE_SESSION } from "@/data/mock-events-observed";

/**
 * Tests for the observed stage's active-source selection (#65/#66 polish):
 * a successfully loaded local transcript REPLACES the bundled sample; a failed
 * or cleared load leaves the sample active.
 */

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/claude-code-transcript-real-redacted.jsonl",
);
const loadedFromFixture = (): LocalTranscriptResult =>
  parseLocalTranscriptToObservedView(readFileSync(FIXTURE_PATH, "utf8"));

// A stand-in for the bundled sample's beats + markdown (identity-checked below).
const sampleBeats = reduceObservedPlayback(OBSERVED_SAMPLE_SESSION.events);
const SAMPLE_MD = "# bundled sample markdown";

const FORBIDDEN = [
  "/Users/",
  "/home/",
  "/root/",
  "rootk",
  "redacted-session",
  "evt_",
  "u-000",
  "tu-000",
  "[redacted]",
  "pnpm test",
  "Button.tsx",
  "API_KEY",
  "sk-",
  "ghp_",
  "thinking",
  "raw prompt text",
  "raw assistant text",
];

describe("selectActiveObservedSource", () => {
  it("defaults to the bundled sample when nothing is loaded", () => {
    const active = selectActiveObservedSource(null, sampleBeats, SAMPLE_MD);
    expect(active.kind).toBe("sample");
    expect(active.beats).toBe(sampleBeats);
    expect(active.markdown).toBe(SAMPLE_MD);
    expect(active.label).toBe("Viewing bundled demo sample");
  });

  it("switches to the loaded transcript on a successful load (replaces the sample)", () => {
    const loaded = loadedFromFixture();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const active = selectActiveObservedSource(loaded, sampleBeats, SAMPLE_MD);
    expect(active.kind).toBe("loaded");
    expect(active.beats).toBe(loaded.beats);
    expect(active.markdown).toBe(loaded.evidenceMarkdown);
    expect(active.label).toBe("Viewing loaded local transcript");
  });

  it("stays on the sample when a load FAILED (an error never takes over the stage)", () => {
    const errorResult: LocalTranscriptResult = { ok: false, message: "boom" };
    const active = selectActiveObservedSource(errorResult, sampleBeats, SAMPLE_MD);
    expect(active.kind).toBe("sample");
    expect(active.beats).toBe(sampleBeats);
    expect(active.markdown).toBe(SAMPLE_MD);
  });

  it("returns to the sample after clearing (loaded → null)", () => {
    const loaded = loadedFromFixture();
    expect(selectActiveObservedSource(loaded, sampleBeats, SAMPLE_MD).kind).toBe("loaded");
    // Clear sets loaded back to null → sample is active again.
    expect(selectActiveObservedSource(null, sampleBeats, SAMPLE_MD).kind).toBe("sample");
  });

  it("the loaded active source leaks nothing through its renderable surfaces", () => {
    const loaded = loadedFromFixture();
    if (!loaded.ok) throw new Error("fixture should load");
    const active = selectActiveObservedSource(loaded, sampleBeats, SAMPLE_MD);
    // Probe what can reach the UI: the timeline render model (drops raw eventIds)
    // plus the evidence markdown.
    const renderable = JSON.stringify(buildTimelineView(active.beats)) + "\n" + (active.markdown ?? "");
    for (const probe of FORBIDDEN) {
      expect(renderable.includes(probe), `active loaded source leaked: ${probe}`).toBe(false);
    }
  });
});
