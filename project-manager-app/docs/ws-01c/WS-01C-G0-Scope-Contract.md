# WS-01C — G0 Scope Contract

**Estado:** PROPUESTO (pendiente de aprobación humana antes de pasar a G2)
**Fecha:** 2026-09-18
**Contra:** `main@5d1c4b24`
**Relación con otros documentos:** este contrato acota qué es "WS-01C" para efectos de decisión in/out. La evidencia que lo respalda vive en [`WS-01C-G1-AS-IS-Reconciliation.md`](./WS-01C-G1-AS-IS-Reconciliation.md) y en [`WS-01C-Naming-Collision-Register.md`](./WS-01C-Naming-Collision-Register.md). No sustituye `docs/SOURCE_OF_TRUTH.md` ni `docs/SDD_GOVERNANCE.md` — ver la sección "Relación con la gobernanza existente" al final.

---

## Objective

Unificar identidad, contexto de negocio activo (org/tenant), autorización basada en membership, cambio de contexto seguro, y continuidad de intención (Intent) — **sin romper los flujos actuales de client/pro/admin**.

Concretamente, al cierre de WS-01C (no de este slice) debe ser cierto que:

1. Una identidad (`User`) puede pertenecer a más de una `Org` sin necesitar una cuenta distinta por rol.
2. El backend deriva el contexto de negocio activo (org/tenant/permisos) del lado del servidor, nunca de un claim del cliente.
3. Existe un mecanismo explícito y seguro para cambiar de contexto de negocio activo dentro de una sesión autenticada.
4. Un membership revocado deja de autorizar en un plazo acotado y conocido, documentado explícitamente si ese plazo no es "inmediato".
5. Una intención de negocio (ej. "publicar este job", "liberar este pago") puede sobrevivir una interrupción de autenticación sin que eso implique preservar el consentimiento de una acción sensible.

## Non-goals

WS-01C, en ningún slice, hace lo siguiente:

- Reemplazar `@semse/auth` o el proveedor de autenticación actual por defecto.
- Crear identidades separadas por persona (cliente/profesional/contratista) — la identidad sigue siendo global (`User`), ya vigente hoy (ver G1 §1).
- Eliminar rutas actuales (`/client/*`, `/worker/*`, `/admin/*`) o su guard por rol.
- Renombrar u ocupar `OperatorContext` (runtime de agentes/Prometeo) para el significado de negocio — ver Colisión A del registro de nombres.
- Reutilizar el `workspaceId` de `OperatorContext`, ni el módulo/API `v1/workspace` (UI shell de misión Prometeo — ver Colisión B, **hallazgo nuevo de este slice**, más severo que la colisión de `workspaceId` sola) para el significado de tenancy de negocio.
- Reescribir Payments (`payment-governance.service.ts`) o Evidence (`evidence.controller.ts`) — se extienden con scoping adicional si la evidencia de G1 lo justifica, no se reescriben.
- Ejecutar migraciones de schema destructivas.
- Hacer que un string de rol/permiso enviado por el frontend sea autoritativo en ningún punto de decisión de autorización.
- Auto-resumir consentimiento financiero o privilegiado tras una interrupción de sesión/Intent (R3 nunca se ejecuta solo por reanudar).
- Construir una tabla `Workspace` nueva **si** G1/ADR-040 concluyen que `Org` + `Membership` ya es el límite real de tenancy (evaluación pendiente, ver ADR-040 §2-3).

## Preserve

Comportamiento actual que debe seguir funcionando sin regresión en cada slice de WS-01C:

