---
type: plan
feature: "Mobile Client Tab — Fase 2 de apps/mobile"
domain: "ui"
spec: "docs/specs/ui/mobile-client-tab.spec.md"
version: "2.0"
status: "DRAFT"
branch: "feat/mobile-client-tab"
date: "2026-08-05"
---

# Plan técnico: Mobile Client Tab — Fase 2 de apps/mobile

> Prerrequisito: spec `APPROVED`. El plan separa implementación, merge,
> despliegue y activación; ningún estado se infiere de otro.
>
> **Nota de estado:** el spec (`docs/specs/ui/mobile-client-tab.spec.md`)
> sigue en `DRAFT`, no `APPROVED`, al momento de escribir este plan — se
> redacta ahora por instrucción explícita del usuario para completar el
> flujo SDD (`specify → plan → tasks`) en secuencia, no porque el gate se
> haya saltado. No iniciar `implement` (Fase 1 de este plan) hasta que el
> spec pase a `APPROVED`.

## 1. Snapshot de verdad

- `origin/main` SHA: `1a2d9aea96d9d774c1284d85aa1ea1b96d43eea0` (local `main`
  confirmado `up to date with origin/main` el 2026-08-05).
- SHA desplegado API: no confirmado en esta sesión — `railway status` (CLI)
  respondió `semse-API` → `Online`, `deployment ID 00cbfadd-49d5-45e4-9703-509e685d9984`,
  pero el MCP de Railway devolvió `Unauthorized` (mismo patrón intermitente
  ya visto antes, ver memoria `reference-railway-semse-infra`) y no se
  extrajo el SHA exacto vía CLI en esta pasada. Confirmar con
  `railway logs`/dashboard antes de cualquier deploy real de Fase F.
- SHA desplegado Web/Worker: no verificado en esta sesión, mismo motivo.
- **Estado de servicios:** `semse-API` online contra `api.semseproject.com`
  al momento de escribir este plan.
- **Estado de migraciones:** sin relación directa con este feature (§7 del
  spec: sin cambio de schema). Nota de contexto no relacionada: el working
  tree de `main` tiene una migración (`20260804000000_push_device_tokens`)
  y cambios de otro trabajo (push notifications, Fase 1 de mobile) **sin
  commitear** — este plan asume que ese trabajo se commitea/mergea antes o
  independientemente de este feature; no lo bloquea ni depende de él salvo
  por compartir `apps/mobile` como árbol de trabajo.
- **Flags/allowlists:** ninguno aplica — mismos endpoints ya activos sin
  flag que usa `apps/web/app/(app)/client` hoy.
- **Drift o deuda previa:** `ClientTabNavigator.tsx` es actualmente un stub
  de una sola pantalla (`RoleGate.tsx` lo describe como placeholder); no hay
  drift entre spec y código porque el código de esta fase aún no existe.

## 2. Constitution check

- [ ] Spec aprobado antes de código — **pendiente, ver nota de estado arriba**
- [x] Tenant/org/ownership y RBAC definidos — spec §3, verificado contra
      `packages/db/prisma/seed.ts` (permisos reales de `CLIENT`)
- [x] Evidence/Payment Governance revisados si aplica — spec §2 excluye
      explícitamente todo lo que mueve dinero; evidence es solo lectura
- [x] Audit/events definidos para cambios críticos — spec §6 documenta los
      eventos reales (incluido el hallazgo de `rating.submitted` no
      catalogado, preexistente)
- [x] Tests preceden implementación — ver Fase A abajo
- [x] No se expone secreto ni se agrega backend paralelo — cero endpoints
      nuevos, cero servicios nuevos
- [ ] Código, CI, merge, deploy y activación se medirán por separado — se
      medirán según Fases D–F de este plan; sin evidencia todavía porque no
      ha empezado la implementación

## 3. Arquitectura y autoridad

- **Fuente de verdad de escritura:** sin cambios — Postgres vía Prisma,
  igual que hoy consume `apps/web`.
- **Read models/proyecciones:** ninguna nueva. `GET /v1/jobs` ya hace su
  propio scoping server-side en `JobsService.list` (confirmado leyendo
  `apps/api/src/modules/jobs/jobs.controller.ts:19-36`); no se toca.
- **Módulos afectados (API):** ninguno — `jobs`, `bids`, `milestones`,
  `evidence`, `ratings` se consumen tal cual existen hoy.
- **Contratos Zod:** un tipo nuevo, de solo lectura de tipos —
  `RatingRecordView` (o equivalente) en `packages/schemas`, ya que hoy solo
  existe el schema de **input** (`ratingCreateSchema`,
  `packages/schemas/src/api-input.schema.ts:121`) y no uno de salida. Sin
  esto, `src/api/ratings.ts` tendría que tipar la respuesta como `unknown`
  o duplicar un tipo local — mismo patrón que ya evitan
  `JobRecordView`/`BidRecordView`/`EvidenceRecordView` para Worker.
