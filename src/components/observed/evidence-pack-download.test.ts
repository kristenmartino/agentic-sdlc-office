import { describe, expect, it } from "vitest";
import {
  EVIDENCE_PACK_DOWNLOAD_FILENAME,
  buildEvidencePackBlobParts,
  downloadEvidencePackMarkdown,
} from "./evidence-pack-download";

/**
 * Tests for the Evidence Pack export helper (#63).
 *
 * The pure descriptor is the testable unit (filename + verbatim content). The
 * DOM trigger is verified to be a safe no-op in vitest's node environment (no
 * `document`), so it never throws when imported/called off the browser.
 */

describe("buildEvidencePackBlobParts", () => {
  it("uses a fixed, content-safe filename and a markdown MIME type", () => {
    const parts = buildEvidencePackBlobParts("# hi");
    expect(parts.filename).toBe(EVIDENCE_PACK_DOWNLOAD_FILENAME);
    expect(parts.filename).toBe("agent-session-evidence-pack.md");
    expect(parts.type).toBe("text/markdown;charset=utf-8");
  });

  it("passes the markdown through verbatim (no transform, no added content)", () => {
    const md = "# Agent Session Evidence Pack\n\n## Reviewer focus\n\n- **WARNING** — 1 quality gate failed\n";
    expect(buildEvidencePackBlobParts(md).content).toBe(md);
  });

  it("has a filename that itself leaks nothing (no session-derived tokens)", () => {
    const forbidden = ["/Users/", "redacted-session", "evt_", "ep_", "sk-", "ghp_"];
    for (const probe of forbidden) {
      expect(EVIDENCE_PACK_DOWNLOAD_FILENAME.includes(probe), `filename leaked: ${probe}`).toBe(false);
    }
  });
});

describe("downloadEvidencePackMarkdown — safe off the browser", () => {
  it("no-ops without throwing when there is no DOM (SSR / tests)", () => {
    expect(typeof document).toBe("undefined"); // node env precondition
    expect(() => downloadEvidencePackMarkdown("# hi")).not.toThrow();
  });

  it("no-ops for null/undefined/empty markdown", () => {
    expect(() => downloadEvidencePackMarkdown(null)).not.toThrow();
    expect(() => downloadEvidencePackMarkdown(undefined)).not.toThrow();
    expect(() => downloadEvidencePackMarkdown("")).not.toThrow();
  });
});
