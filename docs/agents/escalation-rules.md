# Escalation Rules

When and how an agent surfaces work to a human (or to a higher-authority agent like Cora).

## Always escalate to a human

- Irreversible actions (production deploys, external messages, financial actions).
- Actions outside the agent's permission level.
- Disagreement between two agents that cannot be resolved with a quality gate.
- Repeated failure (3+ attempts at the same task without progress).

## Escalate to Cora (intra-office)

- Routing conflicts (two agents both want a work item).
- A quality gate failed and the owning agent doesn't know how to proceed.
- An open question that needs ADLC-mode boundary judgment.

## Surfacing channel

Escalations to humans land in the **Decision Inbox**. Escalations to Cora land in her work queue and become visible in the Agent Drawer.

## Related

- Permissions: [permissions.md](permissions.md)
- Decision model: [../workflow/decision-model.md](../workflow/decision-model.md)
- Approval policy: [../governance/approval-policy.md](../governance/approval-policy.md)
