# Production domain hardening — 2026-07-30

## Scope

- Disable legacy demo authentication in production.
- Align canonical web URLs and API CORS with `app.semseproject.com`.
- Remove the duplicate ` SEMSE_DEMO_MODE` Railway variable.
- Set a canonical Next.js `metadataBase` and sitemap fallback.
- Diagnose the stalled `api.semseproject.com` certificate.

## Production configuration applied

Railway `production` now has:

- `semse-web`
  - `SEMSE_DEMO_MODE=false`
  - `NEXT_PUBLIC_APP_URL=https://app.semseproject.com`
- `semse-API`
  - `SEMSE_DEMO_MODE=false`
  - `CORS_ORIGINS=https://app.semseproject.com,https://semseproject.com`
  - `NEXT_PUBLIC_APP_URL=https://app.semseproject.com`
  - `SEMSE_WEB_BASE_URL=https://app.semseproject.com`
  - duplicate leading-space demo variable removed

Both configuration deployments reached `SUCCESS`.

## Security finding and code remediation

The three legacy `@demo.semse` users are persisted as active production users
with the published demo password. Disabling the fallback variable alone does
not prevent the normal password path from authenticating them.

The local hardening branch now:

- rejects those known emails before credential lookup when production demo mode
  is disabled;
- rejects existing API access and refresh tokens for known legacy demo user IDs;
- rejects existing signed web sessions for those IDs;
- rejects `DEMO_AGRO` sessions unless its separate demo flag is enabled.

This code was local at the initial cut. The post-merge update below records its
subsequent publication and production state.

## Domain and TLS evidence

- The API CNAME and ownership TXT return the expected values from Cloudflare,
  Google, Quad9, and both authoritative nameservers.
- Railway still reports `verification.verified=false` and
  `CERTIFICATE_STATUS_TYPE_VALIDATING_OWNERSHIP`.
- Railway refuses `domain certificate retry` while the status is validating;
  retry is only available after an issuance failure.
- The API custom domain target port was aligned from implicit `null` to the
  service's explicit port `3000`, which refreshed the domain configuration but
  did not immediately clear the validation state.

The remaining TLS issue is therefore Railway-side validation state, not public
DNS propagation.

## Validation

- `app.semseproject.com/api/semse/healthz`: 200
- Railway API `/v1/ready`: 200
- CORS preflight:
  - `https://app.semseproject.com`: allowed
  - `https://semseproject.com`: allowed
  - Railway technical web origin: no allow-origin header
- Demo agro session endpoint: blocked
- Focused demo hardening tests: 20 passed
- Changed web files: ESLint passed
- Web TypeScript check: passed
- Changed API files: ESLint passed
- Pure API demo-mode TypeScript check: passed

The full API build was blocked by pre-existing checkout dependency drift
(duplicated generated Prisma clients and missing email packages in one shared
dependency tree). The full web build was also blocked by the auxiliary
worktree's dependency state. Neither failure reported an error in the changed
files; targeted lint, typecheck, and tests passed.

## Backup, staging, and observability status

- Latest local PostgreSQL dump remains
  `semse-production-predeploy-20260719.dump`.
- A fresh consistent dump could not be generated from this workstation because
  `pg_dump` is absent and Railway SSH has no registered key.
- Copying a live PostgreSQL data directory was intentionally rejected because
  it is not a valid restore artifact.
- No staging environment or paid monitoring integration was created; both can
  add recurring cost and require explicit authorization/provider choices.

## Rollback

- Railway variables can be restored individually to their prior technical
  domain values and services redeployed.
- The domain target port can be returned to implicit routing if Railway support
  requests it.
- The local code branch can be discarded without affecting production until it
  is published and merged.

## Post-merge production update — 2026-07-31

- PR `#480` merged as
  `3c2ac45d4f5d3c43a081767c54405eb08d31c788`.
- API Integration, CI quality gates/unit coverage/E2E, CodeQL, Operación
  Asistida, Autonomy Staged and review checks all passed.
- API `425b8526-4374-450b-ae75-53881791e6bc`, Web
  `00a3e13b-c86c-4edf-b2a2-a2e1f4f274f7`, Worker
  `7d5f6279-3554-4a03-bd9d-2960722bce97` and Vision
  `5e1155a6-9efc-46f6-95da-6552798994fc` reached `SUCCESS`.
- Railway API `/v1/health` and custom Web health return 200.
- The API custom hostname remains unresolved after the deployment: strict TLS
  fails hostname verification and an insecure GET reaches a 404. The dedicated
  handoff is
  [`../runbooks/API_CUSTOM_DOMAIN_TLS_HANDOFF.md`](../runbooks/API_CUSTOM_DOMAIN_TLS_HANDOFF.md).

The original rollback note about discarding the local branch no longer applies
after merge; rollback now requires a normal code/config rollback.

## Final API TLS closure — 2026-07-31

- PR `#481` merged as
  `114cb9ca4007d32bf3fbbfc9c36d54b1e862236a`.
- Railway Deploy workflow `30597913257` passed, including its health gate.
- API `575a82f1-ac99-4d60-a5d2-e6aeb645e096`, Web
  `3ffb51d5-6dd1-4fd3-afa2-b7c6b1cff489`, Worker
  `8fe3b3fc-c10a-4843-82cf-d4a2e79297ec` and Vision
  `bf804e3b-9a56-4b94-b1ad-6e6bcafd57cd` reached `SUCCESS`.
- `https://api.semseproject.com/v1/health` now validates strict TLS and returns
  200. Railway reports the custom domain `ACTIVE` on target port 3000.
- The direct API Railway domain and both custom/Railway Web health endpoints
  continue to return 200.

The failure recorded above remains the incident timeline, not the current
state. The exact moment or internal trigger for certificate issuance was not
observable; completion after port alignment and the fresh deployment is a
temporal correlation, not a proven root cause.
