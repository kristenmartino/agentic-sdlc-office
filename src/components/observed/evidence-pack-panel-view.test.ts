import { describe, expect, it } from "vitest";
import { selectEvidencePackMarkdown } from "./evidence-pack-panel-view";
import { SCENARIOS } from "@/data/scenarios";

/**
 * Tests for the Evidence Pack panel's pure view-prep (#71).
 *
 * The `EvidencePackPanel.tsx` is a dumb consumer of this output, so the
 * meaningful behaviour — observed-only gating, the section set, and the privacy
 * gate — is verified here against the real scenario registry, in vitest's node
 * environment (no DOM needed).
 */

const SECTION_HEADERS = [
  "# Agent Session Evidence Pack",
  "## Work item",
  "## Activity",
  "## Files & artifacts",
  "## Quality gates",
  "## Blockers",
  "## Human touchpoints",
  "## Reviewer focus",
  "## Redaction",
];

const FORBIDDEN = [
  "/Users/",
  "/home/",
  "/root/",
  "rootk",
  "redacted-session",
  "evt_",
  "u-000",
  "tu-000",
  "[redacted]",
  "pnpm test",
  "Button.tsx",
  "API_KEY",
  "sk-",
  "ghp_",
  "thinking",
  "raw prompt text",
  "raw assistant text",
];

describe("selectEvidencePackMarkdown — observed-mode gating", () => {
  it("produces markdown for an observed scenario (panel renders)", () => {
    const md = selectEvidencePackMarkdown(SCENARIOS["observed-sample"]);
    expect(md).not.toBeNull();
    expect(typeof md).toBe("string");
    expect(md!).toContain("# Agent Session Evidence Pack");
  });

  it("returns null for scripted scenarios (panel renders nothing — clean gate)", () => {
    expect(selectEvidencePackMarkdown(SCENARIOS["req-014"])).toBeNull();
    expect(selectEvidencePackMarkdown(SCENARIOS["bug-032"])).toBeNull();
  });

  it("is pure/deterministic for a given scenario", () => {
    expect(selectEvidencePackMarkdown(SCENARIOS["observed-sample"])).toBe(
      selectEvidencePackMarkdown(SCENARIOS["observed-sample"]),
    );
  });
});

describe("selectEvidencePackMarkdown — content + privacy", () => {
  it("includes the full Evidence Pack section set", () => {
    const md = selectEvidencePackMarkdown(SCENARIOS["observed-sample"]);
    expect(md).not.toBeNull();
    for (const header of SECTION_HEADERS) {
      expect(md!, `missing section: ${header}`).toContain(header);
    }
  });

  it("carries none of the forbidden raw tokens", () => {
    const md = selectEvidencePackMarkdown(SCENARIOS["observed-sample"]);
    expect(md).not.toBeNull();
    for (const probe of FORBIDDEN) {
      expect(md!.includes(probe), `panel markdown leaked: ${probe}`).toBe(false);
    }
  });
});
