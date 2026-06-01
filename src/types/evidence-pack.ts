import type { ADLCMode } from "./adlc";
import type { WorkItemKind, WorkItemStatus } from "./work-items";

/**
 * Types for the **Agent Session Evidence Pack** — a privacy-safe, skimmable
 * review artifact generated from an observed Claude Code session.
 *
 * See [`docs/product/next-phase-agent-session-evidence-pack.md`](../../docs/product/next-phase-agent-session-evidence-pack.md)
 * for the product thesis. This file is the *data model* only (#59); the pure
 * reducer that produces it lives in
 * [`src/lib/evidence-pack.ts`](../lib/evidence-pack.ts) (#60), and the markdown
 * renderer (#61) is a later PR.
 *
 * ## Privacy contract (enforced by construction + test)
 *
 * Every field here is **content-safe by design**: counts, categories, and
 * allowlisted enum values — never raw payload text. The pack is built from an
 * explicit allowlist of fields (see the reducer); it must be possible to
 * `JSON.stringify` an `EvidencePack` and find **none** of:
 *
 *   - raw prompts / assistant text / user-message text / model reasoning
 *   - Bash commands, stdout/stderr, raw quality-gate notes
 *   - raw session IDs, event IDs, UUIDs, tool IDs
 *   - file paths, worktree paths, GitHub URLs
 *   - MCP server names / inputs, attachment payloads, secrets / tokens
 *
 * Because the model carries only allowlisted, content-safe strings and counts,
 * the synthetic sample and real redacted fixture can be serialized through the
 * same schema and tested with the same forbidden-content probes.
 */

/** Where the pack was generated from. Today only observed sessions. */
export type EvidencePackSource = "observed-session";

/**
 * Provenance of the underlying session. Allowlisted to the known
 * `ParsedClaudeCodeSession` origin sources (`"unknown"` for anything else) so a
 * malformed origin can never smuggle a raw string in. Never a raw session ID.
 */
export type EvidencePackSessionProvenance =
  | "claude-code-local"
  | "claude-code-cloud"
  | "fixture"
  | "unknown";

export interface EvidencePackSessionSummary {
  source: EvidencePackSessionProvenance;
  /** ISO timestamp the session was captured. A timestamp, never a session ID. */
  capturedAt: string;
}

export interface EvidencePackWorkItemSummary {
  kind: WorkItemKind | "unknown";
  status: WorkItemStatus | "unknown";
  currentMode: ADLCMode | "unknown";
  /**
   * Always a content-free label. The raw work-item title is the user's prompt
   * (the mapper seeds it from the first user message), and we cannot prove an
   * arbitrary prompt is content-safe, so the pack never exposes it — it uses a
   * constant fallback instead. See {@link EVIDENCE_PACK_WORK_ITEM_TITLE_FALLBACK}.
   */
  title: string;
}

/**
 * Activity shape, derived from the `VisualBeat` stream's allowlisted fields.
 * Because `beats` is a public input to `buildEvidencePack`, none of these
 * strings are trusted verbatim: zone/action keys are allowlisted (unknown →
 * `"other"`) and each `beatSequence` label is REGENERATED from the beat's
 * `action` + `signalCount` — never from the caller-supplied `beat.label`.
 *
 * `byZone` / `byAction` are **sparse** maps — only zones/actions that actually
 * occurred appear, each with a beat count ≥ 1. One substitution: the
 * content-free `thinking`/`think` phase is surfaced as `reasoning` so the
 * serialized pack is provably free of the `thinking` forbidden-content probe.
 */
export interface EvidencePackActivitySummary {
  /** Total events in the resolved stream (lifecycle + activity). */
  totalEvents: number;
  /** Total beats the reducer produced from the stream. */
  totalBeats: number;
  /** Beat count per observed zone (sparse; e.g. `{ reading: 1, coding: 1 }`). */
  byZone: Record<string, number>;
  /** Beat count per beat action (sparse; e.g. `{ read: 1, edit: 1 }`). */
  byAction: Record<string, number>;
  /** Ordered, content-free beat labels (generated from action + counts only). */
  beatSequence: string[];
}

export interface EvidencePackArtifactSummary {
  /** Number of `artifact.produced` events observed. */
  artifactCount: number;
  /** Distinct allowlisted artifact kinds (never raw refs / paths / summaries). */
  artifactKinds: string[];
  /**
   * Distinct files edited. Derived by de-duplicating artifact refs *for the
   * count only* — the refs themselves (raw paths) are never exposed.
   */
  editedFileCount: number;
  /** Genuine PR-open beats observed (the reducer's `outbox` classification). */
  prCount: number;
}

/** Roll-up of quality-gate outcomes. */
export type EvidencePackQualityStatus = "passed" | "failed" | "mixed" | "none";

export interface EvidencePackQualitySummary {
  passedCount: number;
  failedCount: number;
  totalGates: number;
  /** `none` when no gates ran; `mixed` when both passes and failures occurred. */
  status: EvidencePackQualityStatus;
}

export interface EvidencePackBlockerSummary {
  blockerCount: number;
  /** Distinct allowlisted blocker kinds (never raw descriptions). */
  blockerKinds: string[];
}

export interface EvidencePackHumanTouchpointSummary {
  /** Total observed human touchpoints. */
  count: number;
  /**
   * AskUserQuestion-style touchpoints, detected only via the mapper's
   * known-safe marker message — never by reading arbitrary message text.
   */
  askUserQuestionCount: number;
}

/**
 * The conservative, data-derived reviewer-focus signals. Each kind fires only
 * when its condition is met by the event/beat evidence — the pack never
 * editorialises a risk that the data doesn't show.
 */
export type EvidencePackReviewerFocusKind =
  | "failed_checks"
  | "blockers_present"
  | "heavy_editing"
  | "no_tests_observed"
  | "human_touchpoint";

export interface EvidencePackReviewerFocusItem {
  kind: EvidencePackReviewerFocusKind;
  severity: "info" | "warning";
  /** Content-safe, count-based detail. Never raw payload text. */
  detail: string;
}

export interface EvidencePackRedactionSummary {
  /** Human-readable statement of the pack's privacy stance. */
  note: string;
  /** Explicit list of content categories deliberately omitted from the pack. */
  omitted: string[];
}

/**
 * A privacy-safe review artifact for a single observed agent session.
 *
 * Answers "what did the agent do, and what should I look at hardest?" without
 * a human reading the raw transcript. Carries no raw payload fields — see the
 * privacy contract at the top of this file.
 */
export interface EvidencePack {
  /** Deterministic, content-free id (a hash of safe session features). */
  id: string;
  /** ISO timestamp; injected, or defaulted to the session's `capturedAt`. */
  generatedAt: string;
  source: EvidencePackSource;
  session: EvidencePackSessionSummary;
  workItem: EvidencePackWorkItemSummary;
  activity: EvidencePackActivitySummary;
  filesAndArtifacts: EvidencePackArtifactSummary;
  quality: EvidencePackQualitySummary;
  blockers: EvidencePackBlockerSummary;
  humanTouchpoints: EvidencePackHumanTouchpointSummary;
  reviewerFocus: EvidencePackReviewerFocusItem[];
  redaction: EvidencePackRedactionSummary;
}