- **API/BFF/UI:** mobile habla directo a `/v1` (sin BFF, confirmado en
  `apps/mobile/README.md` — "no BFF layer here"). Esta fase agrega
  únicamente superficie **UI** en `apps/mobile`; cero cambios en `apps/api`
  salvo, indirectamente, el tipo de schema compartido arriba.
- **Worker/queues:** sin cambios.
- **Agentes/tools:** sin cambios — spec §5 ya lo marca N/A.
- **ADR requerido:** no — el patrón (reusar `/v1` existente desde una nueva
  pestaña de rol en `apps/mobile`) ya está establecido por
  `WorkerTabNavigator`/`WorkerJobsStackNavigator`; esta fase lo replica, no
  introduce una decisión arquitectónica nueva.

## 4. Datos y migración

No aplica — spec §7 ya lo declara `NOT_APPLICABLE`. Sin modelos Prisma
nuevos, sin migración, sin backfill.

## 5. Seguridad y política

- **Permisos:** `jobs:read`, `bids:read`, `bids:accept`, `milestones:read`,
  `milestones:approve`, `evidence:read`, `ratings:create`/`ratings:read` —
  todos ya otorgados a `CLIENT` en `packages/db/prisma/seed.ts:44-56`. No se
  agrega ningún permiso nuevo a ese rol.
- **Tenant/org/resource scope:** delegado 100% al backend existente
  (`resolveRequestContext` + scoping por servicio); mobile no implementa
  ninguna verificación de ownership del lado cliente más allá de UX
  (ocultar acciones que fallarían).
- **Step-up/aprobación:** ninguno — mismo nivel que login normal.
- **Auditoría:** reusa `AuditService.append` ya presente en
  `bids`/`milestones`/`ratings` services; no se agrega logging nuevo.
- **Riesgos de pagos/evidencia:** cero — evidence es solo lectura, y ningún
  endpoint de escrow/pago se toca (ver exclusiones explícitas del spec §2).
- **Abuse cases:**
  - Doble-tap en accept/approve → mitigado del lado UI (deshabilitar botón
    tras el primer tap), el backend ya es la fuente de verdad de si el
    estado permite la transición (409 si no).
  - Rating duplicado → **no mitigado por el backend hoy** (hallazgo real,
    documentado en spec §4 P4) — mitigación de esta fase es solo UX
    (deshabilitar el formulario tras un submit exitoso), no una garantía de
    integridad de datos. Si se requiere una garantía real, es un spec de
    dominio aparte sobre `ratings.service.ts`, no bloquea esta fase.

## 6. Eventos, idempotencia y reconstrucción

- **Productores:** sin cambios — se siguen usando los productores ya
  existentes de `milestones.service`/`bids.service`/`ratings.service`.
- **Outbox atómico / Consumers/receipts / Replay / DLQ:** sin cambios, no
  aplica a este feature (no se tocan productores ni consumidores).
- **Rebuild:** no aplica.
- **Correlation/traces:** mobile ya no tiene correlation-id propio (ver
  spec §8); fuera de alcance introducirlo aquí — aplicaría igual a Worker,
  no es específico de esta fase.

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- Tests rojos para `ClientJobsListScreen`, `ClientJobDetailScreen`,
  `RatingFormScreen` (mock de `src/api/*`, mismo patrón que
  `apps/mobile/src/screens/worker/*.test.tsx`) — deben fallar primero
  porque los componentes no existen todavía.
- Nuevo `RatingRecordView` (o similar) en `packages/schemas/src/` — este sí
  es un contrato compartido real, se define antes que el código que lo usa.
- `src/api/ratings.ts` tipado contra ese schema (aún sin implementación de
  pantalla, solo el cliente de API + su propio test).

### Fase B — Datos y dominio

No aplica — sin migración, sin dominio nuevo del lado API. Esta fase se
salta explícitamente (ver §4).

### Fase C — API/BFF/UI

- `src/navigation/ClientJobsStackNavigator.tsx` — nuevo, mismo patrón que
  `WorkerJobsStackNavigator.tsx` (`apps/mobile/src/navigation/WorkerJobsStackNavigator.tsx`).
- `src/navigation/ClientTabNavigator.tsx` — reemplazar el stub
  (`ClientHomeScreen` placeholder) por `Tab.Navigator` real con `Jobs` +
  `Settings`.
- `src/screens/client/JobsListScreen.tsx`, `JobDetailScreen.tsx`,
  `RatingFormScreen.tsx` — nuevos, estados `loading/empty/ready/forbidden/degraded/error`
  explícitos en cada uno (spec §5 UI `required_behavior`).
