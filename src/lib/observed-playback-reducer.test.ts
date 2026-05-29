import { describe, expect, it } from "vitest";
import { reduceObservedPlayback, type VisualBeat } from "./observed-playback-reducer";
import type { WorkflowEvent } from "@/types/workflow-events";
import type { AgentStatus } from "@/types/agents";

// ─── Synthetic event builders (no real session, no privacy exposure) ─────────

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
const editArtifact = () =>
  ev("artifact.produced", { artifact: { id: "a1", kind: "code_pr_NOPE_use_other", ref: "x" } });
const codeEdit = () => ev("artifact.produced", { artifact: { kind: "review_report" } }); // non-PR → attach
const prArtifact = () => ev("artifact.produced", { artifact: { kind: "code_pr", ref: "https://…/pull/1" } });
const gatePass = () => ev("quality_gate.passed", { gate: { id: "g1", status: "passed" } });
const gateFail = () => ev("quality_gate.failed", { gate: { id: "g2", status: "failed" } });
const blocker = () => ev("blocker.raised", { blocker: { id: "b1" } });
const runStarted = () => ev("run.started", {});
const runCompleted = () => ev("run.completed", {});

const actions = (beats: VisualBeat[]) => beats.map((b) => b.action);
const zones = (beats: VisualBeat[]) => beats.map((b) => b.zone);

describe("reduceObservedPlayback — basics", () => {
  it("returns [] for an empty stream", () => {
    expect(reduceObservedPlayback([])).toEqual([]);
  });

  it("returns [] for an activity-free (lifecycle-only) stream", () => {
    expect(reduceObservedPlayback([runStarted(), runCompleted()])).toEqual([]);
  });

  it("maps the four already-emitted statuses to the right zones/actions", () => {
    const beats = reduceObservedPlayback([
      status("reading"),
      status("coding"),
      status("testing"),
    ]);
    expect(zones(beats)).toEqual(["reading", "coding", "testing"]);
    expect(actions(beats)).toEqual(["read", "edit", "test_run"]);
  });

  it("maps thinking and waiting_on_human (the mapper-addition statuses) when present", () => {
    const beats = reduceObservedPlayback([status("thinking"), status("waiting_on_human")]);
    expect(zones(beats)).toEqual(["thinking", "human"]);
    // waiting_on_human is relabeled to the past-tense human_consulted action.
    expect(actions(beats)).toEqual(["think", "human_consulted"]);
    expect(beats[1].label).toBe("human consulted");
  });

  it("skips dormant statuses (planning/designing/reviewing/idle/done)", () => {
    const beats = reduceObservedPlayback([
      status("planning"),
      status("designing"),
      status("reviewing"),
      status("idle"),
      status("done"),
    ]);
    expect(beats).toEqual([]);
  });
});

describe("reduceObservedPlayback — coalescing (the dense-stream collapse)", () => {
  it("collapses a run of same-action events into ONE beat with the full count", () => {
    const beats = reduceObservedPlayback([
      status("coding"),
      status("coding"),
      status("coding"),
      status("coding"),
    ]);
    expect(beats).toHaveLength(1);
    expect(beats[0].action).toBe("edit");
    expect(beats[0].eventCount).toBe(4);
    expect(beats[0].label).toBe("editing intensely (4 edits)");
  });

  it("a single read reads as 'reading'; many reads aggregate", () => {
    expect(reduceObservedPlayback([status("reading")])[0].label).toBe("reading");
    const many = reduceObservedPlayback([status("reading"), status("reading"), status("reading")]);
    expect(many).toHaveLength(1);
    expect(many[0].label).toBe("read 3 files");
  });

  it("edit→test→edit produces three distinct beats (action changes break coalescing)", () => {
    const beats = reduceObservedPlayback([
      status("coding"),
      status("testing"),
      status("coding"),
    ]);
    expect(actions(beats)).toEqual(["edit", "test_run", "edit"]);
  });

  it("agent.message.sent attaches to the current beat (no zone hop, count bumps)", () => {
    const beats = reduceObservedPlayback([
      status("coding"),
      message("did a thing"),
      message("did another thing"),
    ]);
    expect(beats).toHaveLength(1);
    expect(beats[0].action).toBe("edit");
    expect(beats[0].eventCount).toBe(3); // status + 2 messages
  });

  it("a leading message with no open beat is dropped from beats (stays in raw log)", () => {
    const beats = reduceObservedPlayback([message("orphan"), status("coding")]);
    expect(beats).toHaveLength(1);
    expect(beats[0].eventCount).toBe(1); // only the coding status; the orphan message is not folded
  });

  it("non-PR artifacts attach to the current coding beat; a PR artifact is its own outbox beat", () => {
    const beats = reduceObservedPlayback([
      status("coding"),
      codeEdit(), // review_report artifact → attach
      prArtifact(), // code_pr → outbox beat
    ]);
    expect(actions(beats)).toEqual(["edit", "outbox"]);
    expect(beats[0].eventCount).toBe(2); // coding status + attached artifact
    expect(beats[1].label).toBe("opened a PR");
  });
});

