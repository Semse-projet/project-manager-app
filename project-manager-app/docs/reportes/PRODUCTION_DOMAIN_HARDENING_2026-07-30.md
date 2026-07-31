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

This code is local only until an explicitly authorized GitHub publish flow is
completed.

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
