# T-008 — Production OPEN-only canary

## Purpose

Enable the durable StorageWriteGate writer boundary in production without
authorizing any production drain/freeze/thaw transition.

This is a reversible canary slice. It does **not** authorize a production
maintenance window, export of real originals, Railway volume restore, or
`FROZEN`.

## Safety model

Two independent variables are required:

- `SEMSE_STORAGE_WRITE_GATE_MODE=production`: instruments runtime writers.
- `SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE`:
  - `off` (default): no production control-plane access.
  - `observe`: status/count only.
  - `provision`: status/count plus idempotent creation of the durable
    `OPEN` gate row.

This slice intentionally has **no production value that enables mutations**.
`BEGIN_DRAIN`, `MARK_FROZEN`, `THAW`, coverage/window attestations and
operation recovery remain rejected in production.

Staging retains its existing full control plane with
`SEMSE_STORAGE_WRITE_GATE_MODE=staging`.

## Activation order

Do not change the order.

1. Deploy this code while production runtime mode remains `off`.
2. Set `SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE=provision`.
3. Using an authenticated `OPS_ADMIN`, call the existing provision endpoint
   with a unique ticket, reason and idempotency key.
4. Confirm status reports exactly one durable gate in `OPEN`, expected scope,
   and zero unexpected active operations.
5. Change production control mode to `observe`.
6. Set `SEMSE_STORAGE_WRITE_GATE_MODE=production`.
7. Verify exact deployment SHA, `/v1/health`, logs and status.
8. Execute only synthetic, tenant-scoped canary writes. Confirm each admitted
   operation settles and active operation count returns to zero.

Do not invoke drain/freeze/thaw. Those require a separately reviewed production
control slice and an explicitly approved maintenance window.

## Rollback

If health, latency, writes or operation settlement regress:

1. Set `SEMSE_STORAGE_WRITE_GATE_MODE=off` and redeploy.
2. Leave the durable gate row in `OPEN`; do not delete audit history.
3. Set production control mode to `observe` or `off`.
4. Confirm health and normal write behavior.
5. Preserve the failed canary evidence and investigate before retrying.

Rollback does not require deleting the provisioned `OPEN` row.

## Preconditions before production runtime activation

- exact `main` SHA deployed and healthy;
- production storage root/mount preflight passes;
- writer census has no unresolved uninstrumented writer in scope;
- gate status is `OPEN`;
- authenticated OPS_ADMIN provision is audited;
- no stale ACTIVE operations;
- rollback variables and prior deployment are known.

## Non-goals

This canary does not prove production quiescence and cannot be used as evidence
that an offsite export or snapshot is consistent. T-008 remains PARTIAL until a
separately approved production freeze proves all writers quiescent and thaw is
verified.
