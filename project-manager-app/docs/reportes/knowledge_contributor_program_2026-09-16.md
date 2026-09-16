# SEMSE Knowledge Contributor Program — F1 (2026-09-16)

PR: https://github.com/Semse-projet/project-manager-app/pull/627 (branch `claude/semse-contributor-program-t80l76`, draft)

## Objetivo

Primer flujo productivo del programa: navegación pública de misiones →
consentimiento versionado → aceptación de misión (precio/fecha límite
fijados) → entrega de evidencia multi-clip → revisión humana (razón
obligatoria) → apelación → pago de recompensa idempotente.

## Arquitectura encontrada y reutilizada

- Auth/RBAC: JWT + `packages/auth/src/rbac.ts` (tabla estática de permisos
  por rol), guards `AuthGuard`/`RbacGuard`, `@Public()`/`@RequirePermissions`.
- Upload: pipeline genérico `/v1/uploads/plan` + `/v1/uploads/files/*`
  (`StorageService`, validación MIME/tamaño real) — reutilizado sin
  duplicar, solo se agregó el dominio `"knowledge_contribution"`.
- Pagos: `StripeConnectService.transferToContractor` (módulo
  `payments/`) — reutilizado para el payout; `payment-governance/`
  (deshabilitado) evitado intencionalmente.
- Auditoría: `AuditService.append` (`apps/api/src/infrastructure/audit`).
- Tiempo real: `SseEventBusService` (canal `contributor:<userId>`).
- Web BFF: patrón `app/api/semse/[module]/route.ts` +
  `app/semse-api.ts`; i18n vía `lib/language-context.tsx` (dictionary
  `T.es`/`T.en`, sin next-intl).
- Analogía más cercana para el reward: `OriginatorReward`/`originator.service.ts`
  (idempotencia por lookup antes de crear + `@@unique`).

## Archivos modificados (compartidos, cambios aditivos)

- `apps/api/src/app.module.ts` — registra `ContributorProgramModule`.
- `apps/api/src/infrastructure/storage/storage-key.ts` — dominio
  `"knowledge_contribution"` agregado al enum de storage.
- `apps/api/src/modules/evidence/evidence.controller.ts` — mismo dominio
  agregado a `buildUploadPlan`/`domainGuidance`.
- `apps/web/app/semse-api.ts` — funciones cliente del programa.
- `apps/web/lib/language-context.tsx` — namespace `contributors.*` (es/en).
- `apps/web/lib/semse-api-auth.ts` — prefijo público
  `/api/semse/contributors/public/`.
- `apps/web/middleware.ts` — `/contributors/dashboard/*` requiere sesión
  (sin acoplarse al sistema de roles worker/client/admin).
- `packages/auth/src/rbac.ts` — `WORKER` gana `evidence:read/write` +
  `contributor-program:participate`; `PRO` gana `contributor-program:participate`;
  `OPS_ADMIN` gana `contributor-program:participate` + `:manage`.
- `packages/db/prisma/schema.prisma` — 11 modelos nuevos (ver migración).
- `packages/db/prisma/seed.ts` — Terms v1.0 + misión demo EMT offset.
- `packages/schemas/src/evidence.schema.ts` — dominio agregado a
  `uploadPlanSchema`.
- `packages/schemas/src/index.ts` — exporta `contributor-program.schema.ts`.

## Migración

`packages/db/prisma/migrations/20260916021251_knowledge_contributor_program/`
— solo `CREATE TYPE`/`CREATE TABLE`/`CREATE INDEX`/`ADD CONSTRAINT`, ninguna
tabla existente tocada. Validada aplicándola a un Postgres 16 local limpio
sobre las 90 migraciones previas.

## Endpoints API (`apps/api/src/modules/contributor-program/`)

Públicos: `GET /v1/contributor-program/terms/active`,
`GET /v1/contributor-program/missions`,
`GET /v1/contributor-program/missions/:id`.

Contribuidor (`contributor-program:participate`):
`POST /consent`, `POST /missions/:id/accept`, `POST /submissions`,
`GET /submissions/:id`, `POST /submissions/:id/assets`,
`POST /submissions/:id/submit`, `POST /submissions/:id/appeal`,
`GET /dashboard`.

Admin (`contributor-program:manage`):
`POST /admin/missions`, `GET /admin/missions`,
`POST /admin/missions/:id/{publish,pause,close}`,
`GET /admin/submissions`, `POST /admin/submissions/:id/review`,
`GET /admin/appeals`, `POST /admin/appeals/:id/resolve`,
`GET /admin/rewards`, `POST /admin/rewards/:id/authorize-payout`.

## Rutas Web

Públicas: `/contributors`, `/contributors/terms`,
`/contributors/missions/[id]`.
Contribuidor (requiere sesión): `/contributors/dashboard`,
`/contributors/dashboard/submissions/[acceptanceId]`.
Admin: `/admin/contributors`, `/admin/contributors/submissions`,
`/admin/contributors/rewards`.

## Tests agregados

- `tests/unit/contributor-program-policy.test.ts` — ownership (A no ve B).
- `tests/unit/contributor-program-schemas.test.ts` — checkboxes/razón
  obligatorios (Zod).
- `tests/unit/contributor-i18n-keys.test.ts` — paridad es/en.
- `apps/api/test/contributor-program.service.test.ts` (integración, real
  Postgres, se salta sola sin `DATABASE_URL`) — versionado de consentimiento,
  snapshot de precio/versión de misión, idempotencia de reward, provenance
  de extracción.

## Validación

`pnpm lint` (0 errores), `pnpm typecheck` (workspace completo),
`pnpm build:api`, `pnpm build:web` (todas las rutas nuevas en el manifest),
`pnpm test:unit` (1058/1058), `pnpm --filter @semse/api test:unit`
(2229/2229), `pnpm verify:modules`, `pnpm audit:prisma-usage`,
`pnpm check:toolchain`, `pnpm check:dockerfiles` — todo limpio.
`pnpm railway:preflight` no se pudo ejecutar en este sandbox (sin red hacia
Railway).

Flujo completo verificado a mano contra Postgres local: login → aceptar
términos → aceptar misión → crear entrega → registrar asset → enviar →
revisión admin (aprobar) → reward creado → payout bloqueado sin cuenta
Stripe Connect → payout exitoso (mock) al agregar una → dashboard refleja
PAID. Verificado también: 403 cruzado entre contribuidores, 400 al
rechazar sin razón.

## Riesgos / simplificaciones pendientes

- Pipeline de extracción (transcripción, NER, etc.) implementado solo como
  interfaz + filas `KnowledgeExtraction` en estado `PENDING` — sin modelo
  real de IA conectado (explícitamente permitido por el spec).
- No se integró con `DomainEventBus`/outbox (validación estricta de
  `semseEventSchema` + allowlist) — se usa `AuditService` + `SseEventBusService`
  en su lugar; los nombres de evento quedan documentados aquí como reservados
  para cuando se decida integrarlos: `contributor_program.terms.accepted`,
  `.mission.accepted`, `.submission.{created,submitted,reviewed}`,
  `.appeal.{filed,resolved}`, `.reward.{authorized,paid}`.
- No hay endpoint de administración para crear nuevas `ContributorTermsVersion`
  vía UI todavía (v1.0 solo por seed); `hashTermsContent` queda listo para
  cuando se agregue.
- No se agregó un enlace de navegación permanente a `/admin/contributors`
  desde el sidebar/dashboard admin (las páginas funcionan visitándolas
  directamente).
