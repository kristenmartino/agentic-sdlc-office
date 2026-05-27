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

  it("Edit tool_use → coding status immediately; artifact.produced emits when the result lands", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantToolUse("Edit", { file_path: "/tmp/Button.tsx", old_string: "a", new_string: "b" }, "e-1"),
      toolResult("e-1", "Edit successful"),
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

  it("Edit tool_use without a tool_result → no artifact (edit didn't apply)", () => {
    // Artifact emission happens at tool_result time, so an unmatched
    // or interrupted Edit doesn't leak a phantom artifact.
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantToolUse("Edit", { file_path: "/tmp/Button.tsx" }, "e-1"),
    ]);
    const artifacts = session.events.filter((e) => e.type === "artifact.produced");
    expect(artifacts).toHaveLength(0);
    // Status still flips to coding — the model was *intending* to edit.
    const status = session.events
      .filter((e) => e.type === "agent.status.changed")
      .map((e) => (e.payload as { to: string }).to);
    expect(status).toContain("coding");
  });

  it("Write and MultiEdit also produce artifacts once their tool_results arrive", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantToolUse("Write", { file_path: "/tmp/new.ts" }, "w-1"),
      toolResult("w-1", "Wrote /tmp/new.ts"),
      assistantToolUse("MultiEdit", { file_path: "/tmp/multi.ts", edits: [] }, "m-1"),
      toolResult("m-1", "Edits applied"),
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

describe("mapper — toolUseResult consumption", () => {
  function toolResultWithStructured(
    toolUseId: string,
    content: string,
    structured: Record<string, unknown>,
    isError = false,
    ts = T0,
  ): RawTranscriptLine {
    return {
      type: "user",
      sessionId: SID,
      timestamp: ts,
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolUseId, content, is_error: isError }],
      },
      toolUseResult: structured,
    } as RawTranscriptLine;
  }

  it("Edit uses toolUseResult.filePath as the artifact ref (preferring over tool_use input)", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("refactor"),
      // Input says one path, toolUseResult confirms another (rare in
      // practice but the result is authoritative).
      assistantToolUse("Edit", { file_path: "/tmp/Button.tsx" }, "e-1"),
      toolResultWithStructured("e-1", "ok", {
        filePath: "/Users/example/repo/src/Button.tsx",
        structuredPatch: [{}, {}, {}],
      }),
    ]);
    const artifact = (session.events.find((e) => e.type === "artifact.produced")
      ?.payload as { artifact: Artifact }).artifact;
    expect(artifact.ref).toBe("/Users/example/repo/src/Button.tsx");
    expect(artifact.summary).toContain("3 hunks");
  });

  it("Edit summary notes replaceAll when toolUseResult.replaceAll is true", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("refactor"),
      assistantToolUse("Edit", { file_path: "/tmp/x.ts" }, "e-1"),
      toolResultWithStructured("e-1", "ok", {
        filePath: "/tmp/x.ts",
        replaceAll: true,
      }),
    ]);
    const artifact = (session.events.find((e) => e.type === "artifact.produced")
      ?.payload as { artifact: Artifact }).artifact;
    expect(artifact.summary).toContain("replaceAll");
  });

  it("Bash interrupted: true → quality_gate.failed even without is_error", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantToolUse("Bash", { command: "pnpm test" }, "b-1"),
      toolResultWithStructured("b-1", "", {
        stdout: "",
        stderr: "",
        interrupted: true,
      }),
    ]);
    const failed = session.events.filter((e) => e.type === "quality_gate.failed");
    expect(failed).toHaveLength(1);
    expect((failed[0].payload as { gate: QualityGate }).gate.notes).toContain("Interrupted");
  });

  it("Bash stderr with failure language → quality_gate.failed even without is_error", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantToolUse("Bash", { command: "pnpm test" }, "b-1"),
      toolResultWithStructured("b-1", "see stderr", {
        stdout: "",
        stderr: "Error: Test failed at line 12",
      }),
    ]);
    const failed = session.events.filter((e) => e.type === "quality_gate.failed");
    expect(failed).toHaveLength(1);
    // Status flips to failed so the office UI shows the regression.
    const status = session.events
      .filter((e) => e.type === "agent.status.changed")
      .map((e) => (e.payload as { to: string }).to);
    expect(status).toContain("failed");
  });

  it("Bash stderr with benign warnings does NOT trigger quality_gate.failed", () => {
    // Conservative regex — only flips on hard-failure language. A warning
    // line with no error words should pass.
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantToolUse("Bash", { command: "pnpm test" }, "b-1"),
      toolResultWithStructured("b-1", "tests passed", {
        stdout: "all good",
        stderr: "warning: deprecated option ignored",
      }),
    ]);
    expect(session.events.find((e) => e.type === "quality_gate.failed")).toBeUndefined();
    expect(session.events.find((e) => e.type === "quality_gate.passed")).toBeDefined();
  });
});

