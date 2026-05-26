# Agentic SDLC Office

A visual operating model for the Agentic Development Lifecycle (ADLC). An office of 8 specialist agents executes work concurrently across Intent / Generate / Validate / Govern / Deploy / Observe modes; a human governs from a Decision Inbox.

## Status

`v0.1` — Mock Visual Workflow Prototype. See [docs/product/mvp-scope.md](docs/product/mvp-scope.md) for the definition of done.

## How this repo is organized

- **Docs** hold stable knowledge — under `/docs`.
- **Prompts** hold agent system prompts — under `/prompts`.
- **Source code** under `/src` (TypeScript-first data model).
- **Visual assets** under `/assets` (source under `/assets/source`, exports under `/assets/exported`).
- **Issues** track work; **Project board** tracks state; **PRs** track implementation.

## Quick links

- Project brief: [docs/product/project-brief.md](docs/product/project-brief.md)
- ADLC model: [docs/product/adlc-model.md](docs/product/adlc-model.md)
- MVP scope: [docs/product/mvp-scope.md](docs/product/mvp-scope.md)
- Now / Next / Later / Never: [docs/product/now-next-later-never.md](docs/product/now-next-later-never.md)
- Agent roles: [docs/agents/role-catalog.md](docs/agents/role-catalog.md)
- Office rooms: [docs/design/office-room-system.md](docs/design/office-room-system.md)
- Decision log: [docs/governance/decision-log.md](docs/governance/decision-log.md)
- Demo script: [docs/portfolio/demo-script.md](docs/portfolio/demo-script.md)

## The agents (v0.1)

| Agent | Role | Primary room |
| --- | --- | --- |
| Cora | Delivery Lead / Orchestrator | Human Office |
| Piper | Product Strategist | Product / Research |
| Nova | Researcher | Product / Research |
| Theo | Systems Architect | Architecture / Design |
| Iris | UI Designer | Architecture / Design |
| Mira | Builder | Dev Floor |
| Tess | QA Engineer | QA Lab |
| Rune | Reviewer / Security | Review / Security |
