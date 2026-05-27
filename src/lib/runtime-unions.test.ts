import { describe, expect, it } from "vitest";
import {
  KNOWN_ADLC_MODES,
  KNOWN_AGENT_IDS,
  KNOWN_AGENT_STATUSES,
  KNOWN_CONTENT_BLOCK_TYPES,
  KNOWN_EVENT_ACTORS,
  KNOWN_RAW_TRANSCRIPT_LINE_TYPES,
  KNOWN_ROOM_IDS,
  KNOWN_WORKFLOW_EVENT_TYPES,
  KNOWN_WORK_ITEM_KINDS,
  KNOWN_WORK_ITEM_STATUSES,
  isIsoTimestamp,
  isKnownAgentId,
} from "./runtime-unions";

describe("KNOWN_* sets", () => {
  it("has the eight expected agents", () => {
    expect(KNOWN_AGENT_IDS.size).toBe(8);
    for (const a of ["cora", "piper", "nova", "theo", "iris", "mira", "tess", "rune"] as const) {
      expect(KNOWN_AGENT_IDS.has(a)).toBe(true);
    }
  });

  it("has the eight rooms", () => {
    expect(KNOWN_ROOM_IDS.size).toBe(8);
  });

  it("has every agent status used by StatusBubble", () => {
    expect(KNOWN_AGENT_STATUSES.size).toBe(15);
  });

  it("has all seven ADLC modes including Multi", () => {
    expect(KNOWN_ADLC_MODES.size).toBe(7);
    expect(KNOWN_ADLC_MODES.has("Multi")).toBe(true);
  });

  it("KNOWN_EVENT_ACTORS includes every agent plus human and system", () => {
    expect(KNOWN_EVENT_ACTORS.has("human")).toBe(true);
    expect(KNOWN_EVENT_ACTORS.has("system")).toBe(true);
    for (const a of KNOWN_AGENT_IDS) {
      expect(KNOWN_EVENT_ACTORS.has(a)).toBe(true);
    }
  });

  it("KNOWN_WORK_ITEM_KINDS matches the WorkItemKind union", () => {
    expect(KNOWN_WORK_ITEM_KINDS.size).toBe(4);
  });

  it("KNOWN_WORK_ITEM_STATUSES has 10 values", () => {
    expect(KNOWN_WORK_ITEM_STATUSES.size).toBe(10);
  });

  it("KNOWN_WORKFLOW_EVENT_TYPES has all 31 known types", () => {
    // Sanity bound: 31 came from counting WorkflowEventType members. If this
    // drifts, the runtime set is missing a value or has stale entries.
    expect(KNOWN_WORKFLOW_EVENT_TYPES.size).toBe(31);
  });

  it("KNOWN_RAW_TRANSCRIPT_LINE_TYPES covers the 10 line types real Claude Code sessions use", () => {
    // 4 originals + 6 added after the real-transcript discovery (PR #44).
    expect(KNOWN_RAW_TRANSCRIPT_LINE_TYPES.size).toBe(10);
    const expected = [
      "system", "user", "assistant", "summary",
      "ai-title", "custom-title", "last-prompt", "pr-link", "attachment", "queue-operation",
    ] as const;
    for (const t of expected) {
      expect(KNOWN_RAW_TRANSCRIPT_LINE_TYPES.has(t)).toBe(true);
    }
  });

  it("KNOWN_CONTENT_BLOCK_TYPES covers text/tool_use/tool_result/thinking", () => {
    expect(KNOWN_CONTENT_BLOCK_TYPES.size).toBe(4);
    for (const t of ["text", "tool_use", "tool_result", "thinking"] as const) {
      expect(KNOWN_CONTENT_BLOCK_TYPES.has(t)).toBe(true);
    }
  });
});

describe("isKnownAgentId", () => {
  it("accepts every real agent", () => {
    for (const a of KNOWN_AGENT_IDS) {
      expect(isKnownAgentId(a)).toBe(true);
    }
  });

  it("rejects unknown strings, undefined, null, numbers, objects", () => {
    expect(isKnownAgentId("bogus")).toBe(false);
    expect(isKnownAgentId(undefined)).toBe(false);
    expect(isKnownAgentId(null)).toBe(false);
    expect(isKnownAgentId(42)).toBe(false);
    expect(isKnownAgentId({ id: "mira" })).toBe(false);
  });
});

describe("isIsoTimestamp", () => {
  it("accepts ISO 8601 with Z offset", () => {
    expect(isIsoTimestamp("2026-05-27T14:30:00.000Z")).toBe(true);
  });

  it("accepts ISO 8601 with second-precision and ±hh:mm offset", () => {
    expect(isIsoTimestamp("2026-05-27T14:30:00-04:00")).toBe(true);
    expect(isIsoTimestamp("2026-05-27T14:30:00+0530")).toBe(true);
  });

  it("rejects naive timestamps without offset", () => {
    // Timezone-naive timestamps would mis-sort the activity log; reject them.
    expect(isIsoTimestamp("2026-05-27T14:30:00.000")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isIsoTimestamp(undefined)).toBe(false);
    expect(isIsoTimestamp(1716822600000)).toBe(false);
    expect(isIsoTimestamp(null)).toBe(false);
  });

  it("rejects nonsense strings", () => {
    expect(isIsoTimestamp("yesterday at 4pm")).toBe(false);
    expect(isIsoTimestamp("2026/05/27")).toBe(false);
    expect(isIsoTimestamp("")).toBe(false);
  });
});
