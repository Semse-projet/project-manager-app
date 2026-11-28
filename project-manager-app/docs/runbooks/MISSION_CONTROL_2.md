# Mission Control 2.0 — operator runbook

Spec authority: `docs/specs/operations/mission-control-2.spec.md`.

Mission Control is a governed control plane over existing domain authorities.
It does not mutate Railway, release payments, approve Evidence, execute shell,
or accept arbitrary runbook instructions.

## Preconditions

- authenticated `OPS_ADMIN`;
- `ops:dashboard:read` for exceptions/runbooks;
- `ops:dashboard:write` for actions;
- `domain-events:replay` also applies inside the replay adapter;
- `SEMSE_MISSION_CONTROL_V2_ENABLED=false`;
- `SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS=tenant_default` for the first
  production canary.

Every mutation requires a 10–500 character reason, an approved runbook,
idempotency key, target owned by the session tenant, and a durable receipt.

## signal-triage-v1

Targets: `OperationalSignal` and its normalized exception.

Allowed actions: `ACKNOWLEDGE`, `RESOLVE`, `DISMISS`, `ESCALATE`.

1. Open the owning workspace and inspect the live condition.
2. Acknowledge only after assigning an operator.
3. Resolve only after evidence shows the underlying condition converged.
4. Dismiss only when the signal is irrelevant or duplicated; explain why.
5. Escalate when domain coordination is required.

Rollback: status mutations are auditable but not blindly reversed. Recreate a
new signal through its owning detector if the underlying condition remains.

## agent-run-recovery-v1

Target: tenant-owned `AgentRun`.

Allowed actions: `RETRY`, `REQUEUE`, `ESCALATE`.

1. Confirm the run is `FAILED`/`CANCELLED` or dead-lettered.
2. Use dry-run first.
3. Use `RETRY` for a recoverable non-dead-lettered run.
4. Use `REQUEUE` for a dead-lettered run or when a fresh queue generation is
   required.
5. Verify the receipt and AgentRun state before repeating.

The adapter filters both `id` and `tenantId`. A foreign or missing run returns
404 and still leaves a failed receipt.

## event-delivery-recovery-v1

Target: tenant-owned `DomainOutboxEvent`.

Allowed actions: `REPLAY`, `ESCALATE`.

1. Inspect event and consumer delivery state.
2. Replay only a terminal failed/dead-letter state.
3. Set `options.consumerName` only for a specific failed consumer.
4. Use dry-run before the real replay.
5. Confirm `replayCount`, audit reference and worker processing.

The original envelope is never edited.

## permanent-loop-control-v1

Target: an ID declared by `@semse/autonomy`.

Allowed actions: `PAUSE`, `RESUME`, `ESCALATE`.

Permanent loops are platform-scoped. Unknown loop IDs return 404. Always run a
dry-run first and verify loop state after the action.

Rollback: `PAUSE` and `RESUME` compensate one another through a new receipt.

## incident-coordination-v1

Target: normalized `MissionControlException`.

Allowed actions: `ESCALATE`, and `RESOLVE` for a tenant-owned incident.

Escalation creates or reuses a durable, tenant-scoped
`MissionControlIncident`. Resolution closes only the coordination incident; it
does not claim that the underlying domain condition was fixed.

## service-health-diagnosis-v1

Target: normalized health, Observer or worker-queue exception.

Allowed action: `ESCALATE`.

Mission Control exposes health and a deep link only. Railway remains the
deployment authority.

## Idempotency and receipts

- Unique key: `(tenantId, idempotencyKey)`.
- Same key and same intent returns the original terminal receipt.
- Same key and different intent returns
  `MISSION_CONTROL_IDEMPOTENCY_CONFLICT` (409).
- A live lease returns `MISSION_CONTROL_ACTION_IN_PROGRESS` (409).
- An expired `RUNNING` lease can be reclaimed once and increments `attempts`.
- Terminal states: `SUCCEEDED`, `FAILED`, `NO_OP`.
- A dry-run is a durable `NO_OP` receipt with `dryRun=true`.

## Production canary

Do not set `SEMSE_MISSION_CONTROL_V2_ENABLED=true`. That flag turns Mission
Control on for every tenant. The canary is the allowlist only.

Observed on 2026-10-11 with an `OPS_ADMIN` session on `tenant_default`
(recorded on the spec, not re-checked in the 2026-11-24 code pass):

- `GET /v1/ops/mission-control/runbooks` and `.../exceptions` returned 200
  with the feature enabled for that tenant while `SEMSE_MISSION_CONTROL_V2_ENABLED`
  was unset.
