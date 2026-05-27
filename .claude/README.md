# `.claude/`

Claude Code runtime config for this project.

## What's here

- [`settings.json`](settings.json) — project-wide permission rules (`allow` / `deny`) + PreToolUse hooks registration.
- [`hooks/`](hooks/) — bash scripts that catch dynamic patterns the static `deny` list can't (e.g. `pnpm add <anything>`). See [hooks/README.md](hooks/README.md).
- [`agents/`](agents/) — eight subagent definitions matching the office roles.

## Two-layer enforcement

The P0–P7 permission ladder in [docs/agents/permissions.md](../docs/agents/permissions.md) is now enforced two ways:

1. **Subagent tool scoping** in [agents/*.md](agents/) — each agent only gets the tools it needs (Nova/Rune have no Write/Edit; only Cora has `Task`).
2. **Project-wide deny rules + hooks** in [settings.json](settings.json) + [hooks/](hooks/) — catch dangerous commands and protected-file edits regardless of which agent attempted them.

If the two ever drift, the hooks/settings layer wins (it's the runtime gate).

## `agents/`

Eight subagent definitions, one per office role:

| File | Agent | Permission | Tools |
| --- | --- | --- | --- |
| `cora-delivery-lead.md` | Cora | P6 | Read, Grep, Glob, Task, Bash |
| `piper-product-strategist.md` | Piper | P2 | Read, Write, Edit, Grep, Glob |
| `nova-researcher.md` | Nova | P1 | Read, Grep, Glob, WebFetch, WebSearch |
| `theo-systems-architect.md` | Theo | P2 | Read, Write, Edit, Grep, Glob |
| `iris-ui-designer.md` | Iris | P2 | Read, Write, Edit, Grep, Glob |
| `mira-builder.md` | Mira | P5 | Read, Write, Edit, Bash, Grep, Glob |
| `tess-qa-engineer.md` | Tess | P3 | Read, Write, Edit, Bash, Grep, Glob |
| `rune-reviewer-security.md` | Rune | P1 | Read, Grep, Glob, Bash |

Each file is self-contained for Claude Code (frontmatter + concise role spec) and links back to the canonical, fuller prompt in [`/prompts/agents/`](../prompts/agents/). The canonical prompts are the source of truth; these files are the runtime view.

## Why both `/prompts/agents/` and `.claude/agents/`?

- **`/prompts/agents/`** holds the *product* source of truth — what the agent is, how it relates to the office model, full role spec. Versioned with the product.
- **`.claude/agents/`** holds the *runtime* view Claude Code reads — focused on what tools the agent has, what guardrails apply during execution, and what it must escalate.

If the two ever drift, the canonical `/prompts/` file wins. The `.claude/` file should be updated to match.

## Updating a subagent

1. Open a Prompt issue: `[Prompt]: ...` using `.github/ISSUE_TEMPLATE/4-prompt.yml`.
2. Edit the canonical `/prompts/agents/<agent>.md`.
3. Update the corresponding `.claude/agents/<agent>.md` to reflect any runtime-relevant changes (tools, guardrails).
4. Update `docs/agents/agent-registry.md` if the agent's role, room, or modes changed.
