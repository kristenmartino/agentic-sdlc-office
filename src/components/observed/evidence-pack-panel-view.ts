import type { Scenario } from "@/data/scenarios";
import type { ParsedClaudeCodeSession } from "@/lib/claude-code-parser";
import { buildEvidencePack } from "@/lib/evidence-pack";
import { renderEvidencePackMarkdown } from "@/lib/evidence-pack-markdown";

/**
 * Pure view-prep for the `EvidencePackPanel` — the same split as
 * `observed-beat-view.ts` vs `ObservedBeatTimeline.tsx`: the testable logic
 * lives here (node-runnable in vitest) and the `.tsx` stays a dumb consumer.
 *
 * It composes the existing pure logic and nothing else:
 *
 *   observed scenario → buildEvidencePack() → renderEvidencePackMarkdown() → string
 *
 * Gating is part of the contract: it returns the rendered markdown ONLY for an
 * observed scenario (with an origin), and `null` otherwise — so the panel
 * renders nothing for scripted scenarios. The privacy guarantee is inherited
 * end-to-end: `buildEvidencePack` enforces the content-safe allowlist, so the
 * string returned here carries no raw transcript content.
 *
 * No IO, no `Date.now`, no mutation — `buildEvidencePack` defaults `generatedAt`
 * to the session's `capturedAt`, so the output is deterministic per scenario.
 */
export function selectEvidencePackMarkdown(scenario: Scenario): string | null {
  if (scenario.source !== "observed" || !scenario.origin) return null;

  const session: ParsedClaudeCodeSession = {
    // `scenario.origin.source` is typed loosely (`string`); `buildEvidencePack`
    // allowlists it against the known origin sources, so this cast is safe and
    // never widens what reaches the output.
    origin: scenario.origin as ParsedClaudeCodeSession["origin"],
    workItem: scenario.initialWorkItem,
    chain: scenario.chain,
    events: scenario.events,
  };

  return renderEvidencePackMarkdown(buildEvidencePack({ session }));
}
