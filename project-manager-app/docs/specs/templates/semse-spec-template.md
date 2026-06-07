---
id: "[domain.feature]"
title: "[Feature Name]"
domain: "[buildops | evidence | payments | rag | agents | marketplace | auth | worker | tools | ui | api]"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
related_files: []
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: ""
---

# Spec: [Feature Name]

## Problem Statement

Describe the business problem in one to three lines. Do not start with the technical solution.

## Scope

- In scope:
- Out of scope:

## Non-Goals

- This spec does not:

## API Contract

### `[METHOD] /v1/[path]`

```yaml
auth: required
roles: []
privacyCritical: false
input_schema:
output_schema:
errors:
  400:
  403:
  404:
  409:
effects:
  audit_log:
  event:
  sse:
```

## UI Contract

```yaml
screens: []
states:
  - loading
  - empty
  - ready
  - error
required_behavior: []
```

## Agent Contract

```yaml
agent:
input_schema:
output_schema:
privacy_routing:
forbidden_behavior: []
```

## SSE / Event Contract

```yaml
event:
channel:
payload:
consumers: []
expected_reaction: []
```

## Data Model Impact

- Prisma models:
- Migrations:
- Backfill:

## Security / RBAC

- Required permissions:
- Tenant boundary:
- Audit requirements:

## i18n Requirements

- User-facing strings:
- Required locales:

## Tests Required

- [ ] Success path
- [ ] Permission denial
- [ ] Validation failure
- [ ] State conflict
- [ ] Audit/event side effect

## Implementation Map

### API

- `apps/api/src/...`

### Web

- `apps/web/...`

### Packages

- `packages/...`

### Tests

- `tests/...`

## Acceptance Criteria

- [ ] Spec is linked from `docs/SPEC_INDEX.md`
- [ ] Code files are listed in `related_files`
- [ ] Tests are listed in `related_tests`
- [ ] `pnpm spec:validate` passes
- [ ] `pnpm spec:coverage` has no unaccepted high-risk gap

## Rollback Considerations

- How to disable:
- Data rollback:
- Operational owner:
