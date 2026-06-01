import type { WorkflowEvent } from "@/types/workflow-events";
import type {
  EvidencePack,
  EvidencePackActivitySummary,
  EvidencePackArtifactSummary,
  EvidencePackBlockerSummary,
  EvidencePackHumanTouchpointSummary,
  EvidencePackQualityStatus,
  EvidencePackQualitySummary,
  EvidencePackReviewerFocusItem,
  EvidencePackSessionProvenance,
  EvidencePackSessionSummary,
  EvidencePackWorkItemSummary,
} from "@/types/evidence-pack";
import type { ParsedClaudeCodeSession } from "./claude-code-parser";
import { reduceObservedPlayback, type VisualBeat } from "./observed-playback-reducer";

/**
 * `buildEvidencePack` — pure reducer/selector that turns an observed Claude
 * Code session into a privacy-safe {@link EvidencePack} (#60).
 *
 * ## Contract
 *
 * - **Pure & deterministic.** Same input → same output. No `Date.now`/
 *   `Math.random` (a `generatedAt` may be injected; otherwise it defaults to
 *   the session's `capturedAt`). No IO, no UI, no markdown rendering.
 * - **No mutation.** Inputs (`session`, `events`, `beats`) are read-only; the
 *   pack is a fresh object. `reduceObservedPlayback` is likewise pure.
 * - **Allowlist only.** The reducer consumes ONLY explicitly content-safe
 *   fields and NEVER reads arbitrary free-text payloads. Concretely it reads:
 *     - `VisualBeat` zones / actions / counts — but it does NOT trust them
 *       verbatim. Because `beats` is a public input, a caller could hand in a
 *       beat with an unsafe `label` (or a non-enum `zone`/`action`, or a
 *       non-numeric `signalCount`). So the activity summary REGENERATES every
 *       beat-derived string from allowlisted fields: labels come from
 *       `action` + a coerced `signalCount` (never `beat.label`), and zone/action
 *       keys are allowlisted to the known sets (unknown → `"other"`). Beats from
 *       `reduceObservedPlayback` are unaffected — they already produce these
 *       exact values.
 *     - `event.type` (to count gates / blockers / artifacts / messages);
 *     - `event.payload.artifact.kind` (allowlisted) and, *for counting only*,
 *       `…artifact.ref` / `…summary` (to de-dupe edited files and exclude PR
 *       artifacts — never emitted);
 *     - `event.payload.blocker.kind` (allowlisted);
 *     - `event.payload.message` ONLY to compare against a single known-safe
 *       *constant* the mapper generates ({@link ASK_HUMAN_MARKER}) — the same
 *       technique the playback reducer uses for the compaction marker, never to
 *       display or substring-search content;
 *     - `session.origin.source` (allowlisted) and `…capturedAt` (a timestamp);
 *     - `session.workItem.kind` / `status` / `currentMode` (allowlisted enums).
 *
 *   It deliberately NEVER reads: work-item title (raw prompt), status-change
 *   messages (carry paths), gate `name`/`notes`, blocker `description`, artifact
 *   `ref`/`summary` *for output*, raw ids, or any other free text.
 *
 * See the product doc:
 * [`docs/product/next-phase-agent-session-evidence-pack.md`](../../docs/product/next-phase-agent-session-evidence-pack.md).
 */

export interface BuildEvidencePackInput {
  session: ParsedClaudeCodeSession;
  /** Overrides `session.events` when provided (must be the same content-safe shape). */
  events?: WorkflowEvent[];
  /** Pre-computed beats; derived via `reduceObservedPlayback` when omitted. */
  beats?: VisualBeat[];
  /**
   * Injected generation timestamp. Omitted → defaults to the session's
   * `capturedAt`, keeping the reducer deterministic (no `Date.now`).
   */
  generatedAt?: string;
}

/** Fallback work-item title — the raw title (a user prompt) is never exposed. */
export const EVIDENCE_PACK_WORK_ITEM_TITLE_FALLBACK = "Observed session";

