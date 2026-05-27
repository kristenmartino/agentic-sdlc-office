#!/usr/bin/env bash
# Bash command guard. Runs as a PreToolUse hook for the Bash tool.
# Receives the tool-call payload on stdin as JSON and returns:
#   exit 0          → allow
#   exit 2          → deny (Claude sees stderr)
#   any other exit  → error (Claude sees stderr)
#
# The native `permissions.deny` list in settings.json catches the obvious
# patterns. This hook catches the patterns that are too dynamic for static
# string matches: `pnpm add` (any package), `package.json` deps edits in
# bash, force-push variants, sudo, and pipe-to-shell.

set -euo pipefail

# Read stdin once
INPUT="$(cat)"

# Extract the command. Tool input shape: { tool_name: "Bash", tool_input: { command: "..." } }
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

if [[ -z "$COMMAND" ]]; then
  exit 0
fi

deny() {
  echo "BLOCKED by .claude/hooks/bash-guard.sh: $1" >&2
  echo "  command: $COMMAND" >&2
  echo "  override: ask the user to grant explicit permission for this exact command." >&2
  exit 2
}

# Dependency installs / removes — require human decision per docs/governance/approval-policy.md (P6).
if [[ "$COMMAND" =~ (^|[[:space:];])((pnpm|npm|yarn)[[:space:]]+(add|remove|uninstall|update)[[:space:]]) ]]; then
  deny "package manager add/remove/update requires a Decision Inbox entry (P6)."
fi

# Sudo / root escalation — never warranted in this repo.
if [[ "$COMMAND" =~ (^|[[:space:];])sudo([[:space:]]|$) ]]; then
  deny "sudo is not permitted in this repo."
fi

# Pipe a remote download into a shell.
if [[ "$COMMAND" =~ (curl|wget).*\|[[:space:]]*(sh|bash|zsh) ]]; then
  deny "piping remote content into a shell is not permitted."
fi

# Force-push variants the deny list might miss.
if [[ "$COMMAND" =~ git[[:space:]]+push.*--force-with-lease=no ]]; then
  deny "force push without lease is not permitted."
fi

# Direct edits to .env via shell.
if [[ "$COMMAND" =~ (^|[[:space:];])(echo|printf|cat).*[\>][\>]?[[:space:]]*\.env ]]; then
  deny "writing to .env via shell is not permitted."
fi

# Anything writing to .github/workflows/ via shell.
if [[ "$COMMAND" =~ \.github/workflows/ ]] && [[ "$COMMAND" =~ ([\>]|tee|cp[[:space:]]|mv[[:space:]]) ]]; then
  deny "writing to .github/workflows/ via shell is not permitted (P7)."
fi

# Allow everything else (the permissions.deny in settings.json will catch the static patterns).
exit 0
