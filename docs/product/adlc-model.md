# ADLC Model

How this project interprets the Agentic Development Lifecycle.

## Core idea

The SDLC's six phases — Intent, Generate, Validate, Govern, Deploy, Observe — become **concurrent modes**, not sequential stages. Agents execute; humans govern.

## Modes

| Mode | What happens | Typical agents |
| --- | --- | --- |
| Intent | Capture and refine what to build | Piper, Nova |
| Generate | Design and produce artifacts (architecture, UI, code) | Theo, Iris, Mira |
| Validate | Test, regress, audit | Tess, Rune |
| Govern | Approve, prioritize, escalate | Cora, Rune, human |
| Deploy | Ship to environments | Mira, Tess |
| Observe | Watch, detect, raise | Rune |
| Multi | Cross-cutting (orchestration, routing) | Cora |

## Concurrency, not sequence

A single work item can be in `Generate` (Mira coding) and `Validate` (Tess writing tests) simultaneously. The office UI should make that visible.

## Loop, not pipeline

`Observe` re-triggers `Intent`. See [../demos/bug-032-dashboard-filter.md](../demos/bug-032-dashboard-filter.md) for the canonical loop-closure demo.

## Related

- Agent roles: [../agents/role-catalog.md](../agents/role-catalog.md)
- Event model: [../workflow/event-model.md](../workflow/event-model.md)
- Office rooms: [../design/office-room-system.md](../design/office-room-system.md)
