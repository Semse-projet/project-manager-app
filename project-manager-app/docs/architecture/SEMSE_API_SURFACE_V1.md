# SEMSE API Surface v1 (REST)

## Auth
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `POST /v1/auth/refresh`
- `GET /v1/auth/me`

## Jobs / Bids / Reservations / Contracts
- `POST /v1/jobs`
- `GET /v1/jobs`
- `GET /v1/jobs/:jobId`
- `PATCH /v1/jobs/:jobId`
- `POST /v1/jobs/:jobId/bids`
- `GET /v1/jobs/:jobId/bids`
- `POST /v1/bids/:bidId/accept` (legacy compatibility bridge: adjudica bid y materializa reservation/proyecto)
- `POST /v1/jobs/:jobId/reservations`
- `GET /v1/jobs/:jobId/reservations`
- `POST /v1/reservations/:reservationId/accept`
- `POST /v1/reservations/:reservationId/release`
- `POST /v1/reservations/:reservationId/expire`
- `POST /v1/jobs/:jobId/contracts`
- `GET /v1/jobs/:jobId/contracts/current`
- `GET /v1/contracts/:contractId`
- `POST /v1/contracts/:contractId/sign`

## Work Orders / Milestones
- `GET /v1/jobs/:jobId/milestones`
- `POST /v1/jobs/:jobId/milestones`
- `GET /v1/projects`
- `GET /v1/projects/:projectId`
- `PATCH /v1/projects/:projectId/status`
- `GET /v1/projects/:projectId/escrow`
- `GET /v1/projects/:projectId/payments`
- `GET /v1/projects/:projectId/milestones`
- `POST /v1/projects/:projectId/milestones`
- `POST /v1/milestones/:milestoneId/submit`
- `POST /v1/milestones/:milestoneId/approve`
- `POST /v1/milestones/:milestoneId/reject`

## Payments / Escrow
- `GET /v1/jobs/:jobId/payments`
- `GET /v1/jobs/:jobId/escrow`
- `POST /v1/jobs/:jobId/escrow/fund`
- `POST /v1/projects/:projectId/escrow/deposit`
- `POST /v1/milestones/:milestoneId/escrow/release` (amount opcional: usa monto del milestone)
- `POST /v1/payments/webhook`

## Evidence
- `POST /v1/evidence/presign`
- `POST /v1/evidence`
- `GET /v1/jobs/:jobId/evidence`
- `GET /v1/projects/:projectId/evidence`
- `GET /v1/evidence/:evidenceId`

## Domain Events
- `GET /v1/domain-events/manual-catalog`
- `GET /v1/domain-events`
- `GET /v1/domain-events/:correlationId`
- `POST /v1/domain-events/emit`
- `POST /v1/domain-events/:eventId/process` (interno; service identity `EVENT_CONSUMER` + `domain-events:consume`; body estricto `{ workerId }`; recupera el evento canónico por `eventId`)

## Prometeo
- `POST /v1/ai-models/prometeo/chat` (acepta `PrometeoRequest` multimodal legacy-compatible)
- `GET /v1/prometeo/tools`
- `POST /v1/prometeo/tools/invoke` (P1: ejecución solo lectura contra registry)
- BFF web: `GET /api/semse/prometeo/tools` y `POST /api/semse/prometeo/tools/invoke`
- `POST /v1/prometeo/missions` (P2: crea misión durable sobre `AgentWorkPlan`)
- `GET /v1/prometeo/missions/:missionId`
- `POST /v1/prometeo/missions/:missionId/approve|reject|cancel`
- `POST /v1/prometeo/missions/:missionId/steps/:stepId/checkpoint`
- BFF web: `/api/semse/prometeo/missions/**`
- `POST /v1/prometeo/ingest`
- `POST /v1/prometeo/ingest-file`
- `GET /v1/prometeo/trade-library`
- `GET /v1/prometeo/documents`
- `POST /v1/prometeo/search`
- `POST /v1/prometeo/rag-context`
- `POST /v1/prometeo/rag-query`
- `POST /v1/prometeo/trade-guide`
- `POST /v1/prometeo/assets`

## Disputes
- `POST /v1/disputes`
- `GET /v1/disputes`
- `POST /v1/disputes/:disputeId/assign`
- `POST /v1/disputes/:disputeId/resolve`

## Trust
- `GET /v1/jobs/:jobId/trust`
- `GET /v1/projects/:projectId/trust`

## Ops
- `GET /v1/ops/audit`
- `GET /v1/ops/risk-scores`
- `GET /v1/ops/trust-overview`
- `GET /v1/ops/dashboard`
- `POST /v1/ops/approvals/:approvalId/decision`

## Agents
- `GET /v1/agents/catalog`
- `POST /v1/agents/runs` (acepta `maxAttempts` opcional)
- `POST /v1/agents/runs/claim`
- `POST /v1/agents/runs/reclaim-stale` (retorna `deadLetteredCount`)
- `GET /v1/agents/runs`
- `GET /v1/agents/runs/:runId`
- `POST /v1/agents/runs/:runId/retry`
- `POST /v1/agents/runs/:runId/start`
- `POST /v1/agents/runs/:runId/heartbeat`
- `POST /v1/agents/runs/:runId/complete`
- `POST /v1/agents/runs/:runId/fail`
