/**
 * Export helper for the Evidence Pack panel (#63).
 *
 * Scope: download the ALREADY-RENDERED markdown string as a `.md` file, in the
 * browser, on demand. It receives only the content-safe markdown string — never
 * the session, events, beats, or any raw payload — so the export surface
 * inherits the same privacy boundary as the panel. No file loader, no clipboard,
 * no GitHub writes, no network.
 *
 * The `.ts`/`.tsx` split matches the rest of observed mode: the pure descriptor
 * (`buildEvidencePackBlobParts`) is node-testable, and `downloadEvidencePackMarkdown`
 * is the thin DOM trigger (a no-op off the browser, e.g. during SSR or in tests).
 */

/**
 * Fixed, content-safe download filename. Deliberately NOT derived from the
 * session — a session-based name could leak an id/slug. The pack's own id lives
 * inside the markdown, which is enough.
 */
export const EVIDENCE_PACK_DOWNLOAD_FILENAME = "agent-session-evidence-pack.md";

export interface EvidencePackBlobParts {
  filename: string;
  /** MIME type for the Blob. */
  type: string;
  /** File body — the rendered markdown, passed through verbatim. */
  content: string;
}

/**
 * Pure descriptor for the download. Passes the markdown through unchanged (no
 * transformation that could add or expose content) under a constant filename.
 */
export function buildEvidencePackBlobParts(markdown: string): EvidencePackBlobParts {
  return {
    filename: EVIDENCE_PACK_DOWNLOAD_FILENAME,
    type: "text/markdown;charset=utf-8",
    content: markdown,
  };
}

/**
 * Trigger a browser download of the Evidence Pack markdown. No-op when there is
 * no DOM (SSR / unit tests) or no markdown, so it's safe to call unconditionally
 * from a click handler.
 */
export function downloadEvidencePackMarkdown(markdown: string | null | undefined): void {
  if (!markdown) return;
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return;
  }

  const { filename, type, content } = buildEvidencePackBlobParts(markdown);
  const url = URL.createObjectURL(new Blob([content], { type }));
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
