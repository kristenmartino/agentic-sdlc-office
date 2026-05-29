import { describe, expect, it } from "vitest";
import { buildTimelineView, ZONE_ORDER } from "./observed-beat-view";
import { reduceObservedPlayback, type VisualBeat } from "@/lib/observed-playback-reducer";
import type { WorkflowEvent } from "@/types/workflow-events";
import type { AgentStatus } from "@/types/agents";

// ─── Synthetic events (no real session) ──────────────────────────────────────

let _seq = 0;
const ev = (type: WorkflowEvent["type"], payload: Record<string, unknown>): WorkflowEvent => ({
  id: `e${String(_seq++).padStart(4, "0")}`,
  ts: new Date(Date.parse("2026-05-27T15:00:00.000Z") + _seq * 1000).toISOString(),
  actor: "mira",
  type,
  subject: "wi_test",
  payload,
});
const status = (to: AgentStatus) => ev("agent.status.changed", { agentId: "mira", to });
const message = (text: string) => ev("agent.message.sent", { agentId: "mira", message: text });
const prArtifact = () =>
  ev("artifact.produced", { artifact: { kind: "code_pr", ref: "https://github.com/example/repo/pull/1", summary: "PR #1 opened in example/repo" } });

// A simple beat for direct view tests (bypassing the reducer).
const beat = (over: Partial<VisualBeat>): VisualBeat => ({
  id: "beat_0000",
  zone: "coding",
  action: "edit",
  severity: "info",
  startTs: "2026-05-27T15:00:00.000Z",
  endTs: "2026-05-27T15:00:01.000Z",
  eventCount: 1,
  signalCount: 1,
  eventIds: ["e0"],
  label: "editing",
  ...over,
});

describe("buildTimelineView — summary + sequence", () => {
  it("empty beats → empty view", () => {
    const view = buildTimelineView([]);
    expect(view.summary).toEqual({ beatCount: 0, eventCount: 0 });
    expect(view.sequence).toEqual([]);
    expect(view.lanes).toEqual([]);
    expect(view.selected).toBeNull();
  });

  it("summary counts beats and total folded events", () => {
    const view = buildTimelineView([
      beat({ id: "beat_0000", eventCount: 3 }),
      beat({ id: "beat_0001", zone: "testing", action: "test_run", eventCount: 2 }),
    ]);
    expect(view.summary.beatCount).toBe(2);
    expect(view.summary.eventCount).toBe(5);
    expect(view.sequence).toHaveLength(2); // preserved in time order
  });
});

describe("buildTimelineView — zone lanes", () => {
  it("groups beats into populated zone lanes in canonical order", () => {
    const view = buildTimelineView([
      beat({ id: "b1", zone: "testing", action: "test_run" }),
      beat({ id: "b2", zone: "reading", action: "read" }),
      beat({ id: "b3", zone: "coding", action: "edit" }),
      beat({ id: "b4", zone: "testing", action: "test_pass", severity: "success" }),
    ]);
    // reading before coding before testing (canonical order), only populated zones.
    expect(view.lanes.map((l) => l.zone)).toEqual(["reading", "coding", "testing"]);
    // the testing lane holds both its beats, in input order.
    const testing = view.lanes.find((l) => l.zone === "testing")!;
    expect(testing.beats.map((b) => b.id)).toEqual(["b1", "b4"]);
  });

  it("never emits a lane for an unpopulated zone", () => {
    const view = buildTimelineView([beat({ zone: "reading", action: "read" })]);
    expect(view.lanes).toHaveLength(1);
    expect(view.lanes[0].zone).toBe("reading");
  });

  it("ZONE_ORDER covers every zone a beat can carry (no beat would be laneless)", () => {
    // Build one beat per zone; every one must land in a lane.
    const beats = ZONE_ORDER.map((zone, i) => beat({ id: `z${i}`, zone }));
    const view = buildTimelineView(beats);
    expect(view.lanes).toHaveLength(ZONE_ORDER.length);
  });
});

describe("buildTimelineView — selection / drill-down", () => {
  it("a selected beat exposes its literal eventIds and counts", () => {
    const beats = [
      beat({ id: "beat_0000", eventCount: 10, signalCount: 5, eventIds: ["e0", "e1", "e2"] }),
    ];
    const view = buildTimelineView(beats, "beat_0000");
    expect(view.selected).not.toBeNull();
    expect(view.selected!.eventIds).toEqual(["e0", "e1", "e2"]);
    expect(view.selected!.eventCount).toBe(10);
    expect(view.selected!.signalCount).toBe(5);
  });

  it("an unknown selectedId yields no selection", () => {
    const view = buildTimelineView([beat({ id: "beat_0000" })], "nope");
    expect(view.selected).toBeNull();
  });

  it("no selection → selected is null", () => {
    expect(buildTimelineView([beat({})]).selected).toBeNull();
  });
});

describe("buildTimelineView — privacy by construction (end-to-end through the reducer)", () => {
  it("secrets in source events never reach the rendered view model", () => {
    const secret = "API_KEY=sk-supersecret-1234 ./deploy.sh prod --token=abc123";
    const events: WorkflowEvent[] = [
      status("coding"),
      message(secret), // a Bash-command-like message attaches as detail
      status("testing"),
      prArtifact(),
    ];
    const beats = reduceObservedPlayback(events);
    const view = buildTimelineView(beats, beats[0]?.id);

    // The ENTIRE serialized view model must not contain any secret fragment.
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("sk-supersecret");
    expect(serialized).not.toContain("API_KEY");
    expect(serialized).not.toContain("deploy.sh");
    expect(serialized).not.toContain("token=abc123");

    // It DOES still carry the literal event id for drill-down (the id, not content).
    expect(view.selected!.eventIds.length).toBeGreaterThan(0);
  });

  it("labels in the view are the content-free reducer labels", () => {
    const events = [status("coding"), status("coding"), message("internal detail")];
    const view = buildTimelineView(reduceObservedPlayback(events));
    const labels = view.sequence.map((b) => b.label);
    expect(labels).toContain("editing intensely (2 edits)");
    expect(JSON.stringify(view)).not.toContain("internal detail");
  });
});

describe("buildTimelineView — runs on real mapper output", () => {
  it("reduces + builds a view for the observed-sample scenario", async () => {
    const { SCENARIOS } = await import("@/data/scenarios");
    const beats = reduceObservedPlayback(SCENARIOS["observed-sample"].events);
    const view = buildTimelineView(beats);
    expect(view.summary.beatCount).toBe(beats.length);
    expect(view.lanes.length).toBeGreaterThan(0);
    // Every lane's zone is a real ObservedZone in canonical order.
    const zonesSeen = view.lanes.map((l) => l.zone);
    const canonicalIdx = zonesSeen.map((z) => ZONE_ORDER.indexOf(z));
    expect(canonicalIdx).toEqual([...canonicalIdx].sort((a, b) => a - b));
  });
});
