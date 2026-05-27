import { describe, expect, it } from "vitest";
import {
  redactGitHubUrls,
  redactHomePaths,
  sanitizeForNotes,
  truncate,
} from "./redact";

describe("redactHomePaths", () => {
  it("redacts /Users/<name>", () => {
    expect(redactHomePaths("error at /Users/rootk/agentic-sdlc-office/src/x.ts"))
      .toBe("error at /<HOME>/agentic-sdlc-office/src/x.ts");
  });

  it("redacts /home/<name>", () => {
    expect(redactHomePaths("failed at /home/alice/project/file.py"))
      .toBe("failed at /<HOME>/project/file.py");
  });

  it("redacts Windows C:\\Users\\<name>\\", () => {
    expect(redactHomePaths("failed at C:\\Users\\bob\\projects\\app.ts"))
      .toBe("failed at C:\\Users\\<HOME>\\projects\\app.ts");
  });

  it("leaves non-home paths alone", () => {
    expect(redactHomePaths("/tmp/foo /etc/passwd /opt/app"))
      .toBe("/tmp/foo /etc/passwd /opt/app");
  });

  it("redacts multiple home paths in one string", () => {
    expect(redactHomePaths("from /Users/a/x to /Users/b/y"))
      .toBe("from /<HOME>/x to /<HOME>/y");
  });
});

describe("redactGitHubUrls", () => {
  it("redacts the org/repo segment", () => {
    expect(redactGitHubUrls("opened https://github.com/private-org/secret-repo/pull/42"))
      .toBe("opened https://github.com/<org>/<repo>/pull/42");
  });

  it("preserves the path tail (PR number)", () => {
    expect(redactGitHubUrls("see https://github.com/x/y/issues/100"))
      .toBe("see https://github.com/<org>/<repo>/issues/100");
  });

  it("leaves non-github URLs alone", () => {
    expect(redactGitHubUrls("see https://example.com/x/y"))
      .toBe("see https://example.com/x/y");
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("trims and adds ellipsis when too long", () => {
    expect(truncate("hello world this is a long line", 12)).toBe("hello world…");
  });
});

describe("sanitizeForNotes", () => {
  it("redacts home paths + github urls + takes first line + truncates", () => {
    const stderr = [
      "Error: Test failed at /Users/rootk/agentic-sdlc-office/src/x.test.ts:12",
      "  see https://github.com/private/repo/pull/42 for context",
      "  Stack: at someFunction (file.ts:100)",
    ].join("\n");
    const safe = sanitizeForNotes(stderr, { maxLen: 200 });
    expect(safe).toContain("/<HOME>/");
    expect(safe).not.toContain("rootk");
    expect(safe).not.toContain("Stack:"); // multi-line dropped
  });

  it("returns empty string for empty/whitespace-only input", () => {
    expect(sanitizeForNotes("")).toBe("");
    expect(sanitizeForNotes("   \n  ")).toBe("");
  });

  it("applies the default maxLen of 120", () => {
    const long = "x".repeat(500);
    const safe = sanitizeForNotes(long);
    expect(safe.length).toBeLessThanOrEqual(120);
  });

  it("handles single-line input without dropping content", () => {
    expect(sanitizeForNotes("simple error message")).toBe("simple error message");
  });
});
