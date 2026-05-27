import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  parseRawTranscript,
  type RawAssistantMessage,
  type RawSummaryLine,
  type RawUserMessage,
  type ToolUseBlock,
} from "./claude-code-transcript";

const FIXTURE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data/claude-code-transcript-sample.jsonl",
);

function fixtureJsonl() {
  return readFileSync(FIXTURE_PATH, "utf8");
}

describe("parseRawTranscript", () => {
  it("skips empty lines (trailing newline is normal)", () => {
    const lines = parseRawTranscript("\n\n");
    expect(lines).toEqual([]);
  });

  it("parses each non-empty line as a JSON object", () => {
    const jsonl = '{"type":"system","subtype":"init"}\n{"type":"summary","summary":"x"}';
    const lines = parseRawTranscript(jsonl);
    expect(lines).toHaveLength(2);
    expect(lines[0].type).toBe("system");
    expect(lines[1].type).toBe("summary");
  });

  it("throws with a useful error pointing at the bad line", () => {
    const jsonl = '{"type":"system"}\nnot-json-here\n{"type":"summary"}';
    expect(() => parseRawTranscript(jsonl)).toThrow(/parse error at line 2/);
  });

  it("tolerates unknown fields without throwing", () => {
    const jsonl = '{"type":"system","weird_future_field":42,"another":"unknown"}';
    const lines = parseRawTranscript(jsonl);
    expect(lines).toHaveLength(1);
    // Field is preserved as-is (TS type allows extras on RawSystemMessage).
    expect((lines[0] as Record<string, unknown>).weird_future_field).toBe(42);
  });
});

describe("claude-code-transcript-sample.jsonl (synthetic fixture)", () => {
  it("parses cleanly", () => {
    const lines = parseRawTranscript(fixtureJsonl());
    expect(lines.length).toBeGreaterThan(0);
  });

  it("has a system init line, user prompts, assistant turns, and a summary", () => {
    const lines = parseRawTranscript(fixtureJsonl());
    expect(lines.some((l) => l.type === "system")).toBe(true);
    expect(lines.some((l) => l.type === "user")).toBe(true);
    expect(lines.some((l) => l.type === "assistant")).toBe(true);
    expect(lines.some((l) => l.type === "summary")).toBe(true);
  });

  it("first user message carries the work-item title as plain string content", () => {
    const lines = parseRawTranscript(fixtureJsonl());
    const firstUser = lines.find((l) => l.type === "user") as RawUserMessage;
    expect(firstUser).toBeDefined();
    expect(typeof firstUser.message.content).toBe("string");
    expect((firstUser.message.content as string).length).toBeGreaterThan(0);
  });

  it("assistant turns embed tool_use blocks the parser will map to artifacts/messages", () => {
    const lines = parseRawTranscript(fixtureJsonl());
    const assistants = lines.filter((l) => l.type === "assistant") as RawAssistantMessage[];
    const toolUses = assistants
      .flatMap((a) => a.message.content)
      .filter((b): b is ToolUseBlock => b.type === "tool_use");
    expect(toolUses.length).toBeGreaterThan(0);
    expect(toolUses.map((t) => t.name)).toEqual(expect.arrayContaining(["Read", "Edit", "Bash"]));
  });

  it("the trailing summary line points back to the session", () => {
    const lines = parseRawTranscript(fixtureJsonl());
    const summary = lines.find((l) => l.type === "summary") as RawSummaryLine;
    expect(summary).toBeDefined();
    expect(summary.sessionId).toBe("sample-session-0000");
    expect(summary.summary.length).toBeGreaterThan(0);
  });
});
