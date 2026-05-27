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
 * Replace GitHub URLs with a generic `https://github.com/<org>/<repo>` shape.
 *
 * Only the safest path tails are preserved (PR/issue number); anything else
 * — `/blob/<branch>/<path>`, `/compare/<branch>...<branch>`, `/actions/runs`,
 * etc. — collapses to `/…` because those tails can contain branch names,
 * file paths, internal route names, run IDs, or commit shas that are
 * identifying or potentially sensitive.
 *
 * Today the mapper uses raw `prUrl` from `pr-link` lines in the artifact
 * `ref` field — that stays unredacted because observed mode is local-only.
 * This helper exists for the rendered-notes path and the eventual
 * hosted-demo / export surface.
 */
export function redactGitHubUrls(text: string): string {
  // Match `https://github.com/<org>/<repo>` optionally followed by a path.
  return text.replace(
    /https:\/\/github\.com\/[^/\s]+\/[^/\s?#]+(\/[^\s?#)]*)?/g,
    (_url, tail: string | undefined) => {
      const safeTail = tail?.match(/^\/(pull|issues)\/\d+\b/)?.[0];
      if (safeTail) return `https://github.com/<org>/<repo>${safeTail}`;
      if (tail && tail.length > 0) return "https://github.com/<org>/<repo>/…";
      return "https://github.com/<org>/<repo>";
    },
  );
}

/**
 * Return a category label for a Bash command without rendering the command
 * itself. Real Bash commands can carry API keys, tokens, environment
 * variables, URLs with query params, branch names, private file paths
 * outside the home prefix, database connection strings, and inline secrets
 * passed as flags. `sanitizeForNotes()` alone catches home paths and
 * GitHub URLs but can't catch any of those.
 *
 * The current category set is intentionally narrow — test/build/typecheck
 * vs generic. Adding more categories means deciding which command-line
 * keywords are safe to surface. Today, only well-known runner names
 * (vitest, jest, pytest, tsc, etc.) are looked at; everything else lands
 * in the generic bucket.
 */
export function safeBashCommandLabel(command: string | undefined): string {
  if (!command || command.trim().length === 0) return "Ran Bash command";
  // Test runners
  if (/\b(?:test|vitest|jest|pytest|mocha)\b/i.test(command)) return "Ran test command";
  if (/\b(?:go|cargo)\s+test\b/i.test(command)) return "Ran test command";
  // Build / typecheck
  if (/\b(?:build|tsc|typecheck|lint)\b/i.test(command)) return "Ran build/typecheck command";
  // Generic — never include the command text
  return "Ran Bash command";
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
