# T-008 writer inventory and activation reconciliation — 2026-10-17

## Scope

Read-only code audit of `main` for Field Memory custody writers and activation gates. This report does **not** certify Railway staging, production freeze, or offsite restore.

## Storage writers found on main

| Writer / entrypoint | Mutation | Gate coverage found |
| --- | --- | --- |
| `StorageService.putUploadPlan` | write admission / upload intent | `assertUploadPlanOpen()` -> durable staging boundary |
| `StorageService.store` | publishes immutable original via private staging + fsync + hard-link | `StorageWriteOperationBoundary.run(... ORIGINAL_STORE ...)`; nested tickets reused |
| `StorageService.delete` | unlinks original | durable boundary and before-publish recheck |
| `UploadsController PUT /v1/uploads/files/*` | calls `StorageService.store` | inherits storage gate after tenant authorization |
| `EvidenceController.createMultipartSessionEndpoint` | multipart manifest | `withWriteGateMutation("MULTIPART_CREATE")` |
| `EvidenceController.uploadMultipartPart` | part bytes on multipart root | `withWriteGateMutation("MULTIPART_PART")` |
| `EvidenceController.completeMultipartSession` | assembles/publishes original and cleanup | outer `MULTIPART_COMPLETE` ticket; nested `StorageService.store/delete` reuses ticket |
| `EvidenceService` | canonical Evidence registration + audit/outbox path | `withWriteGateMutation("EVIDENCE_REGISTER")` |
| `EvidenceGatewayService` | Evidence register / validation mutations | `EVIDENCE_REGISTER` and `EVIDENCE_VALIDATION` boundaries |
| `BrowserAgentService.saveAsEvidence` | screenshot/report original + Evidence registration | outer `BROWSER_EVIDENCE` boundary; nested store uses same ticket |
| `BuildOpsLegacyPromotionService` | legacy BuildOps promotion mutation | `BUILDOPS_LEGACY_PROMOTION` boundary |

## Direct filesystem writers audited

The API code search found direct `createWriteStream` usage under the custody tree only in:

1. `StorageService.storeUngated` — writes private `.put-staging` then atomically hard-links the final original.
2. `EvidenceController.uploadMultipartPart` — writes multipart part bytes and is inside `MULTIPART_PART`.

Other matches were documentation/tests or unrelated private artifact storage. No additional production writer to `SEMSE_STORAGE_ROOT` was identified by the repository search performed in this audit.

## Browser Agent

`BrowserAgentService.saveAsEvidence()` stores the PNG/JSON through `StorageService.store` and wraps storage publication plus Evidence registration in a single `BROWSER_EVIDENCE` ACTIVE ticket. This prevents a drain transition between publication and registration from being mistaken for quiescence.

## Signed GET and SHA-256 code status

Implementation is already merged on main:

- PR #715 — signed GET / tenant-scoped reads.
- PR #917 — authoritative server-side SHA-256 before Evidence registration.
- PR #922 — inode-pinned, no-symlink SHA-256 hardening.
- PR #929 — readiness must remain false unless signed GET and checksum are enforced.

Therefore the remaining work is operational activation/evidence, not reimplementation.

## Railway production observation

Read-only Railway inspection on 2026-10-17 showed production `semse-API` has names for:

- `SEMSE_STORAGE_ROOT`
- `SEMSE_MULTIPART_STORAGE_ROOT`
- `STORAGE_PROVIDER`

and does **not** expose names for:

- `SEMSE_STORAGE_WRITE_GATE_MODE`
- `UPLOADS_SIGNED_GET_MODE`
- `UPLOADS_SIGNING_SECRET`
- `EVIDENCE_ORIGINAL_SHA256_MODE`

The OAuth connector redacts values; this proves only variable-name presence/absence. Production remains intentionally unactivated.

## T-008g conclusion

**Code inventory: COMPLETE for the repository revision audited. Runtime provenance: PENDING.**

T-008g cannot be marked fully complete until a real staging environment proves the complete set of running instances/processes and confirms that no out-of-repo writer mutates the mounted custody tree.

## Remaining gates

1. #979 CI main E2E infrastructure failure must clear; API Integration already proves the new two-process and SIGKILL/fencing cases.
2. Real isolated staging with >=2 API processes/instances, synthetic storage, Postgres authority, drain/freeze/recovery/thaw.
3. Signed GET and Evidence SHA-256 rollout in staging, then browser/mobile/Vision/agent compatibility canary.
4. Production merge/deploy with write gate still OFF.
5. Approved production freeze window before any real export/restore rehearsal.
