import {
  parseRawTranscript,
  validateRawTranscript,
  type RawTranscriptLine,
} from "@/lib/claude-code-transcript";
import { mapTranscriptToSession } from "@/lib/claude-code-transcript-mapper";
import { reduceObservedPlayback, type VisualBeat } from "@/lib/observed-playback-reducer";
import { buildEvidencePack } from "@/lib/evidence-pack";
import { renderEvidencePackMarkdown } from "@/lib/evidence-pack-markdown";
import { validateScenario } from "@/lib/validate-scenario";
import type { ParsedClaudeCodeSession } from "@/lib/claude-code-parser";
import type { Scenario } from "@/data/scenarios";

/**
 * Pure view-prep for the local transcript loader (#65) — the testable core of
 * `LocalTranscriptLoader.tsx`, in the same `.ts`/`.tsx` split as the rest of
 * observed mode.
 *
 * It takes the raw `.jsonl` text a user picked locally and runs it through the
 * EXISTING safe pipeline only:
 *
 *   parseRawTranscript → validateRawTranscript → mapTranscriptToSession
 *     → validateScenario (observed-mode safety gate)
 *     → reduceObservedPlayback   (content-free VisualBeat[])
 *     → buildEvidencePack → renderEvidencePackMarkdown   (content-safe markdown)
 *
 * ## Untrusted input
 *
 * The loaded file is treated as hostile. On any failure it returns a SAFE
 * summary — never the offending line or any raw content:
 *   - `parseRawTranscript` rethrows the underlying `JSON.parse` message, which
 *     can echo the malformed bytes, so we surface only a generic message + the
 *     numeric line number.
 *   - validation `issue.message` strings can echo a field value, so we surface
 *     only the issue COUNT and the first line number — never the messages.
 *   - mapping/render are wrapped so an unexpected throw can't bubble raw content.
 *
 * On success it returns only content-free outputs (beats + the already-safe
 * evidence markdown), which the loader renders through the same components the
 * bundled sample uses.
 */

export interface LocalTranscriptOk {
  ok: true;
  beats: VisualBeat[];
  /** The rendered Evidence Pack markdown (content-safe by construction). */
  evidenceMarkdown: string;
  beatCount: number;
  eventCount: number;
}

export interface LocalTranscriptError {
  ok: false;
  /** Safe, human-readable summary. Never contains raw file content. */
  message: string;
  /** Safe count of validation issues, when applicable. */
  issueCount?: number;
  /** Safe 1-based line number of the first problem, when known. */
  firstLine?: number;
}

export type LocalTranscriptResult = LocalTranscriptOk | LocalTranscriptError;

export function parseLocalTranscriptToObservedView(rawJsonl: string): LocalTranscriptResult {
  let lines: RawTranscriptLine[];
  try {
    lines = parseRawTranscript(rawJsonl);
  } catch (err) {
    // JSON.parse messages can include the offending bytes — surface only a
    // generic message and the numeric line number.
    return {
      ok: false,
      message: "Could not parse the file as JSONL — it isn't valid line-delimited JSON.",
      firstLine: parseErrorLine(err),
    };
  }

  if (lines.length === 0) {
    return { ok: false, message: "No transcript lines were found in the file." };
  }

  const issues = validateRawTranscript(lines);
  if (issues.length > 0) {
    // Surface only the count + first line — never `issue.message`, which can
    // echo a field value from the file.
    return {
      ok: false,
      message: "The file doesn't match the expected Claude Code transcript shape.",
      issueCount: issues.length,
      firstLine: issues[0].lineIndex,
    };
  }

  try {
    const session = mapTranscriptToSession(lines);

    // Defensive observed-mode safety gate (read-only invariants). Count only —
    // never surface the validator's issue text.
    if (validateScenario(asObservedScenario(session)).length > 0) {
      return { ok: false, message: "The transcript didn't pass the observed-mode safety check." };
    }

    // Safe render paths only — no raw payloads can reach these outputs.
    const beats = reduceObservedPlayback(session.events);
    const evidenceMarkdown = renderEvidencePackMarkdown(buildEvidencePack({ session }));
    return {
      ok: true,
      beats,
      evidenceMarkdown,
      beatCount: beats.length,
      eventCount: session.events.length,
    };
  } catch {
    // Any unexpected failure downstream of validation: fail safe, no content.
    return { ok: false, message: "Could not turn the transcript into a safe observed view." };
  }
}

/** Extract just the numeric line from `parseRawTranscript`'s error (safe). */
function parseErrorLine(err: unknown): number | undefined {
  const match = (err instanceof Error ? err.message : "").match(/at line (\d+)/);
  return match ? Number(match[1]) : undefined;
}

/** Wrap a parsed session as an observed scenario for the safety gate only. */
function asObservedScenario(session: ParsedClaudeCodeSession): Scenario {
  return {
    id: "observed-sample", // a valid id for the transient validation wrap
    title: "Local transcript",
    subtitle: "Loaded locally — read-only.",
    kind: session.workItem.kind,
    source: "observed",
    initialWorkItem: session.workItem,
    events: session.events,
    chain: session.chain,
    origin: session.origin,
  };
}