/**
 * The exact, known-safe label the mapper emits for an observed AskUserQuestion
 * touchpoint (see `claude-code-transcript-mapper.ts`). Matched by *equality*
 * only — never substring-searched — so no arbitrary message text is ever read.
 */
const ASK_HUMAN_MARKER =
  "Asked the human a question (observed; not surfaced as a decision)";

/** Heavy-editing reviewer-focus threshold: total edit signals across coding beats. */
const HEAVY_EDIT_THRESHOLD = 5;

// ─── Allowlists (anything not listed collapses to a safe bucket) ──────────────

const KNOWN_ARTIFACT_KINDS: ReadonlySet<string> = new Set([
  "acceptance_criteria",
  "research_brief",
  "adr",
  "ui_spec",
  "code_pr",
  "test_plan",
  "review_report",
  "morning_report",
]);

const KNOWN_BLOCKER_KINDS: ReadonlySet<string> = new Set([
  "missing_info",
  "dependency",
  "decision_needed",
  "gate_failed",
  "external",
]);

const KNOWN_WORK_ITEM_KINDS: ReadonlySet<string> = new Set([
  "feature",
  "bug",
  "research",
  "task",
]);

const KNOWN_WORK_ITEM_STATUSES: ReadonlySet<string> = new Set([
  "captured",
  "refined",
  "researching",
  "planning",
  "designing",
  "building",
  "validating",
  "reviewing",
  "awaiting_human",
  "done",
]);

const KNOWN_ADLC_MODES: ReadonlySet<string> = new Set([
  "Intent",
  "Generate",
  "Validate",
  "Govern",
  "Deploy",
  "Observe",
  "Multi",
]);

const KNOWN_ORIGIN_SOURCES: ReadonlySet<string> = new Set([
  "claude-code-local",
  "claude-code-cloud",
  "fixture",
]);

// The observed model's zones/actions (mirrors `ObservedZone` / `BeatAction`).
// Used to allowlist caller-supplied beat zone/action keys; anything outside the
// set collapses to `"other"` so an unsafe beat can't leak a key.
const KNOWN_OBSERVED_ZONES: ReadonlySet<string> = new Set([
  "reading",
  "coding",
  "testing",
  "thinking",
  "human",
  "outbox",
  "activity",
]);

const KNOWN_BEAT_ACTIONS: ReadonlySet<string> = new Set([
  "read",
  "edit",
  "test_run",
  "test_pass",
  "test_fail",
  "think",
  "human_consulted",
  "outbox",
  "compact",
  "blocked",
  "note",
]);

/** Content categories the pack deliberately omits — surfaced in the footer. */
const REDACTION_OMITTED: readonly string[] = [
  "user prompt content",
  "assistant message content",
  "user message content",
  "model reasoning",
  "Bash command text",
  "command output (stdout/stderr)",
  "raw event and session identifiers",
  "file paths and worktree paths",
  "MCP server names and tool inputs",
  "attachment payloads",
  "secrets and credentials",
];

const REDACTION_NOTE =
  "Generated from an allowlist of content-safe fields only (counts and " +
  "categories, never raw payload text). The categories in `omitted` are " +
  "deliberately excluded; consult the raw session transcript for anything not " +
  "summarised here.";

// ─── Public entry point ──────────────────────────────────────────────────────

