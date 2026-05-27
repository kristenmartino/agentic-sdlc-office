import { describe, expect, it } from "vitest";
import {
  redactGitHubUrls,
  redactHomePaths,
  safeBashCommandLabel,
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
  it("redacts the org/repo segment but preserves /pull/<N>", () => {
    expect(redactGitHubUrls("opened https://github.com/private-org/secret-repo/pull/42"))
      .toBe("opened https://github.com/<org>/<repo>/pull/42");
  });

  it("preserves /issues/<N>", () => {
    expect(redactGitHubUrls("see https://github.com/x/y/issues/100"))
      .toBe("see https://github.com/<org>/<repo>/issues/100");
  });

  it("collapses unsafe path tails (/blob/<branch>/<file>) to /…", () => {
    // Branch names and file paths inside private repos are identifying.
    const before = "see https://github.com/private/repo/blob/private-branch/src/internal/client-name.ts";
    const after = redactGitHubUrls(before);
    expect(after).toContain("https://github.com/<org>/<repo>/…");
    expect(after).not.toContain("private-branch");
    expect(after).not.toContain("client-name");
    expect(after).not.toContain("internal");
  });

  it("collapses unsafe path tails (/compare/<branch>...<branch>) to /…", () => {
    const after = redactGitHubUrls("diff https://github.com/org/repo/compare/secret-branch...prod");
    expect(after).toContain("https://github.com/<org>/<repo>/…");
    expect(after).not.toContain("secret-branch");
    expect(after).not.toContain("prod");
  });

  it("collapses /actions/runs/<id> to /…", () => {
    const after = redactGitHubUrls("run https://github.com/org/repo/actions/runs/12345678");
    expect(after).toContain("https://github.com/<org>/<repo>/…");
    expect(after).not.toContain("12345678");
  });

  it("collapses no-tail URLs to just <org>/<repo>", () => {
    expect(redactGitHubUrls("repo at https://github.com/org/repo"))
      .toBe("repo at https://github.com/<org>/<repo>");
  });

  it("leaves non-github URLs alone", () => {
    expect(redactGitHubUrls("see https://example.com/x/y"))
      .toBe("see https://example.com/x/y");
  });
});

describe("safeBashCommandLabel", () => {
  it("returns a category label only — never the command text", () => {
    expect(safeBashCommandLabel("pnpm test")).toBe("Ran test command");
    expect(safeBashCommandLabel("pnpm typecheck")).toBe("Ran build/typecheck command");
    expect(safeBashCommandLabel("pnpm build")).toBe("Ran build/typecheck command");
    expect(safeBashCommandLabel("tsc --noEmit")).toBe("Ran build/typecheck command");
    expect(safeBashCommandLabel("vitest run")).toBe("Ran test command");
    expect(safeBashCommandLabel("pytest -k auth")).toBe("Ran test command");
    expect(safeBashCommandLabel("go test ./...")).toBe("Ran test command");
    expect(safeBashCommandLabel("cargo test")).toBe("Ran test command");
  });

  it("never renders the command — generic bucket for anything else", () => {
    expect(safeBashCommandLabel("ls -la")).toBe("Ran Bash command");
    expect(safeBashCommandLabel("curl -X POST https://api.example.com")).toBe("Ran Bash command");
  });

  it("does not leak a fake API token even if it's in the command", () => {
    // The whole point: even if the command has a secret, the label is fixed.
    const result = safeBashCommandLabel("curl -H 'Authorization: Bearer sk-secret-1234567890'");
    expect(result).toBe("Ran Bash command");
    expect(result).not.toContain("sk-secret");
    expect(result).not.toContain("Authorization");
    expect(result).not.toContain("Bearer");
  });

  it("does not leak URL query parameters", () => {
    const result = safeBashCommandLabel("curl 'https://api.example.com/secret?token=abc&user=internal'");
    expect(result).toBe("Ran Bash command");
    expect(result).not.toContain("token=abc");
    expect(result).not.toContain("user=internal");
  });

  it("does not leak environment variable values inline with the command", () => {
    const result = safeBashCommandLabel("API_KEY=sk-secret-key node script.js");
    expect(result).toBe("Ran Bash command");
    expect(result).not.toContain("sk-secret-key");
    expect(result).not.toContain("API_KEY");
  });

  it("handles undefined / empty input safely", () => {
    expect(safeBashCommandLabel(undefined)).toBe("Ran Bash command");
    expect(safeBashCommandLabel("")).toBe("Ran Bash command");
    expect(safeBashCommandLabel("   ")).toBe("Ran Bash command");
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