- **Login** — flujo actual de `@semse/auth`, emisión de sesión firmada HMAC (`apps/web/lib/auth.ts`), y de JWT firmado para API (`apps/api/src/modules/auth/auth.service.ts`).
- **Acceso client** — rutas `/client/*`, guard de `apps/web/middleware.ts`, permisos `CLIENT` en `packages/auth/src/rbac.ts`.
- **Acceso profesional** — rutas `/worker/*` (rol `PRO`/`WORKER`), mismo guard/rbac.
- **Acceso admin** — rutas `/admin/*` (rol `OPS_ADMIN`), mismo guard/rbac.
- **Comportamiento de membership de organización actual** — un `User` con múltiples `Membership` sigue pudiendo autenticarse igual que hoy; el comportamiento de "primer membership gana" (`memberships[0]`, ver G1 §4) no se elimina hasta que el reemplazo esté probado end-to-end.
- **Auth actual de la API** — `authenticateRequest` (`apps/api/src/modules/auth/auth.service.ts:105-148`), verificación JWT + `AUTH_SECRET`, bloqueo de identidades demo deshabilitadas.
- **Payment governance** — `payment-governance.service.ts` sigue evaluando exactamente igual (scoped por `tenantId`) hasta que exista evidencia de seguridad dedicada que justifique agregar scoping por `orgId` (ver G1, fila "Payment governance").
- **Permisos de Evidence** — permisos `evidence:read`/`evidence:write` actuales en `rbac.ts`, y el contrato de 3 pasos de subida presignada (`semse-upload-flow`).
- **Runtime de Prometeo/agentes** — `OperatorContext`, `workspaceId` de agentes, y el módulo `v1/workspace` (UI shell de misión) siguen exactamente como están; WS-01C no los toca, no los renombra, no los consume.

## Security invariants

Mínimos no negociables para cualquier slice de WS-01C, verificables en código:

1. La identidad se deriva del servidor (sesión/JWT verificado), nunca de un campo enviado por el cliente.
2. El contexto de negocio activo (org/membership) se verifica del lado del servidor en cada request protegida — no se confía en un `orgId`/`workspaceId` de query string, header no verificado, o body.
3. Ningún claim de rol/permiso del cliente es autoritativo; la autorización real sigue viviendo en `@RequirePermissions` + `rbac.ts` (o su evolución), nunca en un string de UI.
4. Aislamiento cross-tenant: toda query sobre datos de dominio debe seguir escopeada por `tenantId` como mínimo (ya vigente); cualquier gap de scoping a nivel `orgId` identificado en G1 se registra como riesgo explícito, no se asume resuelto por este contrato.
5. Operaciones sensibles (liberación de pago, cambio de destino de payout, administración privilegiada) re-autorizan en el momento de ejecución — nunca se ejecutan automáticamente por reanudar un Intent.
6. Reanudar un Intent nunca equivale a consentimiento — el servidor vuelve a chequear membership, capability y estado del recurso antes de permitir el paso final.
7. Ningún payload sensible, secreto, o payload de dominio completo viaja en una URL o token de reanudación de Intent — solo metadata mínima + referencia.
8. Cualquier cambio a la revalidación de membership por request debe declarar explícitamente su costo de latencia esperado, porque ya existe un incidente de producción real (ver G1 §3, hangs de 15s) causado por un intento anterior de lookup a DB por request.

## Migration constraints

- Todo cambio de schema es aditivo primero (nuevas columnas/tablas nullable o con default seguro); ninguna columna/tabla se elimina en el mismo slice que la reemplaza.
- Cualquier cambio a `Membership` (ej. agregar `status`) debe tener backfill determinístico (`ACTIVE` para todo membership existente) documentado antes del merge.
- Ningún slice de WS-01C puede depender de una migración con DML aplicada vía `db push` — debe usar `prisma migrate dev`/`deploy` (ver `semse-prisma-workflow`, y el incidente P3018 ya documentado en `docs/reportes/2026-09-13_f06_revision_pre_migrate.md`).
- Si un slice necesita tocar `Membership`/`Org`/sesión, debe declarar explícitamente su interacción con el dedup no condicional de `scripts/pre-migrate.mjs` (riesgo ya conocido, ver el mismo reporte).

## Success criteria

Un slice de WS-01C se considera exitoso cuando:

- Existe evidencia (test o verificación runtime real, no "se ve bien") de que el comportamiento de la sección "Preserve" sigue intacto.
- El contexto de negocio activo es 100% derivado server-side para las rutas tocadas por ese slice.
- Existen tests de: membership revocado/inactivo, y acceso cross-organización denegado, para cualquier superficie nueva o modificada por ese slice.
- Ningún incidente de producción conocido (ver `docs/CANONICAL_STATE_REGISTRY.md` y los reportes de `docs/reportes/2026-09-1[1-3]_*`) se reintroduce.
- El slice es reversible sin pérdida de datos (ver Rollback boundary).

