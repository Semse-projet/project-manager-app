# Output Contracts

## Audit

### Executive assessment
A concise statement of the current experience and its main structural issue.

### Strengths to preserve
Evidence-backed strengths.

### Priority findings
For each: observation, impact, root cause, recommendation, priority.

### Governing redesign direction
The central experience concept.

### Phased roadmap
- Phase 1: structural corrections
- Phase 2: narrative and visual transformation
- Phase 3: refinement, motion, optimization, and testing

### Risks
What should not be done.

## Design proposal

### Objective
### Audience
### Experience concept
### Narrative sequence
### Section-by-section system
### Visual language
### Motion behavior
### Mobile behavior
### Accessibility
### Required content and assets
### Acceptance criteria

## Product specification

### Problem
### User
### Outcome
### Scope
### Ecosystem relationships
### Main flow
### Alternate and failure flows
### Permissions
### Agent behavior
### Metrics
### Risks
### Acceptance criteria

## Implementation result

### Result
### Key changes
### Files
### Decisions
### Validation
### Limitations
### Highest-priority next step

## Systems / security review (added for this repository)

Use for RBAC, IDOR, data-integrity, and money-correctness work — the shape most of `docs/AUDIT_REMEDIATION_PLAN.md` actually needs, and not covered by the contracts above.

### Finding
File:line, what is wrong, root cause.

### Blast radius
Who/what data/which flows are affected; whether it is exploitable today.

### Fix
Concrete change, scoped.

### Regression risk
What could break; what to test before merging.

### Rollback consideration
Whether this needs coordination before shipping (per `docs/AUDIT_REMEDIATION_PLAN.md` "Rollback Considerations" notes).
