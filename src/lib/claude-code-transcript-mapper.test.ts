import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  parseRawTranscript,
  validateRawTranscript,
} from "./claude-code-transcript";
import { mapTranscriptToSession } from "./claude-code-transcript-mapper";
import { parseClaudeCodeTranscript } from "./claude-code-parser";
import type { Artifact, WorkItem } from "@/types/work-items";
import type { QualityGate } from "@/types/governance";
import type { RawTranscriptLine } from "@/types/claude-code-transcript";

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/claude-code-transcript-sample.jsonl",
);

const fixtureJsonl = () => readFileSync(FIXTURE_PATH, "utf8");

// ─── Helpers for hand-rolled mini-transcripts ────────────────────────────────

const SID = "test-session";
const T0 = "2026-05-27T15:00:00.000Z";

function userPrompt(text: string, uuid = "u-0001", ts = T0): RawTranscriptLine {
  return {
    type: "user",
    uuid,
    parentUuid: null,
    sessionId: SID,
    timestamp: ts,
    message: { role: "user", content: text },
  };
}

function assistantText(text: string, ts = T0): RawTranscriptLine {
  return {
    type: "assistant",
    sessionId: SID,
    timestamp: ts,
    message: {
      role: "assistant",
      content: [{ type: "text", text }],
    },
  };
}

function assistantToolUse(name: string, input: Record<string, unknown>, id = "tu-1", ts = T0): RawTranscriptLine {
  return {
    type: "assistant",
    sessionId: SID,
    timestamp: ts,
    message: {
      role: "assistant",
      content: [{ type: "tool_use", id, name, input }],
    },
  };
}

function toolResult(toolUseId: string, content: string, isError = false, ts = T0): RawTranscriptLine {
  return {
    type: "user",
    sessionId: SID,
    timestamp: ts,
    message: {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUseId, content, is_error: isError }],
    },
  };
}

function systemInit(ts = T0): RawTranscriptLine {
  return {
    type: "system",
    subtype: "init",
    sessionId: SID,
    timestamp: ts,
  };
}

describe("mapTranscriptToSession — synthetic fixture", () => {
  it("parseClaudeCodeTranscript returns a complete session for the synthetic fixture", () => {
    const session = parseClaudeCodeTranscript(fixtureJsonl());
    expect(session.origin.sessionId).toBe("sample-session-0000");
    expect(session.workItem.id).toMatch(/^wi_observed_/);
    expect(session.chain).toEqual(["mira"]);
    expect(session.events.length).toBeGreaterThan(0);
  });

  it("mapper output for the fixture passes validateScenario as an observed scenario", async () => {
    const { validateScenario } = await import("./validate-scenario");
    const session = parseClaudeCodeTranscript(fixtureJsonl());
    const scenario = {
      id: "test-observed" as const,
      title: "Test observed",
      subtitle: "from mapper",
      kind: session.workItem.kind,
      source: "observed" as const,
      initialWorkItem: session.workItem,
      events: session.events,
      chain: session.chain,
      origin: session.origin,
    };
    const issues = validateScenario(scenario as never);
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });
});

