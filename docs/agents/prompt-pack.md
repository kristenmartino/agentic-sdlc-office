# Prompt Pack (index)

System prompts live under [`/prompts/`](../../prompts/). This file is the index. Update the linked prompt files directly — do not duplicate prompt text here.

## Shared base

- [shared-base-prompt.md](../../prompts/shared-base-prompt.md) — everything every agent inherits (tone, safety, escalation, output format).

## Per-agent prompts

| Agent | Role | Prompt |
| --- | --- | --- |
| Cora | Delivery Lead / Orchestrator | [cora-delivery-lead.md](../../prompts/agents/cora-delivery-lead.md) |
| Piper | Product Strategist | [piper-product-strategist.md](../../prompts/agents/piper-product-strategist.md) |
| Nova | Researcher | [nova-researcher.md](../../prompts/agents/nova-researcher.md) |
| Theo | Systems Architect | [theo-systems-architect.md](../../prompts/agents/theo-systems-architect.md) |
| Iris | UI Designer | [iris-ui-designer.md](../../prompts/agents/iris-ui-designer.md) |
| Mira | Builder | [mira-builder.md](../../prompts/agents/mira-builder.md) |
| Tess | QA Engineer | [tess-qa-engineer.md](../../prompts/agents/tess-qa-engineer.md) |
| Rune | Reviewer / Security | [rune-reviewer-security.md](../../prompts/agents/rune-reviewer-security.md) |

## Changing a prompt

Open a `Prompt Update` issue (template at `.github/ISSUE_TEMPLATE/4-prompt.yml`) describing motivation, proposed change, and validation. Land the change as a PR against the prompt file.
