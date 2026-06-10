---
id: "api-matching"
title: "Marketplace Matching API"
domain: "matching"
status: "VERIFIED"
owner: "semse-core"
risk: "high"
related_files:
  - "apps/api/src/modules/matching"
  - "packages/schemas/src/matching.schema.ts"
related_tests:
  - "tests/unit/matching-algorithm.test.ts"
  - "apps/api/test/matching.controller.test.ts"
related_endpoints:
  - "v1/matching"
related_events: []
related_agents:
  - "marketplace"
last_verified: "2026-06-07"
---

# Spec: Marketplace Matching API

## Problem Statement

SEMSE needs ranked contractor candidates for a job using explainable signals, not opaque lead selling. Matching must combine job text relevance, trust, verification and ratings while remaining tenant-scoped and deterministic.

## Scope

- In scope:
  - Match a job to candidate professionals.
  - Return explainable score breakdown.
  - Filter by minimum score.
  - Limit result count.
- Out of scope:
  - Paid lead auctions.
  - Automatic contractor assignment.
  - Hiding score inputs from operators.

## Algorithm Contract

```yaml
version: "v1.0"
signals:
  textSimilarity:
    weight: 0.40
    method: "Jaccard over normalized job title/category/scope and candidate historical job text"
  trustSignal:
    weight: 0.25
    source: "User.trustScore, clamped 0-1"
  verificationSignal:
    weight: 0.15
    mapping:
      verified: 1.0
      pending: 0.5
      unverified: 0.0
      suspended: 0.0
  ratingSignal:
    weight: 0.20
    method: "avgRating / 5, zero when no ratings"
output_sort: "score descending"
```

## API Contract

### `POST /v1/matching/jobs`

```yaml
auth: required
permissions: ["matching:read"]
input:
  jobId: "required string"
  limit: "integer 1-50, default 10"
  minScore: "number 0-1, default 0"
output:
  jobId: string
  jobTitle: string
  candidatesEvaluated: number
  candidates:
    - userId: string
      email: string
      score: number
      percentileRank: number
      breakdown:
        textSimilarity: number
        trustSignal: number
        verificationSignal: number
        ratingSignal: number
      verificationStatus: string
      trustScore: number
      avgRating: number
      totalRatings: number
      completedJobs: number
  algorithmVersion: string
  computedAt: string
errors:
  400: "invalid input"
  403: "missing matching:read"
  404: "job not found or not tenant scoped"
```

## Security / RBAC

- Requires `matching:read`.
- Matching is tenant-scoped.
- Suspended/unverified contractors can appear only if algorithm/service policy allows; score must expose verification signal.
- Matching output is a recommendation, not an assignment.

## Tests Required

- [x] Token normalization and stop-word removal.
- [x] Jaccard scoring.
- [x] Verification score impact.
- [x] Trust clamping.
- [x] Composite score remains 0-1.
- [x] Controller-level RBAC tests.
- [x] Repository tenant isolation tests.

## Implementation Map

### API

- `apps/api/src/modules/matching/matching.controller.ts`
- `apps/api/src/modules/matching/matching.service.ts`
- `apps/api/src/modules/matching/matching.repository.ts`
- `apps/api/src/modules/matching/matching.algorithm.ts`

### Packages

- `packages/schemas/src/matching.schema.ts`

### Tests

- `tests/unit/matching-algorithm.test.ts`

## Acceptance Criteria

- [x] Spec is linked from `docs/SPEC_INDEX.md`.
- [x] Algorithm version is returned.
- [x] Score breakdown is visible to callers.
- [x] No automatic lead charge or assignment occurs from matching alone.
