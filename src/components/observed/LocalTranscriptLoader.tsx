"use client";

import { useState, type ChangeEvent } from "react";
import ObservedBeatTimeline from "./ObservedBeatTimeline";
import EvidencePackPanel from "./EvidencePackPanel";
import {
  parseLocalTranscriptToObservedView,
  type LocalTranscriptResult,
} from "./local-transcript-view";

/**
 * LocalTranscriptLoader — read-only, local-only `.jsonl` import for observed
 * mode (#65). Lets a user pick a Claude Code transcript from their own machine
 * and view it through the existing safe pipeline (timeline + Evidence Pack).
 *
 * Strictly local & read-only: the file is read in the browser via `file.text()`,
 * parsed by the pure `parseLocalTranscriptToObservedView`, and held in React
 * state only — never uploaded, persisted, or written anywhere. On failure it
 * shows a safe summary (count / line number), never the raw offending content.
 *
 * It renders only the content-free outputs (beats + the already-safe evidence
 * markdown) through the same `ObservedBeatTimeline` / `EvidencePackPanel`
 * components the bundled sample uses, so no raw transcript text can reach the UI.
 */
export default function LocalTranscriptLoader() {
  const [result, setResult] = useState<LocalTranscriptResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear the input so picking the same file again still re-triggers onChange.
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      setResult(parseLocalTranscriptToObservedView(text));
    } catch {
      setResult({ ok: false, message: "Could not read the selected file." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-lg border border-iris/30 bg-office-panel/60 p-3 flex flex-col gap-2"
      aria-label="Local transcript loader"
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-iris">
          Load a local transcript
        </h3>
        <span className="text-[10px] font-mono text-office-muted">local-only · read-only</span>
      </header>

      <p className="text-[10px] text-office-muted/80 leading-snug">
        Pick a Claude Code <span className="font-mono">.jsonl</span> session from your machine. It is
        parsed in your browser and shown through the same privacy-safe observed view — nothing is
        uploaded, saved, or sent anywhere.
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-[11px] inline-flex items-center gap-2 cursor-pointer rounded border border-iris/40 px-2 py-1 text-iris hover:bg-iris/10 transition">
          <span>Choose .jsonl file</span>
          <input
            type="file"
            accept=".jsonl,.json,.txt,application/json,text/plain"
            className="hidden"
            onChange={onFile}
            disabled={busy}
          />
        </label>
        {busy && <span className="text-[10px] text-office-muted">Reading…</span>}
        {result?.ok && (
          <>
            <span className="text-[10px] font-mono text-emerald-300">
              local transcript loaded · {result.beatCount} beats · {result.eventCount} events
            </span>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-office-line text-office-muted hover:text-office-text transition"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {result && !result.ok && (
        <div
          className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200"
          role="alert"
        >
          {result.message}
          {(result.issueCount !== undefined || result.firstLine !== undefined) && (
            <span className="font-mono text-amber-300/70">
              {" ("}
              {result.issueCount !== undefined
                ? `${result.issueCount} issue${result.issueCount === 1 ? "" : "s"}`
                : ""}
              {result.issueCount !== undefined && result.firstLine !== undefined ? "; " : ""}
              {result.firstLine !== undefined ? `first at line ${result.firstLine}` : ""}
              {")"}
            </span>
          )}
        </div>
      )}

      {result?.ok && (
        <div className="flex flex-col gap-3 mt-1" aria-label="Loaded transcript view">
          <ObservedBeatTimeline beats={result.beats} />
          <EvidencePackPanel markdown={result.evidenceMarkdown} />
        </div>
      )}
    </section>
  );
}
