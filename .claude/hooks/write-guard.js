#!/usr/bin/env node
// Write/Edit guard. PreToolUse hook for the Edit and Write tools.
// Blocks edits to files that should only change via an explicit Decision.

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const raw = Buffer.concat(chunks).toString("utf8");

  // Fail closed on malformed input.
  let input;
  try {
    input = JSON.parse(raw || "{}");
  } catch {
    process.stderr.write(
      "BLOCKED by .claude/hooks/write-guard.js: malformed PreToolUse payload (fail-closed).\n" +
        `  raw: ${raw.slice(0, 200)}\n`,
    );
    process.exit(2);
  }

  const tool = String(input?.tool_name ?? "");
  const filePath = String(input?.tool_input?.file_path ?? "");
  if (!filePath) process.exit(0);

  const deny = (reason) => {
    process.stderr.write(
      `BLOCKED by .claude/hooks/write-guard.js: ${reason}\n` +
        `  tool: ${tool}  path: ${filePath}\n` +
        `  override: ask the user to grant explicit one-time permission.\n`,
    );
    process.exit(2);
  };

  // Normalize for comparison: use the basename + suffix-style checks.
  const checks = [
    { re: /(^|\/)package\.json$/, why: "edits to package.json require a Decision (deps/scripts)." },
    { re: /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/, why: "lockfiles are regenerated via approved package-manager commands (P6 with Decision)." },
    { re: /(^|\/)\.github\/workflows\//, why: "edits to .github/workflows/ require a Decision (CI / security surface, P7)." },
    { re: /(^|\/)\.env($|\.[^/]*$)/, why: "writing to .env files is not permitted (secrets surface)." },
    { re: /(^|\/)\.claude\/settings(\.local)?\.json$/, why: "edits to .claude/settings.json change agent permissions — require a Decision." },
    { re: /(^|\/)\.claude\/hooks\//, why: "edits to .claude/hooks/ change runtime policy — require a Decision." },
    { re: /(^|\/)\.claude\/agents\//, why: "edits to .claude/agents/ change agent behavior — require a Prompt issue + Decision." },
  ];

  for (const { re, why } of checks) {
    if (re.test(filePath)) deny(why);
  }

  process.exit(0);
});
