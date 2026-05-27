# `.claude/hooks/`

PreToolUse hook scripts that enforce the P0–P7 permission ladder at runtime, complementing the `permissions.allow` / `permissions.deny` lists in `.claude/settings.json`.

## Files

| Hook | Matches | Blocks |
| --- | --- | --- |
| [bash-guard.sh](bash-guard.sh) | `Bash` | `pnpm/npm/yarn add/remove/update/uninstall`, `sudo`, `curl … \| sh`, force-push without lease, shell-write to `.env`, shell-write to `.github/workflows/` |
| [write-guard.sh](write-guard.sh) | `Edit`, `Write` | `package.json`, lockfiles (`pnpm-lock.yaml` / `package-lock.json` / `yarn.lock`), `.github/workflows/**`, `.env*`, `.claude/settings.json` |

## How they fit in

The two layers of enforcement:

1. **Static patterns** (`permissions.deny` in `settings.json`) catch verbatim dangerous commands and paths: `rm -rf`, `git push --force`, `gh pr merge`, edits to `.env` / workflows / settings. These are denied before the hook even runs.
2. **Dynamic patterns** (these scripts) catch what static patterns can't: any new dependency name (`pnpm add <anything>`), sudo escalation, pipe-to-shell, or writes to a protected file at any path depth.

Both layers exit code 2 (deny) when triggered. Claude Code sees the stderr message and stops the tool call.

## Override

Genuine cases — e.g. you legitimately want Mira to install a new dependency after a Decision is resolved — require an explicit interactive permission grant from the user. Don't loosen the hooks themselves without surfacing a Decision first.

## Per-permission mapping

These hooks enforce the levels from [docs/agents/permissions.md](../../docs/agents/permissions.md):

- **P6** (External tools / controlled integrations) — `pnpm add` blocked
- **P7** (Dangerous / human-only) — merge, deploy, deletes, force-push, secrets, CI config blocked

## Testing

```bash
# Allowed
echo '{"tool_name":"Bash","tool_input":{"command":"pnpm test"}}' | bash .claude/hooks/bash-guard.sh; echo $?
# → 0

# Denied
echo '{"tool_name":"Bash","tool_input":{"command":"pnpm add lodash"}}' | bash .claude/hooks/bash-guard.sh; echo $?
# → 2

echo '{"tool_name":"Edit","tool_input":{"file_path":"package.json"}}' | bash .claude/hooks/write-guard.sh; echo $?
# → 2
```

## What these still can't enforce

- Side effects of legitimate commands (a test that writes to a protected path goes through Bash, which is allowed)
- Network egress from inside a build script
- Long-running processes that fork to background

For those, lean on the [docs/governance/night-mode-policy.md](../../docs/governance/night-mode-policy.md) procedural controls and CI verification.