describe("mapper — pr-link → artifact.produced", () => {
  it("a pr-link line emits artifact.produced with kind=code_pr", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("ship the fix"),
      {
        type: "pr-link",
        prNumber: 42,
        prUrl: "https://github.com/example/repo/pull/42",
        prRepository: "example/repo",
        sessionId: SID,
        timestamp: "2026-05-27T15:01:00.000Z",
      } as RawTranscriptLine,
    ]);
    const prArtifacts = session.events
      .filter((e) => e.type === "artifact.produced")
      .map((e) => (e.payload as { artifact: Artifact }).artifact)
      .filter((a) => a.ref.includes("pull/42"));
    expect(prArtifacts).toHaveLength(1);
    expect(prArtifacts[0].kind).toBe("code_pr");
    expect(prArtifacts[0].summary).toContain("#42");
    expect(prArtifacts[0].summary).toContain("example/repo");
  });

  it("pr-link without a seeded work item is silently skipped (no artifact)", () => {
    // No user prompt → workItem not seeded → no work item to attach to.
    const session = mapTranscriptToSession([
      systemInit(),
      {
        type: "pr-link",
        prNumber: 1,
        prUrl: "https://github.com/example/repo/pull/1",
        prRepository: "example/repo",
        sessionId: SID,
      } as RawTranscriptLine,
    ]);
    expect(session.events.find((e) => e.type === "artifact.produced")).toBeUndefined();
  });
});

describe("mapper — title hierarchy", () => {
  it("custom-title overrides the user prompt", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      { type: "custom-title", customTitle: "Refactor sprint", sessionId: SID } as RawTranscriptLine,
      userPrompt("Help me ship the redesign"),
    ]);
    expect(session.workItem.title).toBe("Refactor sprint");
  });

  it("user prompt wins over ai-title when no custom-title is set", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      { type: "ai-title", aiTitle: "Auto-generated title", sessionId: SID } as RawTranscriptLine,
      userPrompt("Real user-typed prompt"),
    ]);
    expect(session.workItem.title).toBe("Real user-typed prompt");
  });

  it("ai-title is the fallback when there's no user prompt or custom-title", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      { type: "ai-title", aiTitle: "Inferred topic", sessionId: SID } as RawTranscriptLine,
      assistantText("doing something"),
    ]);
    expect(session.workItem.title).toBe("Inferred topic");
    // Work item should still get seeded so the run is renderable.
    expect(session.events.find((e) => e.type === "work_item.created")).toBeDefined();
  });

  it("default placeholder remains when no title source is present", () => {
    const session = mapTranscriptToSession([systemInit(), assistantText("idle session")]);
    // Without any title anchor, workItem stays unseeded and uses the
    // default constructor placeholder.
    expect(session.workItem.title).toBe("Observed Claude Code session");
  });
});