describe("mapTranscriptToSession — per-event mapping", () => {
  it("emits run.started, work_item.created/owner/mode for a string user prompt", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("Refactor the button"),
    ]);
    const types = session.events.map((e) => e.type);
    expect(types[0]).toBe("run.started");
    expect(types).toContain("work_item.created");
    expect(types).toContain("work_item.owner.changed");
    expect(types).toContain("work_item.mode.changed");

    const owner = session.events.find((e) => e.type === "work_item.owner.changed");
    expect((owner!.payload as { to: string }).to).toBe("mira");

    const mode = session.events.find((e) => e.type === "work_item.mode.changed");
    expect((mode!.payload as { to: string }).to).toBe("Generate");

    expect(session.workItem.title).toContain("Refactor the button");
  });

  it("assistant text → agent.message.sent", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantText("Working on it."),
    ]);
    const messages = session.events.filter((e) => e.type === "agent.message.sent");
    const texts = messages.map((m) => (m.payload as { message: string }).message);
    expect(texts).toContain("Working on it.");
  });

  it("Read tool_use → agent.status.changed → reading", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantToolUse("Read", { file_path: "/tmp/x.ts" }, "r-1"),
    ]);
    const status = session.events
      .filter((e) => e.type === "agent.status.changed")
      .map((e) => (e.payload as { to: string }).to);
    expect(status).toContain("reading");
  });

  it("Edit tool_use → coding + artifact.produced", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantToolUse("Edit", { file_path: "/tmp/Button.tsx", old_string: "a", new_string: "b" }, "e-1"),
    ]);
    const status = session.events
      .filter((e) => e.type === "agent.status.changed")
      .map((e) => (e.payload as { to: string }).to);
    expect(status).toContain("coding");

    const artifacts = session.events.filter((e) => e.type === "artifact.produced");
    expect(artifacts).toHaveLength(1);
    const art = (artifacts[0].payload as { artifact: Artifact }).artifact;
    expect(art.kind).toBe("code_pr");
    expect(art.ref).toContain("Button.tsx");
    expect(art.producedBy).toBe("mira");
    expect(session.workItem.artifactIds).toContain(art.id);
  });

  it("Write and MultiEdit also produce artifacts", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantToolUse("Write", { file_path: "/tmp/new.ts" }, "w-1"),
      assistantToolUse("MultiEdit", { file_path: "/tmp/multi.ts", edits: [] }, "m-1"),
    ]);
    const artifacts = session.events.filter((e) => e.type === "artifact.produced");
    expect(artifacts).toHaveLength(2);
  });

  it("Bash with test command → testing status + message; success result → quality_gate.passed", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantToolUse("Bash", { command: "pnpm test" }, "b-1"),
      toolResult("b-1", "All 73 tests passed"),
    ]);

    const status = session.events
      .filter((e) => e.type === "agent.status.changed")
      .map((e) => (e.payload as { to: string }).to);
    expect(status).toContain("testing");

    const passed = session.events.filter((e) => e.type === "quality_gate.passed");
    expect(passed).toHaveLength(1);
    const gate = (passed[0].payload as { gate: QualityGate }).gate;
    expect(gate.status).toBe("passed");
    expect(session.workItem.qualityGateIds).toContain(gate.id);
  });

  it("Bash with non-test command stays neutral (no testing status)", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantToolUse("Bash", { command: "ls -la" }, "b-1"),
      toolResult("b-1", "file1 file2"),
    ]);
    const status = session.events
      .filter((e) => e.type === "agent.status.changed")
      .map((e) => (e.payload as { to: string }).to);
    expect(status).not.toContain("testing");
    expect(session.events.find((e) => e.type === "quality_gate.passed")).toBeUndefined();
  });

  it("tool_result with is_error=true → quality_gate.failed + failed status", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantToolUse("Bash", { command: "pnpm test" }, "b-1"),
      toolResult("b-1", "FAIL src/x.test.ts > test name", true),
    ]);

    const status = session.events
      .filter((e) => e.type === "agent.status.changed")
      .map((e) => (e.payload as { to: string }).to);
    expect(status).toContain("failed");

    const failed = session.events.filter((e) => e.type === "quality_gate.failed");
    expect(failed).toHaveLength(1);
    expect((failed[0].payload as { gate: QualityGate }).gate.status).toBe("failed");
  });

  it("thinking blocks are ignored — no agent.message.sent for them", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      {
        type: "assistant",
        sessionId: SID,
        timestamp: T0,
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "this should never reach the UI" },
            { type: "text", text: "visible" },
          ],
        },
      } as RawTranscriptLine,
    ]);
    const messages = session.events
      .filter((e) => e.type === "agent.message.sent")
      .map((e) => (e.payload as { message: string }).message);
    expect(messages.some((m) => m.includes("never reach the UI"))).toBe(false);
    expect(messages).toContain("visible");
  });

  it("run.completed and work_item.completed are emitted at the end", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantText("done"),
    ]);
    const last = session.events[session.events.length - 1];
    expect(last.type).toBe("run.completed");
    expect(session.events.some((e) => e.type === "work_item.completed")).toBe(true);
  });

  it("origin is seeded from the system init line", () => {
    const session = mapTranscriptToSession([systemInit(), userPrompt("hello")]);
    expect(session.origin.source).toBe("claude-code-local");
    expect(session.origin.sessionId).toBe(SID);
    expect(session.origin.capturedAt).toBe(T0);
  });

  it("workItem.id is derived from the session id", () => {
    const session = mapTranscriptToSession([systemInit(), userPrompt("hello")]);
    expect(session.workItem.id).toBe(`wi_observed_${SID}`);
  });

  it("chain defaults to [mira]", () => {
    const session = mapTranscriptToSession([systemInit(), userPrompt("hello")]);
    expect(session.chain).toEqual(["mira"]);
  });

  it("an empty transcript produces a session with just run.started and run.completed", () => {
    const session = mapTranscriptToSession([]);
    const types = session.events.map((e) => e.type);
    expect(types).toEqual(["run.started", "run.completed"]);
    expect(session.workItem.title).toBe("Observed Claude Code session");
  });
});