- `src/navigation/types.ts` — agregar `ClientJobsStackParamList`.
- `RoleGate.tsx` — actualizar el comentario de `TARGET_PRIORITY` una vez
  Client deje de ser placeholder (ya no aplica "Client and Admin are still
  placeholders" literal para Client).
- `apps/mobile/README.md` — otra actualización de las secciones "Client and
  Admin tabs are placeholders" y "Structure", mismo motivo por el que se
  corrigieron en la pasada anterior de esta sesión (documentación que se
  desactualiza si no se toca en el mismo cambio que agrega el código).

### Fase D — Verificación local/CI

- `pnpm --filter @semse/mobile test` — suite completa, no solo los archivos
  nuevos (evitar romper Worker).
- `pnpm --filter @semse/mobile check` (`tsc --noEmit`).
- `pnpm --filter @semse/api build` si `packages/schemas` cambia (para
  confirmar que el nuevo tipo no rompe el consumidor API).
- `pnpm spec:validate:strict`, `pnpm spec:coverage`, `pnpm spec:index`.

### Fase E — Integración

- PR con: código + tests + spec actualizado (`code_status`, `status`) +
  README actualizado.
- Sin migración que coordinar con el deploy (§4 N/A).

### Fase F — Producción

- Sin servicio backend que desplegar — el único artefacto de "producción"
  de esta fase es un build EAS (`eas build --profile preview`).
- **Canary autenticado:** un build `preview` corrido en un device/simulador
  real por una cuenta `CLIENT` real — no basta `tsc --noEmit`, mismo
  estándar que ya exige `apps/mobile/README.md` para Worker ("built in a
  sandbox with no Xcode/Android SDK/simulator available... treat the first
  real run as this app's first end-to-end test").
- **Rollback:** revertir a la versión anterior del build EAS / feature-flag
  no aplica (no hay flag) — el rollback real es no promover el build
  `preview` a `production` hasta confirmar el smoke manual.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Rating duplicado sin guarda backend (hallazgo §5) se vuelve más visible al exponerse en un segundo cliente (mobile) | media | bajo (dato duplicado, no financiero) | Deshabilitar botón tras submit exitoso del lado UI; no bloquea esta fase | Reportes de ratings duplicados en producción → abrir spec de dominio aparte |
| `RatingRecordView` nuevo en `packages/schemas` rompe algún consumidor existente que asumía `unknown` | baja | medio | `pnpm --filter @semse/api build` + `pnpm typecheck` antes de PR (Fase D) | Fallo de build en CI |
| Nadie prueba el build real en device (limitación conocida del entorno Windows sin Xcode/simulador) | media | alto (bugs solo visibles en runtime, ej. gestos de navegación, permisos) | Fase F exige evidencia de un run real, no solo typecheck, como ya exige Worker | Bug reportado post-release que un smoke manual hubiera atrapado |
| Confundir esta fase con autorización para "ya construir Client completo" y hacer scope creep hacia marketplace/pagos/disputes | media | alto (viola AGENTS.md, mezcla riesgo financiero sin su propio spec) | Este plan solo cubre lo listado en spec §2 "Incluido"; cualquier otra pantalla necesita su propio spec | PR que toca `escrow`/`disputes`/`jobs/new` bajo este branch → rechazar en review |
| Expectativa de producto de que el cliente reciba push cuando llega un bid nuevo — `bids.service.ts` escribe la notificación con `prisma.notification.create` directo, no vía `NotificationsService`, así que nunca llega a `PushDispatchService` (verificado leyendo el código, no asumido — ver spec §2) | alta (ya es el comportamiento actual, no hipotético) | medio (funcionalidad percibida como faltante, no bug de datos) | Documentarlo explícitamente en spec/UI copy (sin badge de "push" para bids); no corregir `bids.service.ts` en este PR — es un cambio de dominio de Bids, no de UI mobile | Si se decide corregirlo, es un spec/PR aparte y pequeño (cambiar 3 call sites en `bids.service.ts` para pasar por `NotificationsService.handleEvent`) |

## 9. Investigación externa

No aplica (spec §11 ya lo declara N/A) — no hay librerías ni APIs externas
nuevas en esta fase.

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (§7 Fase C arriba)
- [x] Migración y rollback definidos — N/A, documentado explícitamente
- [x] Tests ordenados antes del código (Fase A antes de Fase C)
- [x] Canary/feature flag definidos — sin flag; canary = build EAS preview + smoke manual
- [x] Evidencia requerida para cada estado de entrega — build real en
      device antes de `VERIFIED`, igual que Worker
- [x] Scope cabe en un PR reversible — sin cambios de API/DB, solo
      `apps/mobile` + un tipo en `packages/schemas`; revertible con un solo
      `git revert`
