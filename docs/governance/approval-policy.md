# Approval Policy

When a human must approve before an agent proceeds.

## Default

- Read operations: no approval needed.
- Write operations on owned artifacts: agent-autonomous.
- Write operations on shared artifacts (PRs, deployments, external messages): require human approval.
- Irreversible operations: require human approval, always.

## Per-action rules

TODO — table of actions and their approval requirements.

## Related

- Per-agent permissions: [../agents/permissions.md](../agents/permissions.md)
- Decision model: [../workflow/decision-model.md](../workflow/decision-model.md)