describe("parseClaudeCodeTranscript — validation errors fail loudly", () => {
  it("throws when the transcript has shape issues", () => {
    const badJsonl =
      JSON.stringify({ type: "system" }) + "\n" +
      JSON.stringify({ type: "user" }) + "\n"; // missing message
    expect(() => parseClaudeCodeTranscript(badJsonl)).toThrow(/validation issue/);
  });

  it("throws on malformed JSON before mapping", () => {
    const corruptJsonl = "this is not json";
    expect(() => parseClaudeCodeTranscript(corruptJsonl)).toThrow(/parse error/);
  });

  it("does not produce a partial session when validation fails", () => {
    const badJsonl = JSON.stringify({ type: "completely_unknown_type" });
    expect(() => parseClaudeCodeTranscript(badJsonl)).toThrow();
  });
});

describe("mapper output structure", () => {
  it("the work item passes structural checks on every field", () => {
    const session = mapTranscriptToSession([systemInit(), userPrompt("hello")]);
    const wi: WorkItem = session.workItem;
    expect(typeof wi.id).toBe("string");
    expect(typeof wi.title).toBe("string");
    expect(Array.isArray(wi.assignedAgentIds)).toBe(true);
    expect(Array.isArray(wi.artifactIds)).toBe(true);
    expect(Array.isArray(wi.qualityGateIds)).toBe(true);
    expect(Array.isArray(wi.modeHistory)).toBe(true);
    expect(Array.isArray(wi.acceptance)).toBe(true);
    expect(Array.isArray(wi.outOfScope)).toBe(true);
    expect(typeof wi.humanDecisionNeeded).toBe("boolean");
  });

  it("events are emitted in chronological order (timestamps non-decreasing)", () => {
    const session = parseClaudeCodeTranscript(fixtureJsonl());
    let last = "";
    for (const e of session.events) {
      expect(e.ts >= last).toBe(true);
      last = e.ts;
    }
  });

  it("no decision.requested or approval.requested events leak into observed mode", () => {
    const session = parseClaudeCodeTranscript(fixtureJsonl());
    const types = new Set(session.events.map((e) => e.type));
    expect(types.has("decision.requested")).toBe(false);
    expect(types.has("approval.requested")).toBe(false);
  });
});

describe("validateRawTranscript runs cleanly on parsed fixture", () => {
  // Sanity: confirms the mapper isn't masking validator misses.
  it("synthetic fixture validates clean before mapping", () => {
    const lines = parseRawTranscript(fixtureJsonl());
    expect(validateRawTranscript(lines)).toEqual([]);
  });
});
