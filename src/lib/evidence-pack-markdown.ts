import type {
  EvidencePack,
  EvidencePackReviewerFocusItem,
} from "@/types/evidence-pack";

/**
 * `renderEvidencePackMarkdown` — pure renderer that turns an {@link EvidencePack}
 * into a skimmable, privacy-safe markdown review artifact (#61).
 *
 * ## Contract
 *
 * - **Pure & deterministic.** String in, string out. No IO, no `Date.now`, no
 *   mutation of the input.
 * - **Privacy by boundary.** The renderer takes ONLY the `EvidencePack` — never
 *   the session, events, or beats. The pack is already the content-safe boundary
 *   (`buildEvidencePack` enforces the allowlist), so this function structurally
 *   cannot reach raw transcript content. It adds only static section labels and
 *   formats the pack's own (content-safe) fields, and emits the pack's redaction
 *   footer verbatim. The same forbidden-content probes that guard the pack are
 *   re-run over this markdown in the tests.
 *
 * The output answers the reviewer's questions (intent, reads/edits, checks,
 * blockers, human touchpoints, artifacts, activity shape, what to focus on, and
 * what was redacted) without anyone opening the raw transcript.
 *
 * See [`docs/product/next-phase-agent-session-evidence-pack.md`](../../docs/product/next-phase-agent-session-evidence-pack.md).
 */
export function renderEvidencePackMarkdown(pack: EvidencePack): string {
  const lines: string[] = [];
  const push = (...l: string[]) => {
    for (const line of l) lines.push(line);
  };

  push(
    "# Agent Session Evidence Pack",
    "",
    "> Privacy-safe review artifact generated from an observed Claude Code",
    "> session. It summarises what the agent did so a reviewer can assess the",
    "> work without reading the raw transcript.",
    "",
    `- **Pack ID:** \`${pack.id}\``,
    `- **Generated:** ${pack.generatedAt}`,
    `- **Source:** ${pack.source} (captured from ${pack.session.source} at ${pack.session.capturedAt})`,
    "",
  );

  push(
    "## Work item",
    "",
    `- **Intent:** ${pack.workItem.title}`,
    `- **Type:** ${pack.workItem.kind}`,
    `- **Status:** ${pack.workItem.status}`,
    `- **Mode:** ${pack.workItem.currentMode}`,
    "",
  );

  const a = pack.activity;
  push(
    "## Activity",
    "",
    `- **${a.totalEvents}** event${plural(a.totalEvents)} collapsed into **${a.totalBeats}** beat${plural(a.totalBeats)}.`,
    `- **By zone:** ${renderCountMap(a.byZone)}`,
    `- **By action:** ${renderCountMap(a.byAction)}`,
    `- **Timeline:** ${a.beatSequence.length > 0 ? a.beatSequence.join(" → ") : "—"}`,
    "",
  );

  const f = pack.filesAndArtifacts;
  push(
    "## Files & artifacts",
    "",
    `- **Artifacts produced:** ${f.artifactCount}${f.artifactKinds.length > 0 ? ` (${f.artifactKinds.join(", ")})` : ""}`,
    `- **Files edited:** ${f.editedFileCount}`,
    `- **PRs opened:** ${f.prCount}`,
    "",
  );

  const q = pack.quality;
  push(
    "## Quality gates",
    "",
    `- **Passed:** ${q.passedCount}`,
    `- **Failed:** ${q.failedCount}`,
    `- **Overall:** ${q.status}`,
    "",
  );

  const b = pack.blockers;
  const blockerLines: string[] = [];
  if (b.blockerCount > 0) {
    blockerLines.push(
      `- **${b.blockerCount}** raised${b.blockerKinds.length > 0 ? ` (kind${plural(b.blockerKinds.length)}: ${b.blockerKinds.join(", ")})` : ""}.`,
    );
  }
  if (b.blockedStateCount > 0) {
    blockerLines.push(
      `- **${b.blockedStateCount}** blocked / failed state${plural(b.blockedStateCount)} in the activity timeline.`,
    );
  }
  if (blockerLines.length === 0) blockerLines.push("- None observed.");
  push("## Blockers", "", ...blockerLines, "");

  const h = pack.humanTouchpoints;
  push(
    "## Human touchpoints",
    "",
    h.count === 0
      ? "- None observed."
      : `- **${h.count}** observed (AskUserQuestion: ${h.askUserQuestionCount}).`,
    "",
  );

  push("## Reviewer focus", "");
  if (pack.reviewerFocus.length === 0) {
    push("- _No focus signals — the observed evidence surfaced nothing notable._");
  } else {
    for (const item of pack.reviewerFocus) push(`- ${renderFocus(item)}`);
  }
  push("");

  push(
    "## Redaction",
    "",
    pack.redaction.note,
    "",
    "**Deliberately omitted:**",
    "",
    ...pack.redaction.omitted.map((category) => `- ${category}`),
    "",
  );

  return lines.join("\n");
}

// ─── Small pure helpers ──────────────────────────────────────────────────────

/** Render a sparse count map as `key N · key N`, sorted by key for determinism. */
function renderCountMap(map: Record<string, number>): string {
  const entries = Object.entries(map).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  if (entries.length === 0) return "—";
  return entries.map(([key, count]) => `${key} ${count}`).join(" · ");
}

function renderFocus(item: EvidencePackReviewerFocusItem): string {
  const marker = item.severity === "warning" ? "**WARNING**" : "**NOTE**";
  return `${marker} — ${item.detail}`;
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}