describe("mapper — redaction in Bash failure notes", () => {
  function toolResultWithStructured(
    toolUseId: string,
    content: string,
    structured: Record<string, unknown>,
    isError = false,
  ): RawTranscriptLine {
    return {
      type: "user",
      sessionId: SID,
      timestamp: T0,
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolUseId, content, is_error: isError }],
      },
      toolUseResult: structured,
    } as RawTranscriptLine;
  }

  it("home paths in stderr are redacted from quality_gate.failed notes", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("ship"),
      assistantToolUse("Bash", { command: "pnpm test" }, "b-1"),
      toolResultWithStructured("b-1", "", {
        stderr: "Error: at /Users/realuser/repo/src/x.test.ts:12",
      }),
    ]);
    const failed = session.events.find((e) => e.type === "quality_gate.failed");
    expect(failed).toBeDefined();
    const notes = (failed!.payload as { gate: QualityGate }).gate.notes ?? "";
    expect(notes).toContain("/<HOME>/");
    expect(notes).not.toContain("realuser");
  });

  it("multi-line stderr collapses to first line + ellipsis", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("ship"),
      assistantToolUse("Bash", { command: "pnpm test" }, "b-1"),
      toolResultWithStructured("b-1", "", {
        stderr: "Error: line one\n  at file.ts:1\n  at file.ts:2",
      }),
    ]);
    const failed = session.events.find((e) => e.type === "quality_gate.failed");
    const notes = (failed!.payload as { gate: QualityGate }).gate.notes ?? "";
    expect(notes).not.toContain("at file.ts:1");
    expect(notes).not.toContain("at file.ts:2");
  });

  it("interrupted result uses a fixed safe label (no raw stderr at all)", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("ship"),
      assistantToolUse("Bash", { command: "pnpm test" }, "b-1"),
      toolResultWithStructured("b-1", "", {
        stderr: "some sensitive content with /Users/realuser/private/data",
        interrupted: true,
      }),
    ]);
    const failed = session.events.find((e) => e.type === "quality_gate.failed");
    const notes = (failed!.payload as { gate: QualityGate }).gate.notes ?? "";
    expect(notes).toBe("Interrupted before completion");
    expect(notes).not.toContain("realuser");
    expect(notes).not.toContain("private");
  });
});

describe("mapper — log-only visibility for high-signal tools", () => {
  it("MCP tools emit a single agent.message.sent summary (no raw input)", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("look up the page"),
      assistantToolUse(
        "mcp__Claude_in_Chrome__find",
        { selector: "secret-internal-id", url: "https://private.example.com" },
        "m-1",
      ),
    ]);
    const messages = session.events
      .filter((e) => e.type === "agent.message.sent")
      .map((e) => (e.payload as { message: string }).message);
    expect(messages).toContain("MCP action via Claude_in_Chrome");
    // Inputs must not be rendered.
    for (const m of messages) {
      expect(m).not.toContain("secret-internal-id");
      expect(m).not.toContain("private.example.com");
    }
  });

  it("AskUserQuestion stays log-only — never emits decision.requested", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("decide"),
      assistantToolUse(
        "AskUserQuestion",
        {
          question: "what should I do with this sensitive data?",
          options: ["redact", "expose", "delete"],
        },
        "q-1",
      ),
    ]);
    const types = session.events.map((e) => e.type);
    expect(types).not.toContain("decision.requested");
    expect(types).not.toContain("approval.requested");

    const messages = session.events
      .filter((e) => e.type === "agent.message.sent")
      .map((e) => (e.payload as { message: string }).message);
    expect(messages.some((m) => m.toLowerCase().includes("asked the human"))).toBe(true);
    // Don't render the question text or option labels.
    for (const m of messages) {
      expect(m).not.toContain("sensitive data");
      expect(m).not.toContain("redact");
      expect(m).not.toContain("expose");
    }
  });

  it("Task / TaskCreate / TaskUpdate emit one safe summary each, never raw payload", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("track tasks"),
      assistantToolUse("TaskCreate", { description: "internal milestone" }, "t-1"),
      assistantToolUse("TaskUpdate", { taskId: "abc", status: "in_progress" }, "t-2"),
    ]);
    const messages = session.events
      .filter((e) => e.type === "agent.message.sent")
      .map((e) => (e.payload as { message: string }).message);
    expect(messages.some((m) => m.includes("TaskCreate"))).toBe(true);
    expect(messages.some((m) => m.includes("TaskUpdate"))).toBe(true);
    // Payload content stays out of the messages.
    for (const m of messages) {
      expect(m).not.toContain("internal milestone");
      expect(m).not.toContain("in_progress");
    }
  });
});