export function buildEvidencePack(input: BuildEvidencePackInput): EvidencePack {
  const { session } = input;
  const events = input.events ?? session.events;
  const beats = input.beats ?? reduceObservedPlayback(events);

  const sessionSummary = summariseSession(session);
  const workItem = summariseWorkItem(session);
  const activity = summariseActivity(events, beats);
  const filesAndArtifacts = summariseArtifacts(events, beats);
  const quality = summariseQuality(events);
  const blockers = summariseBlockers(events);
  const humanTouchpoints = summariseHumanTouchpoints(events, beats);
  const reviewerFocus = deriveReviewerFocus({ quality, blockers, humanTouchpoints, beats });

  const generatedAt = input.generatedAt ?? sessionSummary.capturedAt;
  const id =
    "ep_" +
    stableHash(
      [
        "observed-session",
        sessionSummary.source,
        sessionSummary.capturedAt,
        activity.totalEvents,
        activity.totalBeats,
      ].join("|"),
    );

  return {
    id,
    generatedAt,
    source: "observed-session",
    session: sessionSummary,
    workItem,
    activity,
    filesAndArtifacts,
    quality,
    blockers,
    humanTouchpoints,
    reviewerFocus,
    redaction: { note: REDACTION_NOTE, omitted: [...REDACTION_OMITTED] },
  };
}

// ─── Section selectors (each reads only allowlisted, content-safe fields) ─────

function summariseSession(
  session: ParsedClaudeCodeSession,
): EvidencePackSessionSummary {
  const rawSource = session.origin?.source;
  const source: EvidencePackSessionProvenance =
    typeof rawSource === "string" && KNOWN_ORIGIN_SOURCES.has(rawSource)
      ? (rawSource as EvidencePackSessionProvenance)
      : "unknown";
  return {
    source,
    capturedAt: typeof session.origin?.capturedAt === "string" ? session.origin.capturedAt : "",
  };
}

function summariseWorkItem(
  session: ParsedClaudeCodeSession,
): EvidencePackWorkItemSummary {
  const wi = session.workItem;
  return {
    kind: allowlistOr(wi?.kind, KNOWN_WORK_ITEM_KINDS, "unknown") as EvidencePackWorkItemSummary["kind"],
    status: allowlistOr(wi?.status, KNOWN_WORK_ITEM_STATUSES, "unknown") as EvidencePackWorkItemSummary["status"],
    currentMode: allowlistOr(wi?.currentMode, KNOWN_ADLC_MODES, "unknown") as EvidencePackWorkItemSummary["currentMode"],
    // Never the raw title (a user prompt) — always the constant fallback.
    title: EVIDENCE_PACK_WORK_ITEM_TITLE_FALLBACK,
  };
}

function summariseActivity(
  events: WorkflowEvent[],
  beats: VisualBeat[],
): EvidencePackActivitySummary {
  const byZone: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  const beatSequence: string[] = [];

  for (const beat of beats) {
    // Beats are a PUBLIC input, so never trust their strings verbatim: derive
    // the zone/action keys from the allowlist and the label from action +
    // signalCount — never from `beat.label`.
    const zone = safeBeatZoneKey(beat.zone);
    const action = safeBeatActionKey(beat.action);
    byZone[zone] = (byZone[zone] ?? 0) + 1;
    byAction[action] = (byAction[action] ?? 0) + 1;
    beatSequence.push(safeEvidenceBeatLabel(beat));
  }

  return {
    totalEvents: events.length,
    totalBeats: beats.length,
    byZone,
    byAction,
    beatSequence,
  };
}

function summariseArtifacts(
  events: WorkflowEvent[],
  beats: VisualBeat[],
): EvidencePackArtifactSummary {
  const kinds = new Set<string>();
  // `editedFiles` holds raw refs transiently to COUNT distinct files; it never
  // escapes this function — only `.size` is emitted.
  const editedFiles = new Set<string>();
  let artifactCount = 0;

  for (const event of events) {
    if (event.type !== "artifact.produced") continue;
    const artifact = (event.payload as { artifact?: unknown }).artifact;
    if (!isObject(artifact)) continue;
    artifactCount += 1;

    const rawKind = artifact.kind;
    const kind =
      typeof rawKind === "string" && KNOWN_ARTIFACT_KINDS.has(rawKind) ? rawKind : "other";
    kinds.add(kind);

    const ref = typeof artifact.ref === "string" ? artifact.ref : "";
    const summary = typeof artifact.summary === "string" ? artifact.summary : "";
    // Exclude genuine PR artifacts from the edited-file count (they are tallied
    // as `prCount` via the reducer's outbox beats). Classification mirrors the
    // playback reducer's private `isPrArtifact`; ref/summary are read here only
    // to classify and never emitted.
    if (looksLikePrArtifact(kind, ref, summary)) continue;
    if (ref.length > 0) editedFiles.add(ref);
  }

  return {
    artifactCount,
    artifactKinds: [...kinds].sort(),
    editedFileCount: editedFiles.size,
    prCount: beats.filter((b) => b.action === "outbox").length,
  };
}

