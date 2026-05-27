#!/usr/bin/env node
// Bash command guard. PreToolUse hook for the Bash tool.
//
// Reads tool-call JSON from stdin. Returns:
//   exit 0          → allow
//   exit 2          → deny (Claude surfaces stderr)
//
// Fail-closed: malformed input denies (safer default for unattended runs).
//
// Catches dynamic patterns that .claude/settings.json's static `permissions.deny`
// can't (any new package name, all Node one-liners, force-push variants, lockfile flags).

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
      "BLOCKED by .claude/hooks/bash-guard.js: malformed PreToolUse payload (fail-closed).\n" +
        `  raw: ${raw.slice(0, 200)}\n`,
    );
    process.exit(2);
  }

  const command = String(input?.tool_input?.command ?? "");
  if (!command) process.exit(0);

  const deny = (reason) => {
    process.stderr.write(
      `BLOCKED by .claude/hooks/bash-guard.js: ${reason}\n` +
        `  command: ${command}\n` +
        `  override: ask the user to grant explicit one-time permission for this exact command.\n`,
    );
    process.exit(2);
  };

  // ---- Sudo / root escalation ----
  if (/(^|[\s;&|()`])sudo(\s|$)/.test(command)) {
    deny("sudo is not permitted in this repo.");
  }

  // ---- Pipe-to-shell ----
  if (/(curl|wget|fetch)\b[^|]*\|\s*(sh|bash|zsh|node|python|python3|ruby|perl)\b/.test(command)) {
    deny("piping remote content into a shell is not permitted.");
  }

  // ---- Node one-liners ----
  // Block `node -e`, `node --eval`, `node -p`, `node --print`. They bypass write-guard
  // because writes happen inside the spawned script, not via Claude's Edit/Write tool.
  if (/(^|[\s;&|])node\s+(--?eval|-e|-p|--print)(\s|=|$)/.test(command)) {
    deny("node one-liners (-e / --eval / -p / --print) bypass write-guard — require explicit approval.");
  }

  // ---- Package manager: add/remove/uninstall/update/upgrade — always denied (P6) ----
  if (/(^|[\s;&|])(pnpm|npm|yarn|bun)\s+(add|remove|uninstall|update|upgrade)\b/.test(command)) {
    deny("package manager add/remove/update requires a Decision Inbox entry (P6).");
  }

  // ---- Package manager: install/i ----
  //   Allowed: `pnpm install`, `pnpm install --frozen-lockfile`, `pnpm install --offline`
  //   Denied:
  //     - any positional package arg (e.g. `pnpm install lodash`)
  //     - any flag that mutates the lockfile
  const installMatch = command.match(/(^|[\s;&|])((pnpm|npm|yarn|bun)\s+(install|i))(.*)$/);
  if (installMatch) {
    const rest = installMatch[5] ?? "";
    const tokens = rest.trim().split(/\s+/).filter(Boolean);
    const hasPositional = tokens.some((t) => t && !t.startsWith("-"));
    if (hasPositional) {
      deny("installing a specific package requires a Decision Inbox entry (P6). Use 'pnpm install --frozen-lockfile' to refresh from lockfile.");
    }
    // Block lockfile-mutating flags. `--frozen-lockfile` and `--offline` are explicitly allowed.
    const lockfileMutatingFlags = [
      "--lockfile-only",
      "--fix-lockfile",
      "--package-lock-only",
      "--mode=update-lockfile",
      "--resolution-only",
    ];
    if (lockfileMutatingFlags.some((f) => rest.includes(f))) {
      deny("lockfile-mutating install flag detected — requires a Decision (P6). Allowed: --frozen-lockfile, --offline.");
    }
  }

  // ---- One-off package executors ----
  if (/(^|[\s;&|])(npx|bunx)\s+/.test(command)) {
    deny("npx / bunx execute remote packages — requires explicit approval (P6).");
  }
  if (/(^|[\s;&|])(pnpm|npm|yarn)\s+dlx\s+/.test(command)) {
    deny("pnpm/npm/yarn dlx executes remote packages — requires explicit approval (P6).");
  }

  // ---- Force-push variants ----
  if (/git\s+push\b/.test(command)) {
    if (/(\s|=)(--force|--force-with-lease|--force-if-includes|-f)(\b|=|$)/.test(command)) {
      deny("force-push of any variant is P7 (rewrites history) — requires explicit human approval.");
    }
  }

  // ---- Shell-write to .env ----
  if (/(^|[\s;&|])(echo|printf|cat|tee)\b[^>]*>>?\s*\.env(\b|\s|$)/.test(command)) {
    deny("writing to .env via shell is not permitted.");
  }

  // ---- Shell-write to .github/workflows/ ----
  if (/\.github\/workflows\//.test(command) && /(>>?|\btee\b|\bcp\s|\bmv\s|\brm\s)/.test(command)) {
    deny("writing to .github/workflows/ via shell is not permitted (P7 — CI/security surface).");
  }

  // ---- Shell-write to .claude/hooks/ or .claude/agents/ ----
  if (/\.claude\/(hooks|agents)\//.test(command) && /(>>?|\btee\b|\bcp\s|\bmv\s|\brm\s)/.test(command)) {
    deny("modifying .claude/hooks/ or .claude/agents/ via shell is not permitted (changes runtime policy).");
  }

  // ---- Mass deletes ----
  if (/(^|[\s;&|])rm\s+-[rfRF]+\s+/.test(command)) {
    deny("recursive rm is not permitted via this hook — verify path and ask for explicit approval.");
  }

  // All other commands fall through to the static permissions.allow list in settings.json.
  process.exit(0);
});
