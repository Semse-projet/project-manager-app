# PR-D: Payment Governance Diagnostic Endpoint

**Date:** 2026-06-04  
**Priority:** HIGH  
**Impact:** Admins understand why 4 milestones are blocked  
**Status:** ✅ ENDPOINT CREATED

---

## What's Blocked?

**Current state:** Payment Governance reports 4 milestones blocked  
**Question:** Is it real data or demo data?  
**Answer:** This endpoint diagnoses why.

---

## Endpoint Created

**API Endpoint:**
```
GET /v1/payment-governance/diagnostics/milestones/blocked
```

**BFF Endpoint:**
```
GET /api/semse/payment-governance/diagnostics
```

**Response structure:**
```json
{
  "analyzedAt": "2026-06-04T...",
  "totalMilestones": 42,
  "blockedCount": 4,
  "readyCount": 15,
  "releasedCount": 8,
  "blockedMilestones": [
    {
      "milestoneId": "ms_001",
      "releaseStatus": "blocked",
      "canRelease": false,
      "blockers": ["rejected_evidence", "critical_operational_signal"],
      "missingEvidenceTypes": ["wall_inspection", "photo_series"],
      "rejectedEvidenceCount": 2,
      "needsReuploadEvidenceIds": ["ev_123", "ev_124"],
      "pendingChangeOrderCount": 1,
      "criticalOperationalSignals": ["safety_concern_flagged"],
      "auditReason": "Milestone 'Foundation pour' blocked due to rejected_evidence, critical_operational_signal",
      "nextBestAction": "Reupload 2 rejected evidence items"
    },
    // ... more milestones
  ]
}
```

---

## Features

✅ **Diagnosis per milestone:**
- ID, title, status
- Specific blockers (rejected evidence, change orders, operational signals)
- Missing evidence types
- Evidence IDs that need re-upload
- Critical signals affecting payment

✅ **Summary stats:**
- Total milestones analyzed
- Count by status (blocked, ready, released)
- Analysis timestamp

✅ **Actionable recommendations:**
- `nextBestAction` field guides what to do first
- `auditReason` explains the block
- Links evidence IDs for quick navigation

✅ **Non-destructive:**
- Diagnosis only
- NO "Release payment" button
- NO automatic actions
- Data inspection for admins only

---

## Integration with ObserverPanel (Future)

**UI location:** Expandable section in ObserverPanel
```
[▼] 4 milestones blocked
  - ms_001: wall_inspection evidence rejected → Reupload 2 photos
  - ms_002: pending change order → Review CO_123
  - ms_003: safety signal critical → Resolve signal
  - ms_004: unknown reason → Investigate manually
```

For now: API ready, UI integration in follow-up.

---

## Data Sources

**Checked:**
1. ✅ Evidence table → rejected count, types
2. ✅ ChangeOrderCandidate table → pending count
3. ✅ OperationalSignal table → critical signals
4. ✅ Milestone table → payment readiness

**Not touched:**
- ❌ Payment release logic
- ❌ Evidence validation rules
- ❌ Milestone governance rules

---

## Architecture

**Files created:**
- `apps/api/src/modules/payment-governance/diagnostics.service.ts` (87 lines)
- `apps/web/app/api/semse/payment-governance/diagnostics/route.ts` (13 lines)

**Service methods:**
- `getDiagnostics(tenantId)` → returns all blocked milestones
- `diagnoseMilestoneBlocks()` → analyzes single milestone

**Error handling:**
- Silently continues if queries fail
- Returns "unknown" for missing data
- Logs errors for debugging

---

## Verification Checklist

- [ ] Endpoint returns all blocked milestones
- [ ] `auditReason` explains each block
- [ ] `nextBestAction` is relevant
- [ ] No auto-execution of payments
- [ ] Works with demo data and real data
- [ ] Response format is consistent
- [ ] BFF proxies correctly

---

## Next Steps

1. ✅ PR-A: Fix RAG observation (DONE)
2. ✅ PR-B: RAG Memory Health UI (DONE)
3. ✅ PR-C: Worker Verification tests (DONE)
4. ✅ PR-D: Payment diagnostic (THIS)
5. → PR-E: Simulation History (Week 2)
6. → PR-F: Log Redaction (Week 2)
7. → PR-H: Worker SSE (after PR-C)

---

**Commit message:**
```
feat: Add Payment Governance diagnostic endpoint (PR-D)

New endpoint explains why milestones are blocked:
- Rejected evidence count + types
- Pending change orders
- Critical operational signals
- Audit reason per milestone
- Recommended next action

GET /v1/payment-governance/diagnostics/milestones/blocked
GET /api/semse/payment-governance/diagnostics

Diagnosis only, no auto-execution.
Prepares UI for expandable blocked milestones section.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```