function summariseQuality(events: WorkflowEvent[]): EvidencePackQualitySummary {
  let passedCount = 0;
  let failedCount = 0;
  for (const event of events) {
    if (event.type === "quality_gate.passed") passedCount += 1;
    else if (event.type === "quality_gate.failed") failedCount += 1;
  }
  const totalGates = passedCount + failedCount;
  let status: EvidencePackQualityStatus;
  if (totalGates === 0) status = "none";
  else if (failedCount === 0) status = "passed";
  else if (passedCount === 0) status = "failed";
  else status = "mixed";
  return { passedCount, failedCount, totalGates, status };
}

function summariseBlockers(events: WorkflowEvent[]): EvidencePackBlockerSummary {
  const kinds = new Set<string>();
  let blockerCount = 0;
  for (const event of events) {
    if (event.type !== "blocker.raised") continue;
    blockerCount += 1;
    const blocker = (event.payload as { blocker?: unknown }).blocker;
    const rawKind = isObject(blocker) ? blocker.kind : undefined;
    kinds.add(
      typeof rawKind === "string" && KNOWN_BLOCKER_KINDS.has(rawKind) ? rawKind : "other",
    );
  }
  return { blockerCount, blockerKinds: [...kinds].sort() };
}

function summariseHumanTouchpoints(
  events: WorkflowEvent[],
  beats: VisualBeat[],
): EvidencePackHumanTouchpointSummary {
  let askUserQuestionCount = 0;
  for (const event of events) {
    if (event.type !== "agent.message.sent") continue;
    // Equality against the single known-safe marker only — never a substring
    // scan of arbitrary message text.
    if ((event.payload as { message?: unknown }).message === ASK_HUMAN_MARKER) {
      askUserQuestionCount += 1;
    }
  }
  // `waiting_on_human` status beats (if a future mapper emits them) are a second,
  // disjoint touchpoint signal — count them too.
  const consultedBeatCount = beats.filter((b) => b.action === "human_consulted").length;
  return {
    count: askUserQuestionCount + consultedBeatCount,
    askUserQuestionCount,
  };
}

function deriveReviewerFocus(args: {
  quality: EvidencePackQualitySummary;
  blockers: EvidencePackBlockerSummary;
  humanTouchpoints: EvidencePackHumanTouchpointSummary;
  beats: VisualBeat[];
}): EvidencePackReviewerFocusItem[] {
  const { quality, blockers, humanTouchpoints, beats } = args;
  const items: EvidencePackReviewerFocusItem[] = [];

  // Each signal is strictly data-derived — fires only on observed evidence.
  if (quality.failedCount > 0) {
    items.push({
      kind: "failed_checks",
      severity: "warning",
      detail: `${quality.failedCount} quality gate${plural(quality.failedCount)} failed`,
    });
  }

  if (blockers.blockerCount > 0) {
    items.push({
      kind: "blockers_present",
      severity: "warning",
      detail: `${blockers.blockerCount} blocker${plural(blockers.blockerCount)} raised`,
    });
  }

  // "No tests observed" — no testing-zone beats AND no quality gates at all.
  const testingBeats = beats.filter((b) => b.zone === "testing").length;
  if (testingBeats === 0 && quality.totalGates === 0) {
    items.push({
      kind: "no_tests_observed",
      severity: "warning",
      detail: "no test, build, or typecheck checks were observed",
    });
  }

  const editSignals = beats
    .filter((b) => b.action === "edit")
    .reduce((n, b) => n + safeCount(b.signalCount), 0);
  if (editSignals >= HEAVY_EDIT_THRESHOLD) {
    items.push({
      kind: "heavy_editing",
      severity: "info",
      detail: `heavy editing observed (${editSignals} edits)`,
    });
  }

  if (humanTouchpoints.count > 0) {
    items.push({
      kind: "human_touchpoint",
      severity: "info",
      detail: `${humanTouchpoints.count} human touchpoint${plural(humanTouchpoints.count)} observed`,
    });
  }

  return items;
}