describe("mapper — system subtypes (compact_boundary / api_error / stop_hook_summary)", () => {
  it("compact_boundary emits a marker agent.message.sent", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      { type: "system", subtype: "compact_boundary", sessionId: SID, timestamp: T0 } as RawTranscriptLine,
      assistantText("continuing"),
    ]);
    const messages = session.events
      .filter((e) => e.type === "agent.message.sent")
      .map((e) => (e.payload as { message: string }).message);
    expect(messages.some((m) => m.toLowerCase().includes("compacted"))).toBe(true);
  });

  it("api_error emits a blocker.raised with kind=external", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      { type: "system", subtype: "api_error", sessionId: SID, timestamp: T0 } as RawTranscriptLine,
    ]);
    const blockers = session.events.filter((e) => e.type === "blocker.raised");
    expect(blockers).toHaveLength(1);
    const blk = (blockers[0].payload as { blocker: { kind: string } }).blocker;
    expect(blk.kind).toBe("external");
  });

  it("stop_hook_summary with hookErrors emits a blocker.raised", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      {
        type: "system",
        subtype: "stop_hook_summary",
        sessionId: SID,
        timestamp: T0,
        hookCount: 2,
        hookErrors: ["lint failed", "tsc failed"],
        preventedContinuation: false,
      } as RawTranscriptLine,
    ]);
    const blockers = session.events.filter((e) => e.type === "blocker.raised");
    expect(blockers).toHaveLength(1);
  });

  it("stop_hook_summary with preventedContinuation maps to kind=gate_failed", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      {
        type: "system",
        subtype: "stop_hook_summary",
        sessionId: SID,
        timestamp: T0,
        hookCount: 1,
        hookErrors: [],
        preventedContinuation: true,
      } as RawTranscriptLine,
    ]);
    const blockers = session.events.filter((e) => e.type === "blocker.raised");
    expect(blockers).toHaveLength(1);
    const blk = (blockers[0].payload as { blocker: { kind: string } }).blocker;
    expect(blk.kind).toBe("gate_failed");
  });

  it("clean stop_hook_summary (no errors, no prevention) emits no event", () => {
    const session = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      {
        type: "system",
        subtype: "stop_hook_summary",
        sessionId: SID,
        timestamp: T0,
        hookCount: 3,
        hookErrors: [],
        preventedContinuation: false,
      } as RawTranscriptLine,
    ]);
    expect(session.events.find((e) => e.type === "blocker.raised")).toBeUndefined();
  });
});

describe("mapper — log-only line types from real transcripts", () => {
  // ai-title / custom-title are consumed by the seed phase (for title
  // fallback); pr-link emits an artifact.produced. The remaining four
  // (last-prompt, attachment, queue-operation) are log-only — they
  // must not produce any events beyond what an equivalent session
  // without them would produce.
  it("last-prompt / attachment / queue-operation produce no extra events", () => {
    const baseline = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      assistantText("done"),
    ]);

    const withLogOnly = mapTranscriptToSession([
      systemInit(),
      userPrompt("hello"),
      { type: "last-prompt", lastPrompt: "hello", leafUuid: "u-0001", sessionId: SID } as RawTranscriptLine,
      assistantText("done"),
      {
        type: "attachment",
        attachment: { name: "screenshot.png" },
        uuid: "u-att",
        sessionId: SID,
        timestamp: T0,
      } as RawTranscriptLine,
      { type: "queue-operation", operation: "model_swap", sessionId: SID } as RawTranscriptLine,
    ]);

    expect(withLogOnly.events.length).toBe(baseline.events.length);
  });
});

describe("validateRawTranscript runs cleanly on parsed fixture", () => {
  // Sanity: confirms the mapper isn't masking validator misses.
  it("synthetic fixture validates clean before mapping", () => {
    const lines = parseRawTranscript(fixtureJsonl());
    expect(validateRawTranscript(lines)).toEqual([]);
  });
});
