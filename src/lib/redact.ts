/**
 * Redaction helpers for content sourced from real Claude Code transcripts.
 *
 * The mapper consumes raw transcript output (Bash stderr, Edit diffs, PR
 * URLs, tool arguments) and threads some of it into office events for
 * activity-log display. Most of that content is *informational* — useful
 * for understanding what the agent did — but a chunk of it is sensitive:
 *
 *   - Bash stderr can include local paths, environment variables, internal
 *     test names, stack traces, and snippets of code or config.
 *   - File paths typically include the user's home directory name.
 *   - PR URLs may name private repositories.
 *
 * This module centralises the "is this safe to render?" decisions so the
 * mapper doesn't end up with ad-hoc redaction sprinkled through it. Every
 * helper accepts a string and returns a string; there are no side effects.
 *
 * Conservative on purpose: false positives (over-redacting) are fine
 * because raw content is also available in the transcript itself; the
 * activity log is a human-readable view, not the source of truth.
 */

export interface SanitizeOptions {
  /** Maximum length of the returned string. Defaults to 120. */
  maxLen?: number;
}

/**
 * Replace POSIX-style home directories with `/<HOME>/`. Catches the three
 * common parents we've observed in real transcripts: `/Users/<name>`,
 * `/home/<name>`, and `/root` (which is rare but identifying).
 */
export function redactHomePaths(text: string): string {
  return text
    .replace(/\/Users\/[^/\s]+/g, "/<HOME>")
    .replace(/\/home\/[^/\s]+/g, "/<HOME>")
    .replace(/\b[A-Z]:\\Users\\[^\\\s]+/g, "C:\\Users\\<HOME>");
}

/**
 * Replace GitHub URLs with a generic `https://github.com/<org>/<repo>`
 * shape. Preserves the path tail (`/pull/42`, `/issues/100`, etc.) because
 * the issue/PR number is identifying but not as sensitive as the org/repo.
 *
 * Today the mapper uses raw `prUrl` from `pr-link` lines in the artifact
 * `ref` field — that stays unredacted because observed mode is local-only.
 * This helper exists for the eventual hosted-demo / export path.
 */
export function redactGitHubUrls(text: string): string {
  return text.replace(
    /https:\/\/github\.com\/[^/\s]+\/[^/\s?#]+/g,
    "https://github.com/<org>/<repo>",
  );
}

/**
 * Truncate a string with an ellipsis if it exceeds `n` characters.
 * Trims trailing whitespace before applying the ellipsis so the cut
 * doesn't read as `something    …`.
 */
export function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  return `${text.slice(0, n - 1).trimEnd()}…`;
}

/**
 * One-stop sanitiser for any string that might be displayed in office
 * events (gate notes, message bodies, artifact summaries) and might
 * carry user-identifying data:
 *
 *   1. Redact home paths
 *   2. Redact GitHub URLs (org/repo only — issue/PR number is preserved)
 *   3. Take only the first line — stack traces and multi-line tool output
 *      are usually too much for an activity log entry anyway.
 *   4. Truncate to `maxLen` characters.
 *
 * Result: a single short line, no usernames, no private repo names,
 * no leaked stack traces.
 */
export function sanitizeForNotes(text: string, opts: SanitizeOptions = {}): string {
  const maxLen = opts.maxLen ?? 120;
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";
  const firstLine = trimmed.split(/\r?\n/)[0];
  const redacted = redactGitHubUrls(redactHomePaths(firstLine));
  return truncate(redacted, maxLen);
}