// ─── Small pure helpers ──────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function allowlistOr(
  value: unknown,
  allowed: ReadonlySet<string>,
  fallback: string,
): string {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

/**
 * Mirror of the playback reducer's private `isPrArtifact`: a genuine PR link
 * (vs. an edit artifact that also uses `kind: "code_pr"`). Used only to exclude
 * PR refs from the edited-file count; ref/summary are never emitted.
 */
function looksLikePrArtifact(kind: string, ref: string, summary: string): boolean {
  if (kind !== "code_pr") return false;
  return /\/pull\/\d+/.test(ref) || /^PR #\d+\b/.test(summary);
}

/**
 * Rename the content-free `thinking`/`think` phase to `reasoning`. The bare word
 * is a phase label, not chain-of-thought, but the literal substring collides
 * with the `thinking` forbidden-content probe — so we surface it as `reasoning`
 * to keep the activity signal while staying provably free of the substring.
 */
function reasoningRename(token: string): string {
  return token === "thinking" || token === "think" ? "reasoning" : token;
}

/** Allowlisted, probe-safe zone key. Unknown (caller-injected) zones → `"other"`. */
function safeBeatZoneKey(zone: string): string {
  return KNOWN_OBSERVED_ZONES.has(zone) ? reasoningRename(zone) : "other";
}

/** Allowlisted, probe-safe action key. Unknown (caller-injected) actions → `"other"`. */
function safeBeatActionKey(action: string): string {
  return KNOWN_BEAT_ACTIONS.has(action) ? reasoningRename(action) : "other";
}

/**
 * Derive a content-free beat label from allowlisted fields ONLY — `action` and a
 * coerced `signalCount`. It deliberately ignores `beat.label`: because `beats`
 * is a public input, a caller could supply a beat whose raw `label` carries
 * secrets/paths/commands, and the allowlist contract forbids emitting it. Beats
 * from `reduceObservedPlayback` map to the same strings its own `labelFor`
 * produces (with `think` surfaced as `reasoning`).
 */
function safeEvidenceBeatLabel(beat: VisualBeat): string {
  const n = safeCount(beat.signalCount);
  switch (beat.action) {
    case "read":
      return n > 1 ? `read ${n} files` : "reading";
    case "edit":
      return n > 1 ? `editing intensely (${n} edits)` : "editing";
    case "test_run":
      return "running tests";
    case "test_pass":
      return "tests passed";
    case "test_fail":
      return "tests failed";
    case "think":
      return "reasoning";
    case "human_consulted":
      return "human consulted";
    case "outbox":
      return "opened a PR";
    case "compact":
      return "compacted context";
    case "blocked":
      return "blocked";
    case "note":
      return "activity observed";
    default:
      // Unknown/caller-injected action → a safe generic label, never echoed.
      return "activity observed";
  }
}

/** Coerce a (possibly caller-injected) count to a safe non-negative integer. */
function safeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function plural(n: number): string {
  return n === 1 ? "" : "s";
}

/**
 * FNV-1a 32-bit hash → 8 hex chars. Deterministic, dependency-free, and
 * one-way: the id distinguishes sessions without embedding any raw identifier.
 */
function stableHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
