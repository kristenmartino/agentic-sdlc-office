# Agent Registry

Machine-readable seed data for the 8 agents. The runtime reads this (mirrored in `src/data/mock-agents.ts` for v0.1). Update this whenever you add, rename, or retire an agent.

```yaml
agents:
  - id: cora
    name: Cora
    role: Delivery Lead / Orchestrator
    primary_room: human-office
    primary_modes: [Govern, Multi]
    status: placeholder
  - id: piper
    name: Piper
    role: Product Strategist
    primary_room: product-research
    primary_modes: [Intent]
    status: placeholder
  - id: nova
    name: Nova
    role: Researcher
    primary_room: product-research
    primary_modes: [Intent, Generate]
    status: placeholder
  - id: theo
    name: Theo
    role: Systems Architect
    primary_room: architecture-design
    primary_modes: [Generate]
    status: placeholder
  - id: iris
    name: Iris
    role: UI Designer
    primary_room: architecture-design
    primary_modes: [Generate]
    status: placeholder
  - id: mira
    name: Mira
    role: Builder
    primary_room: dev-floor
    primary_modes: [Generate]
    status: placeholder
  - id: tess
    name: Tess
    role: QA Engineer
    primary_room: qa-lab
    primary_modes: [Validate]
    status: placeholder
  - id: rune
    name: Rune
    role: Reviewer / Security
    primary_room: review-security
    primary_modes: [Validate, Govern]
    status: placeholder
```
