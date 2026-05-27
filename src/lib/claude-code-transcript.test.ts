import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  parseRawTranscript,
  validateRawTranscript,
  validateRawTranscriptLine,
  type RawAssistantMessage,
  type RawSummaryLine,
  type RawTranscriptIssue,
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

describe("validateRawTranscript", () => {
  function validate(jsonl: string): RawTranscriptIssue[] {
    return validateRawTranscript(parseRawTranscript(jsonl));
  }

  it("returns no issues for the synthetic fixture", () => {
    const issues = validateRawTranscript(parseRawTranscript(fixtureJsonl()));
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it("flags unknown line.type values", () => {
    const issues = validate('{"type":"meta"}');
    expect(issues.some((i) => i.field === "type" && i.message.includes("unknown line.type: 'meta'"))).toBe(true);
  });

  it("flags a user message missing the message object", () => {
    const issues = validate('{"type":"user"}');
    expect(issues.some((i) => i.message.includes("user line is missing 'message' object"))).toBe(true);
  });

  it("flags a user message.role that isn't 'user'", () => {
    const issues = validate('{"type":"user","message":{"role":"assistant","content":"hi"}}');
    expect(issues.some((i) => i.field === "message.role" && i.message.includes("expected 'user'"))).toBe(true);
  });

  it("flags an assistant message.content that isn't an array", () => {
    const issues = validate('{"type":"assistant","message":{"role":"assistant","content":"oops"}}');
    expect(issues.some((i) => i.field === "message.content" && i.message.includes("expected array"))).toBe(true);
  });

  it("flags an unknown content block type", () => {
    const issues = validate(
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"voice","data":"x"}]}}',
    );
    expect(issues.some((i) => i.field === "message.content[0].type" && i.message.includes("unknown content block type: 'voice'"))).toBe(true);
  });

  it("flags a tool_use missing id", () => {
    const issues = validate(
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Read","input":{}}]}}',
    );
    expect(issues.some((i) => i.field === "message.content[0].id" && i.message.includes("non-empty string"))).toBe(true);
  });

  it("flags a tool_use missing name", () => {
    const issues = validate(
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"t1","input":{}}]}}',
    );
    expect(issues.some((i) => i.field === "message.content[0].name" && i.message.includes("non-empty string"))).toBe(true);
  });

  it("flags a tool_use whose input is not an object", () => {
    const issues = validate(
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"t1","name":"Read","input":"oops"}]}}',
    );
    expect(issues.some((i) => i.field === "message.content[0].input" && i.message.includes("must be an object"))).toBe(true);
  });

  it("flags a tool_result missing tool_use_id", () => {
    const issues = validate(
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","content":"x"}]}}',
    );
    expect(issues.some((i) => i.field === "message.content[0].tool_use_id" && i.message.includes("non-empty string"))).toBe(true);
  });

  it("flags a tool_result with wrong content type", () => {
    const issues = validate(
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":42}]}}',
    );
    expect(issues.some((i) => i.field === "message.content[0].content" && i.message.includes("must be string or content[]"))).toBe(true);
  });

  it("flags a tool_result with non-boolean is_error", () => {
    const issues = validate(
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"x","is_error":"yes"}]}}',
    );
    expect(issues.some((i) => i.field === "message.content[0].is_error" && i.message.includes("must be boolean"))).toBe(true);
  });

  it("flags a thinking block missing the thinking field", () => {
    const issues = validate(
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"thinking"}]}}',
    );
    expect(issues.some((i) => i.field === "message.content[0].thinking" && i.message.includes("string 'thinking' field"))).toBe(true);
  });

  it("flags a summary line missing the summary field", () => {
    const issues = validate('{"type":"summary"}');
    expect(issues.some((i) => i.field === "summary"))
      .toBe(true);
  });

  it("flags a non-ISO timestamp on the envelope", () => {
    const issues = validate('{"type":"summary","summary":"x","timestamp":"yesterday"}');
    expect(issues.some((i) => i.field === "timestamp" && i.message.includes("ISO 8601"))).toBe(true);
  });

  it("flags a non-string-or-null parentUuid", () => {
    const issues = validate('{"type":"summary","summary":"x","parentUuid":42}');
    expect(issues.some((i) => i.field === "parentUuid" && i.message.includes("string | null"))).toBe(true);
  });

  it("system lines are permissive — unknown subtypes are fine", () => {
    const issues = validate('{"type":"system","subtype":"something_unknown","data":{"x":1}}');
    expect(issues).toEqual([]);
  });

  it("validates nested content blocks inside a tool_result content array", () => {
    const issues = validate(
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"voice"}]}]}}',
    );
    expect(issues.some((i) => i.field === "message.content[0].content[0].type" && i.message.includes("unknown content block type: 'voice'"))).toBe(true);
  });

  it("reports the 1-based lineIndex of the offending line", () => {
    const issues: RawTranscriptIssue[] = [];
    validateRawTranscriptLine({ type: "meta" }, 7, issues);
    expect(issues[0].lineIndex).toBe(7);
  });

  it("treats null and primitives as 'line is not an object'", () => {
    const issues: RawTranscriptIssue[] = [];
    validateRawTranscriptLine(null, 1, issues);
    validateRawTranscriptLine("hello", 2, issues);
    expect(issues).toHaveLength(2);
    expect(issues[0].message).toContain("got null");
    expect(issues[1].message).toContain("got string");
  });
});