describe("reduceObservedPlayback — quality gates and failures", () => {
  it("quality_gate.passed → a success test_pass beat", () => {
    const beats = reduceObservedPlayback([status("testing"), gatePass()]);
    expect(actions(beats)).toEqual(["test_run", "test_pass"]);
    expect(beats[1].severity).toBe("success");
    expect(beats[1].label).toBe("tests passed");
  });

  it("quality_gate.failed → an error test_fail beat", () => {
    const beats = reduceObservedPlayback([status("testing"), gateFail()]);
    expect(actions(beats)).toEqual(["test_run", "test_fail"]);
    expect(beats[1].severity).toBe("error");
  });

  it("a failed status keeps the current zone but marks the beat as an error 'blocked'", () => {
    const beats = reduceObservedPlayback([status("coding"), status("failed")]);
    expect(beats[1].zone).toBe("coding"); // stayed in the current zone
    expect(beats[1].action).toBe("blocked");
    expect(beats[1].severity).toBe("error");
  });

  it("blocker.raised → an error blocked beat in the current zone", () => {
    const beats = reduceObservedPlayback([status("reading"), blocker()]);
    expect(beats[1].zone).toBe("reading");
    expect(beats[1].action).toBe("blocked");
    expect(beats[1].severity).toBe("error");
  });
});

describe("reduceObservedPlayback — preserve-truth invariant", () => {
  it("every activity event id lands in exactly one beat; eventCount === eventIds.length", () => {
    const events = [
      runStarted(),
      status("reading"),
      status("reading"),
      message("note"),
      status("coding"),
      codeEdit(),
      status("testing"),
      gatePass(),
      prArtifact(),
      runCompleted(),
    ];
    const beats = reduceObservedPlayback(events);

    // Count integrity per beat.
    for (const b of beats) {
      expect(b.eventCount).toBe(b.eventIds.length);
    }

    // No event id appears in two beats.
    const allIds = beats.flatMap((b) => b.eventIds);
    expect(new Set(allIds).size).toBe(allIds.length);

    // Every NON-lifecycle event id is captured by some beat (nothing lost from
    // drill-down). Lifecycle events (run.*) are intentionally not in beats.
    const lifecycle = new Set(["run.started", "run.completed"]);
    const activityIds = events.filter((e) => !lifecycle.has(e.type)).map((e) => e.id);
    for (const id of activityIds) {
      expect(allIds).toContain(id);
    }
  });

  it("ids are deterministic and stable (beat_0000, beat_0001, …)", () => {
    const beats = reduceObservedPlayback([status("reading"), status("coding")]);
    expect(beats.map((b) => b.id)).toEqual(["beat_0000", "beat_0001"]);
  });
});

describe("reduceObservedPlayback — privacy by construction", () => {
  it("a beat label never contains the raw message/command text", () => {
    const secret = "API_KEY=sk-supersecret-1234 ./deploy.sh prod";
    const beats = reduceObservedPlayback([status("coding"), message(secret)]);
    expect(beats).toHaveLength(1);
    expect(beats[0].label).not.toContain("sk-supersecret");
    expect(beats[0].label).not.toContain("API_KEY");
    expect(beats[0].label).not.toContain("deploy");
    // The label is generated from action + count only — the attached message
    // bumps the count (to 2) but contributes zero content.
    expect(beats[0].label).toBe("editing intensely (2 edits)");
  });
});

describe("reduceObservedPlayback — dense session collapses (the make-or-break)", () => {
  // A realistic dense edit→test loop: 40 raw activity events.
  function denseSession(): WorkflowEvent[] {
    const out: WorkflowEvent[] = [runStarted(), status("reading")];
    // 4 rounds of: 5 edits, a test run, a pass; with chatter messages.
    for (let round = 0; round < 4; round++) {
      for (let e = 0; e < 5; e++) {
        out.push(status("coding"));
        out.push(message("edit detail"));
      }
      out.push(status("testing"));
      out.push(round === 1 ? gateFail() : gatePass());
    }
    out.push(prArtifact());
    out.push(runCompleted());
    return out;
  }

  it("turns a dense stream into dramatically fewer beats without losing events", () => {
    const events = denseSession();
    const beats = reduceObservedPlayback(events);

    // The whole point: far fewer beats than raw events.
    expect(events.length).toBeGreaterThan(40);
    expect(beats.length).toBeLessThan(events.length / 3);

    // And it's still truthful: every edit is accounted for in the counts.
    const totalFolded = beats.reduce((n, b) => n + b.eventCount, 0);
    const lifecycle = new Set(["run.started", "run.completed"]);
    const activityCount = events.filter((e) => !lifecycle.has(e.type)).length;
    expect(totalFolded).toBe(activityCount);

    // The shape reads sensibly: reading, then alternating edit/test beats,
    // ending in an outbox beat.
    expect(beats[0].action).toBe("read");
    expect(beats[beats.length - 1].action).toBe("outbox");
    expect(actions(beats)).toContain("test_pass");
    expect(actions(beats)).toContain("test_fail");
  });

  it("each coding beat aggregates its 5 edits + 5 chatter messages into one beat of count 10", () => {
    const beats = reduceObservedPlayback(denseSession());
    const codingBeats = beats.filter((b) => b.action === "edit");
    expect(codingBeats).toHaveLength(4); // one per round
    for (const b of codingBeats) {
      expect(b.eventCount).toBe(10); // 5 status("coding") + 5 attached messages
      expect(b.label).toBe("editing intensely (10 edits)");
    }
  });
});

describe("reduceObservedPlayback — runs on real mapper output", () => {
  it("reduces the observed-sample scenario's events without error", async () => {
    const { SCENARIOS } = await import("@/data/scenarios");
    const beats = reduceObservedPlayback(SCENARIOS["observed-sample"].events);
    expect(Array.isArray(beats)).toBe(true);
    // Sanity: fewer beats than events, every beat has a content-free label.
    expect(beats.length).toBeLessThanOrEqual(SCENARIOS["observed-sample"].events.length);
    for (const b of beats) {
      expect(b.label.length).toBeGreaterThan(0);
      expect(b.eventCount).toBe(b.eventIds.length);
    }
  });
});
