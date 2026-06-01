"use client";

import { useState, type ChangeEvent } from "react";
import {
  parseLocalTranscriptToObservedView,
  type LocalTranscriptResult,
} from "./local-transcript-view";

/**
 * LocalTranscriptLoader — read-only, local-only `.jsonl` import card for observed
 * mode (#65). Lets a user pick a Claude Code transcript from their own machine;
 * a successful load takes over the observed stage (handled by the parent
 * `ObservedStage`, #66 polish), replacing the bundled demo sample.
 *
 * CONTROLLED: this card owns only the transient "reading" state. The parsed
 * `result` is lifted up via `onResult` so the stage can switch its active source;
 * `onClear` returns to the bundled sample. The card itself renders only the
 * input, a safe status, and — on failure — a SAFE error summary (count / line
 * number), never the raw offending content. It does NOT render the loaded
 * timeline / Evidence Pack; the parent does, through the shared safe components.
 *
 * Strictly local & read-only: the file is read in the browser via `file.text()`,
 * parsed by the pure `parseLocalTranscriptToObservedView`, and held in React
 * state only — never uploaded, persisted, or written anywhere.
 */
export default function LocalTranscriptLoader({
  result,
  onResult,
  onClear,
}: {
  result: LocalTranscriptResult | null;
  onResult: (result: LocalTranscriptResult) => void;
  onClear: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear the input so picking the same file again still re-triggers onChange.
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      onResult(parseLocalTranscriptToObservedView(text));
    } catch {
      onResult({ ok: false, message: "Could not read the selected file." });
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
        uploaded, saved, or sent anywhere. A loaded transcript replaces the demo sample below until
        you clear it.
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
              onClick={onClear}
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
    </section>
  );
}