describe("validateRawTranscript — line types added after real-transcript discovery", () => {
  function validate(jsonl: string): RawTranscriptIssue[] {
    return validateRawTranscript(parseRawTranscript(jsonl));
  }

  it("accepts a valid ai-title line", () => {
    expect(validate('{"type":"ai-title","aiTitle":"Refactor button","sessionId":"s1"}')).toEqual([]);
  });

  it("rejects ai-title missing aiTitle", () => {
    const issues = validate('{"type":"ai-title","sessionId":"s1"}');
    expect(issues.some((i) => i.field === "aiTitle")).toBe(true);
  });

  it("accepts a valid custom-title line", () => {
    expect(validate('{"type":"custom-title","customTitle":"my session","sessionId":"s1"}')).toEqual([]);
  });

  it("rejects custom-title missing customTitle", () => {
    const issues = validate('{"type":"custom-title","sessionId":"s1"}');
    expect(issues.some((i) => i.field === "customTitle")).toBe(true);
  });

  it("accepts a valid last-prompt line", () => {
    expect(validate('{"type":"last-prompt","lastPrompt":"do x","leafUuid":"l1","sessionId":"s1"}')).toEqual([]);
  });

  it("rejects last-prompt missing lastPrompt", () => {
    const issues = validate('{"type":"last-prompt","sessionId":"s1"}');
    expect(issues.some((i) => i.field === "lastPrompt")).toBe(true);
  });

  it("accepts a valid pr-link line (string prNumber)", () => {
    expect(validate(
      '{"type":"pr-link","prNumber":"42","prUrl":"https://github.com/example/repo/pull/42","prRepository":"example/repo","sessionId":"s1"}',
    )).toEqual([]);
  });

  it("accepts a valid pr-link line (number prNumber)", () => {
    expect(validate(
      '{"type":"pr-link","prNumber":42,"prUrl":"https://github.com/example/repo/pull/42","prRepository":"example/repo","sessionId":"s1"}',
    )).toEqual([]);
  });

  it("rejects pr-link missing required fields", () => {
    const issues = validate('{"type":"pr-link","sessionId":"s1"}');
    expect(issues.some((i) => i.field === "prUrl")).toBe(true);
    expect(issues.some((i) => i.field === "prRepository")).toBe(true);
    expect(issues.some((i) => i.field === "prNumber")).toBe(true);
  });

  it("accepts a valid attachment line", () => {
    expect(validate('{"type":"attachment","attachment":{"name":"x"},"uuid":"u1","sessionId":"s1"}')).toEqual([]);
  });

  it("rejects attachment missing attachment field", () => {
    const issues = validate('{"type":"attachment","uuid":"u1","sessionId":"s1"}');
    expect(issues.some((i) => i.field === "attachment")).toBe(true);
  });

  it("accepts a valid queue-operation line", () => {
    expect(validate('{"type":"queue-operation","operation":"model_swap","sessionId":"s1"}')).toEqual([]);
  });

  it("rejects queue-operation missing operation", () => {
    const issues = validate('{"type":"queue-operation","sessionId":"s1"}');
    expect(issues.some((i) => i.field === "operation")).toBe(true);
  });
});

describe("validateRawTranscript — additive envelope fields", () => {
  it("accepts tool_use blocks with the optional 'caller' field", () => {
    const issues = validateRawTranscript(parseRawTranscript(
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"t1","name":"Read","input":{},"caller":"main"}]}}',
    ));
    expect(issues).toEqual([]);
  });

  it("accepts user lines with the optional top-level 'toolUseResult' sibling field", () => {
    const jsonl = JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }],
      },
      toolUseResult: { stdout: "x", stderr: "", interrupted: false },
    });
    expect(validateRawTranscript(parseRawTranscript(jsonl))).toEqual([]);
  });

  it("accepts assistant lines with the optional 'requestId' and MCP attribution fields", () => {
    const jsonl = JSON.stringify({
      type: "assistant",
      requestId: "req-123",
      attributionMcpServer: "Claude_in_Chrome",
      attributionMcpTool: "find",
      message: { role: "assistant", content: [{ type: "text", text: "hi" }] },
    });
    expect(validateRawTranscript(parseRawTranscript(jsonl))).toEqual([]);
  });

  it("accepts user lines with the optional 'permissionMode' and 'promptId' fields", () => {
    const jsonl = JSON.stringify({
      type: "user",
      permissionMode: "acceptEdits",
      promptId: "p1",
      message: { role: "user", content: "hello" },
    });
    expect(validateRawTranscript(parseRawTranscript(jsonl))).toEqual([]);
  });
});
