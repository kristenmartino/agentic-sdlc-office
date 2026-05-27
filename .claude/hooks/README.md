# `.claude/hooks/`

PreToolUse hook scripts that enforce the P0–P7 permission ladder at runtime, complementing the `permissions.allow` / `permissions.deny` lists in `.claude/settings.json`.

## Files

| Hook | Matches | Blocks |
| --- | --- | --- |
| [bash-guard.js](bash-guard.js) | `Bash` | `pnpm/npm/yarn/bun add/remove/update/uninstall`, `pnpm/npm/yarn install <pkg>`, `npx`, `bunx`, `pnpm dlx`, all force-push variants (`--force` / `-f` / `--force-with-lease` / `--force-if-includes`), `sudo`, `curl … \| sh`, shell writes to `.env` / `.github/workflows/` / `.claude/hooks/` / `.claude/agents/`, `rm -rf` |
| [write-guard.js](write-guard.js) | `Edit`, `Write`, `MultiEdit` | `package.json`, lockfiles (`pnpm-lock.yaml` / `package-lock.json` / `yarn.lock`), `.github/workflows/**`, `.env*`, `.claude/settings.json`, **`.claude/hooks/**`**, **`.claude/agents/**`** |
| [hooks.test.ts](hooks.test.ts) | — | Vitest smoke tests for both hooks. Runs in CI via `pnpm test`. |

## Why Node, not bash

Earlier versions of these hooks were `.sh` scripts that shelled out to `jq` for JSON parsing. Now they're Node scripts so:

- no `jq` dependency (Claude Code already requires Node)
- testable with `vitest` via `spawnSync("node", [hook])`
- cross-platform (Windows users can run them under WSL or native Node)

## Two-layer enforcement

1. **Static patterns** (`permissions.deny` in [settings.json](../settings.json)) catch verbatim dangerous commands and paths. Caught before the hook even runs.
2. **Dynamic patterns** (these scripts) catch what static matches can't: any new package name (`pnpm install <anything>`), all variants of `npx`, all force-push flags, writes to a protected file at any path depth.

Both exit code 2 (deny) when triggered. Claude Code surfaces the stderr message and aborts the tool call.

## Override

Genuine cases (e.g. you've resolved a Decision authorizing `pnpm add eslint-plugin-foo`) require an explicit interactive permission grant. Don't loosen the hook scripts themselves — surface a Decision first.

## Per-permission mapping

These hooks enforce the levels from [docs/agents/permissions.md](../../docs/agents/permissions.md):

- **P6** (External tools / controlled integrations): package installs / removes / `npx` / `dlx` all gated
- **P7** (Dangerous / human-only): merge, deploy, deletes, every force-push variant, secrets, CI config, hook config, agent config all gated

## Testing locally

```bash
pnpm test
# 43 hook tests + 12 reducer/validator tests
```

## What these still can't enforce

- Side effects of legitimate commands (a test that writes to a protected path goes through Bash, which is allowed)
- Network egress from inside a build script
- Long-running processes that fork to background

For those, lean on [docs/governance/night-mode-policy.md](../../docs/governance/night-mode-policy.md) procedural controls and CI verification.