## Rollback boundary

- Cualquier slice que toque `Membership`/`Org`/sesión debe poder revertirse desactivando su código nuevo (feature flag o rama de código) sin requerir una migración de reversión de datos — es decir, los campos aditivos nuevos pueden quedar sin usar, pero no pueden dejar el modelo existente en un estado inconsistente si se desactivan.
- Ningún slice reemplaza el mecanismo de sesión actual (`apps/web/lib/auth.ts` HMAC / `apps/api` JWT) en el mismo cambio que lo envuelve — envolver primero, reemplazar nunca dentro del alcance de este contrato.
- Si un slice introduce revalidación de membership por request, debe ser reversible a "sin revalidación" sin downtime, dado el incidente de perf ya conocido.

---

## Relación con la gobernanza existente

Este documento usa el vocabulario `SEMSE Completion Standard v1` (`DESIGNED → RECONCILED → READY → IMPLEMENTING → CODE_COMPLETE → VERIFIED → RELEASED → OBSERVED → COMPLETE`, gates `G0-G9`) definido en `CLAUDE_WS-01C_CONTROL_PACK.md` (documento de control externo, no versionado todavía en este repo). Esto **no reemplaza** el flujo SDD ya vigente del repo (`constitution → specify → clarify → plan → tasks → analyze → checklist → implement → validate → PR/CI → merge → deploy → activate/canary → verify/report`, `docs/SDD_GOVERNANCE.md`) ni la jerarquía de 9 niveles de `docs/CANONICAL_STATE_REGISTRY.md`.

**Mapeo explícito para no crear un tercer sistema de verdad paralelo:**

| Vocabulario WS-01C Control Pack | Vocabulario SDD ya vigente en el repo |
|---|---|
| `G0` Scope Contract | Equivalente aproximado a `specify` + parte de `clarify`, pero más estricto en invariantes de seguridad — no hay un artefacto SDD estándar exactamente igual hoy. |
| `G1` AS-IS Reconciliation | No tiene equivalente directo en el flujo SDD estándar (que asume greenfield); es más cercano en espíritu a una fila nueva de `docs/CANONICAL_STATE_REGISTRY.md`, pero a nivel de *workstream de arquitectura*, no de *capacidad individual*. |
| `G2` Architecture & Contract Freeze | Equivalente a `plan` + el ADR que este mismo slice produce (`ADR-040`). |
| `G3` Migration & Rollback | Parte de `tasks` + el checklist SEMSE (`semse-checklist.md`), que ya exige estrategia de rollback. |
| `G4` Implementation Integrity | Equivalente a `implement` + `validate`. |
| `G5` Automated Verification | Equivalente a los gates de CI (`quality-gates`/`unit-coverage`/`e2e`, ver `semse-ci-pr-workflow`). |
| `G6` Runtime Verification | Corresponde al nivel 1-2 de la jerarquía de verdad de `CANONICAL_STATE_REGISTRY.md` ("comportamiento verificado en producción" / "tests reproducibles"). |
| `G7` Security & Isolation | Ya cubierto en espíritu por `semse-security-baseline` y los campos SEMSE obligatorios de spec (`paymentGovernance`, `auditLog`). |
| `G8` Observability & Operations | Sin equivalente formal dedicado hoy — hueco real, no solo de nombre. |
| `G9` Release & Observation | Equivalente a `deploy → activate/canary → verify/report`. |

**Decisión de este contrato:** WS-01C usa el vocabulario `G0-G9` del control pack como capa de seguimiento *específica de este workstream* (más fina en materia de seguridad/identidad que el flujo SDD genérico), pero cada slice de implementación real sigue produciendo los artefactos SDD estándar (spec/plan/tasks/checklist) cuando toca código de producto — el ADR resultante de G2 **es** el artefacto de `plan` a efectos de `SDD_GOVERNANCE.md`. No se crea un spec Kit `docs/specs/*.spec.md` duplicado para lo que ya cubre este scope contract, salvo que la implementación real de un slice lo requiera para pasar `pnpm spec:preflight`.

G0 solo pasa a `RECONCILED` cuando otro ingeniero, leyendo este documento y el registro de colisiones, puede decidir sin ambigüedad si un cambio propuesto está dentro o fuera de WS-01C.
