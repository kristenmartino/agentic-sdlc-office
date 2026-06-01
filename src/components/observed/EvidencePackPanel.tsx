"use client";

import { downloadEvidencePackMarkdown } from "./evidence-pack-download";

/**
 * EvidencePackPanel — read-only, in-app view of the Agent Session Evidence Pack
 * (#71). Surfaces the markdown artifact from `renderEvidencePackMarkdown` (#61)
 * inside observed mode, alongside the observed timeline, with a markdown
 * download (#63).
 *
 * DUMB BY DESIGN. It receives ONLY the already-rendered, content-safe markdown
 * string (or `null`) — never the session, events, beats, or raw transcript. All
 * privacy enforcement happens upstream (`buildEvidencePack` /
 * `renderEvidencePackMarkdown`); this component just displays the string and can
 * download it. It renders nothing when there is no pack (e.g. scripted
 * scenarios), so it is safe to mount anywhere and is gated cleanly.
 *
 * The markdown is shown as read-only preformatted text — faithful to the
 * artifact and enough to judge whether the report reads well. (A richer
 * markdown→HTML rendering is intentionally out of scope here.)
 */
export default function EvidencePackPanel({ markdown }: { markdown: string | null }) {
  if (!markdown) return null;

  return (
    <section
      className="rounded-lg border border-iris/30 bg-office-panel/60 p-3 flex flex-col gap-2"
      aria-label="Evidence Pack"
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-iris">
          Evidence Pack
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-office-muted">
            privacy-safe · read-only
          </span>
          <button
            type="button"
            onClick={() => downloadEvidencePackMarkdown(markdown)}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-iris/40 text-iris hover:bg-iris/10 transition"
            aria-label="Download Evidence Pack as markdown"
            title="Download this Evidence Pack as a .md file"
          >
            ↓ .md
          </button>
        </div>
      </header>

      <p className="text-[10px] text-office-muted/80 leading-snug">
        A skimmable, privacy-safe summary of this observed session — generated
        from an allowlist of content-safe fields. Read this instead of the raw
        transcript.
      </p>

      <pre
        className="m-0 max-h-[480px] overflow-y-auto whitespace-pre-wrap break-words rounded border border-office-line/60 bg-office-bg/40 p-3 font-mono text-[11px] leading-relaxed text-office-text"
        aria-label="Evidence Pack markdown"
      >
        {markdown}
      </pre>
    </section>
  );
}
