# Agent Permissions

What each agent is allowed to do, by capability — not by environment. Default is least-privilege; dangerous actions escalate to a human (see [escalation-rules.md](escalation-rules.md)).

## Permission ladder

| Level | Capability | Examples |
| --- | --- | --- |
| **P0** | Observe only | Read event stream; emit telemetry. No file or artifact writes. |
| **P1** | Read-only | Read repo files, docs, prompts, artifacts. No writes anywhere. |
| **P2** | Docs/artifacts write | Write research notes, decision drafts, design specs under `/docs` and `/assets/source/prompts`. |
| **P3** | Tests write | Add or modify test files, fixtures, mocks. Not production code. |
| **P4** | Scoped code write | Edit source files within an assigned scope (one feature directory at a time). |
| **P5** | Worktree / branch / draft PR | Create branches, open draft PRs against the repo. May not merge. |
| **P6** | External tools / controlled integrations | Read/write to allowlisted external tools via approved adapters (e.g., search, formatter, linter). |
| **P7** | Dangerous / human-only | Merge to `main`, deploy, delete files at scale, modify CI/secrets, send external messages, run cost-incurring jobs. **Always requires explicit human approval.** |

Levels are cumulative: P3 implies P0–P2, etc. Permissions never escalate without a human-approved bump.

## Per-agent default

| Agent | Default level | Why |
| --- | --- | --- |
| Cora (Delivery Lead) | **P6** | Routes work and reaches controlled external tooling; never writes production code. |
| Piper (Product Strategist) | **P2** | Writes intent + acceptance criteria into docs. |
| Nova (Researcher) | **P1** | Read-only by default; can produce research notes at P2 when given a task. |
| Theo (Systems Architect) | **P2** | Writes ADRs and design docs. Cannot edit code. |
| Iris (UI Designer) | **P2** | Writes UI specs, tokens, and microcopy under `/docs/design`. |
| Mira (Builder) | **P5** | Writes scoped code, opens draft PRs. Cannot merge to `main` or deploy. |
| Tess (QA Engineer) | **P3** | Writes tests and fixtures. Cannot edit production code outside test directories. |
| Rune (Reviewer / Security) | **P1** | Read-only by default. Files reviews/audits at P2. |
| Human | **P7** | Approves dangerous actions; only actor allowed to do P7 operations. |

## Bump rules

- A bump from one level to the next must be explicit and time-boxed (e.g., "Mira P5 → P6 for 30 minutes to call the linter MCP").
- Bumps are logged in the event stream (`permission.bumped`, `permission.expired`).
- Any P7 action requires a Decision Inbox entry first; no agent can self-grant P7.

## Related

- Escalation rules: [escalation-rules.md](escalation-rules.md)
- Approval policy (when humans must sign off): [../governance/approval-policy.md](../governance/approval-policy.md)
- Night-mode policy (what's allowed unattended): [../governance/night-mode-policy.md](../governance/night-mode-policy.md)
