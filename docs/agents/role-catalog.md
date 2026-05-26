# Agent Role Catalog

The 8 agents that populate the office. Each agent has a specialty and a primary room; ADLC modes are shared concurrently rather than owned by one agent (see [../product/adlc-model.md](../product/adlc-model.md)).

| Agent | Role | Primary room | Primary ADLC mode(s) | One-line job |
| --- | --- | --- | --- | --- |
| Cora | Delivery Lead / Orchestrator | Human Office | Govern, Multi | Routes work, escalates decisions, owns the human handoff. |
| Piper | Product Strategist | Product / Research | Intent | Captures and shapes intent; writes acceptance criteria. |
| Nova | Researcher | Product / Research | Intent, Generate | Investigates prior art, constraints, and unknowns. |
| Theo | Systems Architect | Architecture / Design | Generate | Designs structure; chooses approach; flags risk. |
| Iris | UI Designer | Architecture / Design | Generate | Designs interfaces, flows, microcopy. |
| Mira | Builder | Dev Floor | Generate | Implements code, runs builds, opens PRs. |
| Tess | QA Engineer | QA Lab | Validate | Reproduces, tests, regressions. |
| Rune | Reviewer / Security | Review / Security | Validate, Govern | Reviews, audits, threat-models. |

Each agent has:
- A row in [agent-registry.md](agent-registry.md) (machine-readable seed data).
- A prompt at [`/prompts/agents/<agent>.md`](../../prompts/agents/).
- A visual identity in [../design/character-bible.md](../design/character-bible.md).
- Permission scope in [permissions.md](permissions.md) and [escalation-rules.md](escalation-rules.md).

## Related

- ADLC model (modes are concurrent, not sequential): [../product/adlc-model.md](../product/adlc-model.md)
- Permission ladder (P0–P7, Human Only): [permissions.md](permissions.md)
- Rooms: [../design/office-room-system.md](../design/office-room-system.md)