- `RETRY` dry-run on a failed AgentRun returned `NO_OP`, and the same
  idempotency key returned `duplicate: true`.
- A missing target returned a failed receipt without disclosing another tenant.

Still open, and the reason `activation_status` stays `INACTIVE`:

- [ ] a session whose tenant is **not** in
      `SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS` receives 404
      `MISSION_CONTROL_V2_DISABLED` on runbooks, exceptions and actions,
      and the response body does not include another tenant's data;
- [ ] one effectful signal `ACKNOWLEDGE` and `RESOLVE`, one `ESCALATE` of
      `signal:<id>`, and one `RESOLVE` of `incident:<id>` in `tenant_default`,
      with the duplicate-key and AuditLog checks below.

Local tests already lock the code path (`apps/api/test/mission-control-2.test.ts`:
default-off policy, 404 before Prisma for a tenant outside the allowlist,
idempotent receipt, dry-run `NO_OP`). They are not production evidence.

Use the API origin currently serving `app.semseproject.com`. Substitute the
token. Do not print the token into tickets or this file.

```bash
# Outside the allowlist. Expect HTTP 404 and code MISSION_CONTROL_V2_DISABLED.
curl -sS -D - -o /tmp/mc-runbooks.json \
  -H "Authorization: Bearer $OPS_TOKEN_OTHER_TENANT" \
  "https://<api-host>/v1/ops/mission-control/runbooks"
```

```bash
# Canary tenant, dry-run first. reason length 10–500, idempotencyKey length 8–128.
# dryRun is part of the intent hash. Changing it with the same key returns 409
# MISSION_CONTROL_IDEMPOTENCY_CONFLICT. Use a new key for the real action,
# then repeat that exact real body to prove duplicate: true.
curl -sS -H "Authorization: Bearer $OPS_TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"ACKNOWLEDGE","targetType":"OperationalSignal","targetId":"<signal-id>","reason":"Canary acknowledge after operator review.","runbookId":"signal-triage-v1","idempotencyKey":"mc-f4-ack-dry","dryRun":true}' \
  "https://<api-host>/v1/ops/mission-control/actions"
```

After that receipt is `NO_OP`, send the same JSON with `"dryRun": false` and
`"idempotencyKey": "mc-f4-ack-real"`. Send that second body again and require
the same `receipt.id` and `duplicate: true`.

`ACKNOWLEDGE`, `RESOLVE`, and `DISMISS` on the signal use
`targetType: OperationalSignal` and `targetId` equal to the signal id.
`ESCALATE` is not implemented on that target. Escalate with:

```json
{"action":"ESCALATE","targetType":"MissionControlException","targetId":"signal:<signal-id>","reason":"Canary escalation after operator review.","runbookId":"signal-triage-v1","idempotencyKey":"mc-f4-esc-real","dryRun":false}
```

Close the incident that response creates with a new key, runbook
`incident-coordination-v1`, `targetType: MissionControlException`, and
`targetId: incident:<incident-id>`. `RESOLVE` on `signal:<id>` is rejected.
Confirm one `AuditLog` row per action (`ops.mission-control.action`),
including dry-run and no-op. Delete or resolve only the synthetic signal you
created. Do not replay domain events or retry AgentRuns except as dry-run
unless that target is already part of an incident you own.

1. Confirm API/Web health separately from feature activation.
2. Confirm `SEMSE_MISSION_CONTROL_V2_ENABLED` is unset or `false`, and
   `SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS` is exactly the intended tenant.
3. As `OPS_ADMIN` of that tenant, list runbooks and exceptions (200).
4. Verify an authenticated foreign-tenant session returns 404
   `MISSION_CONTROL_V2_DISABLED` without details.
5. Dry-run one available action from each high-impact adapter.
6. On an identified synthetic OperationalSignal, execute acknowledge with a
   new key, repeat the same key, then resolve with a second key.
7. Escalate one synthetic exception, repeat its key, and resolve the incident.
8. Confirm receipts, AuditLog, tenant SSE, no global tenant payload, and no
   duplicate domain effect.
9. Review 5xx, failed receipts, duplicate/no-op and stale leases.

Only after 4–8 pass with recorded ids may the spec move to `VERIFIED`.
This runbook does not do that.

## Rollback

1. Set `SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS` empty.
2. Keep `SEMSE_MISSION_CONTROL_V2_ENABLED=false`.
3. Confirm new endpoints return the disabled response for the former canary.
4. Preserve the additive table and incident columns for audit.
5. Revert application code only if required; use a forward-fix for schema.

Immediate rollback signals: any cross-tenant disclosure, duplicated effect,
successful receipt without the expected domain result, unapproved adapter, or
material 5xx increase.
