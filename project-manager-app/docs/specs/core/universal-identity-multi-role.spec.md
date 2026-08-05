---
id: "core.universal-identity-multi-role"
title: "Identidad universal con múltiples capacidades por cuenta"
domain: "core"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - packages/db/prisma/schema.prisma
  - apps/api/src/modules/auth/auth.service.ts
  - apps/web/app/(app)/admin/account/page.tsx
  - apps/web/app/(app)/client/account/page.tsx
  - apps/web/app/(app)/worker/account/page.tsx
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-08-04"
---

# Spec: Identidad universal con múltiples capacidades por cuenta

> **APPROVED 2026-08-04.** El owner (Samuel) aprobó explícitamente tras
> cerrar la investigación externa (§11) y confirmar que ninguna sección
> quedaba pendiente. En la misma sesión el owner resolvió las dos
> decisiones de Fase 0 que quedaban abiertas: (1) la capacidad activa se
> deriva 100% del proyecto/org abierto, nunca de una preferencia guardada;
> (2) `CLIENT`/`PRO`/`WORKER` son tres roles reales y distintos (no un
> bug de etiqueta) y no se tocan — el hallazgo de URL/label de `PRO` queda
> fuera de alcance. Autoriza avanzar `universal-identity-multi-role.plan.md`
> y `.tasks.md` directo a la Fase 1 (tests).
>
> Contrato ejecutable SDD 2.0. Origen:
> `docs/vision/VISION_PROMETEO_OS_2026.md` (principio 4, "una cuenta,
> múltiples capacidades, cualquier proyecto").

## 1. Problema y resultado

**Para quién:** cualquier usuario de SEMSE que participa en más de un
proyecto con roles distintos (p. ej. cliente en un proyecto propio,
profesional independiente contratado en otro, o trabajador de una
compañía/contratista en un tercero).

**Confirmado con el owner (2026-08-04) — taxonomía real de roles, no un
bug de etiqueta:** `packages/auth/src/rbac.ts` ya modela **tres roles
externos distintos y correctos**, no dos con un nombre confundido:

- `CLIENT` — cualquier persona que publica un proyecto (ej. "mi vecino
  tiene una gotera").
- `PRO` — profesional **independiente**, trabaja por su propia cuenta.
- `WORKER` — trabajador que opera **bajo el mando de una compañía o
  contratista** (no es independiente).

Esta distinción es intencional y **no se fusiona ni se toca** en esta
spec. Lo que sí documentó `docs/AUDIT_REMEDIATION_PLAN.md` (nota de
nomenclatura, hallazgo 1.21) es algo más chico y separado: el rol `PRO`
vive bajo rutas `/worker/*` y su sidebar se etiqueta a sí mismo
"Profesional" — una inconsistencia de URL/label, no de modelo de roles.
Se deja fuera de alcance (ver abajo), confirmado explícitamente por el
owner.

**Aclaración adicional del owner (ronda 3, 2026-08-04) — "Contratista" no
es un cuarto rol RBAC:** el owner describe el ecosistema con cuatro
capacidades de negocio — Cliente, Trabajador, Profesional y Contratista
("gestiona proyectos y puede contratar trabajadores o profesionales") —
que **pueden acumularse** (un Profesional puede además ser Contratista).
Investigado contra el código: `packages/auth/src/rbac.ts` no tiene un rol
`CONTRACTOR`/`CONTRATISTA` separado. Lo que existe es un `PRO` que
administra una organización con `WORKER`s bajo su mando, con
funcionalidad de negocio dedicada (`ContractorLead`, `ContractorRateOverride`
en `packages/db/prisma/schema.prisma`) — es decir, "Contratista" hoy es
**una capacidad operativa de `PRO` a nivel de organización**, no un
permiso ni rol adicional. Esta spec no crea un rol `CONTRATISTA` nuevo:
el modelo de "capacidad activa por contexto" ya cubre este caso, porque
un mismo usuario `PRO` simplemente actúa distinto según si el contexto es
"trabajo propio" o "gestión de su organización con `WORKER`s".

**Problema real de esta spec:** el modelo de datos (`Membership(userId,
orgId, roleId)`, PK compuesta) ya permite que un mismo usuario tenga
`CLIENT` en una org, `PRO` en otra y/o `WORKER` en una tercera — pero el
producto y la UX asumen hoy un rol fijo por sesión/cuenta. Un usuario que
quiere operar con más de una capacidad (de las tres reales: cliente,
profesional independiente, trabajador de compañía) tiene que crear
cuentas separadas o forzar su identidad en un rol que no le corresponde
en ese contexto.

**Resultado esperado:** un usuario puede tener más de una capacidad activa
(cliente, profesional independiente, trabajador de compañía, originador —
ver `docs/specs/core/originador-referral-program.spec.md`) bajo la misma
cuenta, y la UI/Prometeo Operativo eligen la capacidad correcta según el
proyecto o la conversación, sin exigir un cambio manual de "modo cuenta".

## 2. Alcance

### Incluido

- Modelo de producto/UX para exponer y conmutar entre capacidades activas
  de una misma cuenta, sobre los tres roles reales ya existentes
  (`CLIENT`/`PRO`/`WORKER`) — sin crear roles nuevos ni fusionar los
  existentes.
- Reglas de qué capacidad aplica por contexto (proyecto, conversación con
  Prometeo, superficie de UI): **100% derivada del proyecto/org abierto,
  nunca de una preferencia guardada** (decisión confirmada con el owner
  2026-08-04) — evita el riesgo de "capacidad pegada" incorrecta.

### Fuera de alcance

- No se fusionan ni se rediseñan los roles `CLIENT`/`PRO`/`WORKER` — la
  distinción profesional-independiente vs. trabajador-de-compañía es
  intencional y se mantiene tal cual (confirmado por el owner 2026-08-04).
- La inconsistencia de URL/label de `PRO` (rutas `/worker/*`, sidebar dice
  "Profesional") **queda explícitamente fuera de este incremento** —
  confirmado por el owner: es un hallazgo cosmético separado de
  `AUDIT_REMEDIATION_PLAN.md`, no bloquea ni se resuelve aquí.
- No se tocan permisos financieros existentes (Stripe/escrow/payouts) —
  cualquier cambio ahí requiere su propio spec bajo el gate de riesgo
  `critical` de `docs/SDD_GOVERNANCE.md` §7.
- No se cambia el schema de `Membership` (ya soporta múltiples filas por
  usuario); esta spec es de producto/UX y de reglas de aplicación, no de
  migración de datos salvo lo estrictamente necesario para exponerlo.
- No incluye el rol "originador/facilitador" en sí (spec separada).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Usuario con múltiples `Membership` | permisos existentes por rol, sin cambio | por org/proyecto, ya acotado por `Membership` | operar con la capacidad correspondiente a cada proyecto/org | mezclar permisos de una capacidad dentro del contexto de otra |
| Admin/OPS_ADMIN | `internal:architecture:read` y permisos existentes, sin cambio | tenant/org según política vigente | auditar qué capacidades tiene activas un usuario | asignar capacidades sin el flujo de verificación existente por rol |

- Tenant boundary: sin cambio — cada `Membership` sigue acotada a su
  `orgId`.
- Ownership/resource policy: sin cambio respecto al modelo actual por rol.
- Step-up o aprobación humana: no aplica para conmutar entre capacidades ya
  otorgadas; sí aplica (sin cambio) para obtener una capacidad nueva
  (verificación profesional, KYC, etc.).
- Datos `privacyCritical`: sin cambio.
- Requisitos de auditoría: cada acción relevante registra actor, rol/capacidad
  activa, org/tenant y resultado de la verificación de permiso — no solo
  "capacidad usada" (ver hallazgo de investigación externa, §11).

## 4. Escenarios y criterios de aceptación

### P1 — Un usuario con dos capacidades entra a un proyecto donde es profesional

```gherkin
DADO un usuario con Membership de rol "cliente" en la org A y "profesional" en la org B
CUANDO abre un proyecto de la org B
ENTONCES la UI y Prometeo Operativo lo tratan como profesional en ese contexto
Y el audit log registra la capacidad usada para esa sesión de proyecto
```

Casos borde:

- [ ] usuario con la misma capacidad duplicada en dos orgs distintas (no debe confundirse)
- [ ] usuario sin ninguna capacidad verificada intenta acceder a un proyecto (debe caer al flujo de onboarding existente, sin regresión)
- [ ] cambio de capacidad a mitad de una conversación con Prometeo (debe resolverse por el proyecto/contexto activo, no por preferencia global)
- [ ] usuario con `WORKER` en la org de un contratista y `PRO` en un proyecto propio como independiente: la UI nunca mezcla los dos — bajo `WORKER` actúa a nombre del contratista (permisos de `WORKER`), bajo `PRO` actúa por cuenta propia (permisos de `PRO`), sin que uno herede permisos del otro

## 5. Contratos

### API — `GET /v1/users/me/capabilities`

```yaml
auth: required
permissions: []
input_schema: none
output_schema: "{ capabilities: [{ role: string, orgId: string, verifiedAt: string|null }] }"
errors:
  401: no autenticado
effects:
  audit_log: no (solo lectura)
  domain_event: none
  sse: none
  payment_governance: none
```

### UI

```yaml
surfaces:
  - selector de capacidad activa en el header/dashboard
  - badge de capacidad en cada proyecto
states:
  - loading
  - empty
  - ready
  - forbidden
  - degraded
  - error
required_behavior:
  - la capacidad mostrada por defecto es la del contexto del proyecto abierto, no una preferencia guardada
```

### Agente/Prometeo

```yaml
tools:
  - users.get_capabilities (read-only)
input_schema: "{ userId: string }"
output_schema: "{ capabilities: [...] }"
source_citations_required: false
approval_policy: read-only, autoaprobable
forbidden_behavior:
  - Prometeo no debe asignar ni revocar capacidades directamente; eso pasa por el flujo de verificación existente por rol
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno nuevo; se lee el estado existente de
  `Membership`.
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md` (verificar que no
  contradiga ninguna invariante de rol único antes de aprobar).
- Eventos declarados: ninguno nuevo previsto; evaluar si conmutar de
  capacidad amerita un evento de auditoría ligero.
- Productor + outbox atómico: no aplica (sin escritura de dominio nueva).
- Consumidores + idempotencia: no aplica.
- Replay/rebuild: no aplica.
- DLQ/compensación: no aplica.

## 7. Datos y migración

- Modelos Prisma: `Membership` ya existente, sin cambios de schema
  previstos.
- Migración: no aplica salvo que el análisis de implementación revele
  necesidad de un campo de "última capacidad usada" (a decidir en fase de
  plan, no en esta spec).
- Estrategia expand/contract: no aplica.
- Backfill: no aplica.
- Compatibilidad hacia atrás: usuarios con una sola capacidad no ven
  cambio de comportamiento.
- Verificación de drift: no aplica.
- Rollback de código: revertir el selector de UI y el endpoint de lectura,
  sin impacto en datos.
- Rollback/forward-fix de datos: no aplica (no hay migración de datos).

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: tasa de uso del selector de capacidad; errores de contexto
  incorrecto reportados.
- Logs/traces/correlation: registrar capacidad activa en el correlation
  context de cada request, igual que `tenantId`.
- Health/readiness: sin cambio.
- Feature flags/allowlists: lanzar detrás de flag por tenant antes de
  promoción global.
- Plan de canary: `tenant_default` primero, siguiendo el patrón ya usado
  en F3.
- Evidencia de producción requerida: capturas/journeys de un usuario real
  con dos capacidades operando sin fricción.
- Señal de rollback: confusión de contexto reportada por soporte o
  auditoría cruzada entre capacidades.
- Owner operativo: semse-core.

## 9. Tests requeridos

- [ ] Unitarios del dominio/proyección
- [ ] Contrato API/BFF
- [ ] Permiso denegado y aislamiento tenant/org
- [ ] Validación y conflicto de estado
- [ ] Idempotencia/reintento/concurrencia
- [ ] Migración y compatibilidad
- [ ] UI loading/empty/forbidden/degraded/error
- [ ] Canary o smoke autenticado en producción

## 10. Mapa de implementación

### API

- `apps/api/src/modules/auth/` (endpoint de lectura de capacidades)

### Web

- `apps/web/app/(app)/*/account/page.tsx` (selector de capacidad)
- `apps/web/app/components/account/AccountCenter.tsx`

### Worker/Packages/DB

- `packages/db/prisma/schema.prisma` (sin cambio previsto; confirmar en fase de plan)

### Tests

- `apps/api/test/` (contrato del endpoint nuevo)
- `tests/unit/` (selector de capacidad)

## 11. Investigación externa

1. "multi-role single user account marketplace platform switch between
   client and provider role UX 2025" — [Multi-Role UX: The 2026 Guide to
   Platform Design](https://createbytes.com/insights/designing-ux-for-multi-role-platforms)
2. "RBAC design pattern user multiple roles across organizations same
   account best practice" — [Organization and Role-based access control
   · Logto blog](https://blog.logto.io/organization-and-role-based-access-control)
3. "audit logging best practice user acting under different role context
   correlation multi-tenant" — [Google Cloud Logging — Best practices for
   Cloud Audit Logs](https://docs.cloud.google.com/logging/docs/audit/best-practices)

**Hallazgos aplicables:**

- El patrón recomendado por Logto ("separar scope de rol": el permiso no
  cambia por org, lo que cambia es el scope/org donde aplica) coincide
  exactamente con el modelo ya existente de `Membership(userId, orgId,
  roleId)` — confirma que esta spec no necesita nuevos roles, solo exponer
  el scope ya modelado. Evita "role explosion" (crear roles nuevos tipo
  "cliente-y-profesional") que el mismo artículo señala como antipatrón.
- Marketplaces multi-rol reales (Etsy, Amazon) mantienen interfaces
  distintas por rol pero bajo la misma cuenta — confirma el enfoque de
  "capacidad activa por contexto" en vez de una cuenta separada por rol.
- El hallazgo de auditoría (Google Cloud) es más específico que lo que
  esta spec tenía originalmente: el registro debe incluir explícitamente
  actor, rol bajo el cual actuó, tenant/org y el resultado de la
  verificación de permiso — no solo "capacidad usada". Se incorpora a la
  sección 3 (requisitos de auditoría) y al contrato de la sección 5.

**Aplicado ahora:** el criterio de auditoría de la sección 3 se amplía para
registrar actor + rol activo + org + resultado de permiso, siguiendo el
hallazgo de Google Cloud Logging, en vez de solo "capacidad usada".

**Backlog:** evaluar si con el tiempo aparece "role explosion" real (más de
2-3 capacidades simultáneas por usuario) que justifique un selector más
sofisticado que el propuesto aquí.

**Descartado:** no se crea un rol combinado nuevo (ej. "cliente-profesional")
— confirmado como antipatrón por la investigación.

## 12. Gates de cierre

- [x] Aprobación explícita recibida — `status: DRAFT -> APPROVED` 2026-08-04.
- [x] Investigación externa (§11) completada antes de `APPROVED`.
- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
