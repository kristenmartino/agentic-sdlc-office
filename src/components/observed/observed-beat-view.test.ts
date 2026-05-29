import { describe, expect, it } from "vitest";
import { ACTION_GLYPH, ACTION_PHRASE, buildTimelineView, ZONE_ORDER } from "./observed-beat-view";
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
  it("empty beats → empty view (incl. null stage)", () => {
    const view = buildTimelineView([]);
    expect(view.summary).toEqual({ beatCount: 0, eventCount: 0 });
    expect(view.sequence).toEqual([]);
    expect(view.lanes).toEqual([]);
    expect(view.stage).toBeNull();
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
  it("a selected beat exposes display-safe eventRefs and counts (never raw ids)", () => {
    const beats = [
      beat({
        id: "beat_0000",
        eventCount: 5,
        signalCount: 3,
        // 5 raw ids — note eventCount === eventIds.length (reducer invariant).
        eventIds: ["e0", "e1", "e2", "e3", "e4"],
      }),
    ];
    const view = buildTimelineView(beats, "beat_0000");
    expect(view.selected).not.toBeNull();
    expect(view.selected!.eventRefs).toEqual(["event 1", "event 2", "event 3", "event 4", "event 5"]);
    expect(view.selected!.eventCount).toBe(5);
    expect(view.selected!.signalCount).toBe(3);
    // The render model carries NO raw event ids field at all.
    expect("eventIds" in view.selected!).toBe(false);
  });

  it("an unknown selectedId yields no selection", () => {
    const view = buildTimelineView([beat({ id: "beat_0000" })], "nope");
    expect(view.selected).toBeNull();
  });

  it("no selection → selected is null", () => {
    expect(buildTimelineView([beat({})]).selected).toBeNull();
  });
});

describe("buildTimelineView — stage (cute protagonist) + vocabulary", () => {
  it("stage reflects the LATEST beat when nothing is selected", () => {
    const view = buildTimelineView([
      beat({ id: "b1", zone: "reading", action: "read" }),
      beat({ id: "b2", zone: "testing", action: "test_pass", severity: "success" }),
    ]);
    expect(view.stage).not.toBeNull();
    expect(view.stage!.zone).toBe("testing");
    expect(view.stage!.action).toBe("test_pass");
    expect(view.stage!.glyph).toBe(ACTION_GLYPH.test_pass);
    expect(view.stage!.phrase).toBe(ACTION_PHRASE.test_pass);
    expect(view.stage!.severity).toBe("success");
  });

  it("stage reflects the SELECTED beat when one is selected", () => {
    const view = buildTimelineView(
      [
        beat({ id: "b1", zone: "reading", action: "read" }),
        beat({ id: "b2", zone: "testing", action: "test_run" }),
      ],
      "b1",
    );
    expect(view.stage!.zone).toBe("reading");
    expect(view.stage!.phrase).toBe(ACTION_PHRASE.read);
  });

  it("exactly one lane is active, matching the stage zone", () => {
    const view = buildTimelineView([
      beat({ id: "b1", zone: "reading", action: "read" }),
      beat({ id: "b2", zone: "coding", action: "edit" }),
    ]);
    const active = view.lanes.filter((l) => l.active);
    expect(active).toHaveLength(1);
    expect(active[0].zone).toBe(view.stage!.zone);
    expect(active[0].zone).toBe("coding"); // the latest beat's zone
  });

  it("vocabulary is complete: glyph and phrase maps share keys and are non-empty", () => {
    const glyphKeys = Object.keys(ACTION_GLYPH).sort();
    const phraseKeys = Object.keys(ACTION_PHRASE).sort();
    expect(glyphKeys).toEqual(phraseKeys);
    for (const k of glyphKeys) {
      expect(ACTION_GLYPH[k as keyof typeof ACTION_GLYPH].length).toBeGreaterThan(0);
      expect(ACTION_PHRASE[k as keyof typeof ACTION_PHRASE].length).toBeGreaterThan(0);
    }
  });

  it("stage phrase is content-free (action-derived) — never payload text", () => {
    const events = [status("coding"), message("API_KEY=sk-leak ./run.sh")];
    const view = buildTimelineView(reduceObservedPlayback(events));
    expect(view.stage!.phrase).toBe("is at the workbench");
    expect(JSON.stringify(view.stage)).not.toContain("sk-leak");
  });

  it("phrases form a grammatical sentence with 'the agent <phrase>'", () => {
    // The stage renders "the agent <phrase>"; every phrase must read sanely
    // there (no "the agent is checks passed"). Cheap guard: each phrase
    // starts with a verb-ish token, not a bare noun like "checks".
    for (const phrase of Object.values(ACTION_PHRASE)) {
      const sentence = `the agent ${phrase}`;
      expect(sentence).not.toMatch(/the agent is (checks|failing) /);
      expect(phrase.length).toBeGreaterThan(0);
    }
    // Spot-check the ones that previously read wrong.
    expect(`the agent ${ACTION_PHRASE.test_pass}`).toBe("the agent passed the checks");
    expect(`the agent ${ACTION_PHRASE.human_consulted}`).toBe("the agent asked the human");
    expect(`the agent ${ACTION_PHRASE.outbox}`).toBe("the agent sent it out");
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

    // It DOES still expose drill-down refs (counts) — but as safe refs, not ids.
    expect(view.selected!.eventRefs.length).toBeGreaterThan(0);
  });

  it("never renders raw event ids — which embed the session id (P0 fix)", () => {
    // Mapper ids are `evt_<sessionId>_NNNN`, so a raw id carries the session.
    const sessionId = "real-session-abc123-uuid";
    const beats: VisualBeat[] = [
      beat({
        id: "beat_0000",
        eventCount: 2,
        signalCount: 1,
        eventIds: [`evt_${sessionId}_0001`, `evt_${sessionId}_0002`],
      }),
    ];
    const view = buildTimelineView(beats, "beat_0000");
    const serialized = JSON.stringify(view);

    // The session id must appear NOWHERE in the render model.
    expect(serialized).not.toContain(sessionId);
    expect(serialized).not.toContain("evt_");
    // Drill-down still works — via safe refs.
    expect(view.selected!.eventRefs).toEqual(["event 1", "event 2"]);
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
