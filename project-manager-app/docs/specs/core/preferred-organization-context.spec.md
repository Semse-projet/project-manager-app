---
id: "core.preferred-organization-context"
title: "Preferred organization — non-authoritative navigation preference"
domain: "core"
sdd_version: "2.0"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "low"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - docs/architecture/ADR-040-ws01c-identity-organization-context.md
  - docs/ws-01c/WS-01C-Naming-Collision-Register.md
  - docs/specs/core/universal-identity-multi-role.spec.md
  - docs/specs/core/org-membership-status.spec.md
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: ""
---

# Spec: Preferred organization — non-authoritative navigation preference

> Contrato ejecutable SDD 2.0. Esta spec queda `DRAFT` a propósito — no hay
> código implementado todavía, ni se debe implementar contra esta versión
> sin promoverla primero a `APPROVED` con sign-off explícito, per AGENTS.md.
> Existe para dejar registrado el diseño acordado (ADR-040, "Reconciliation
> decision 2026-09-18 (owner)") antes de que cualquier agente futuro
> implemente algo que se le parezca.

## 1. Problema y resultado

**Para quién:** cualquier usuario con `Membership` en más de una `Org` (el
caso típico: alguien que opera tanto en su contexto Personal/Cliente como en
el de una empresa/contratista — ver `universal-identity-multi-role.spec.md`
para el modelo de capacidades por rol que esta spec no reemplaza).

**Problema:** SEMSE OS no recuerda en qué organización estaba trabajando un
usuario la última vez. Cada sesión/navegación arranca sin ese contexto,
obligando a re-orientarse (¿en qué proyectos/organización estoy parado?) en
vez de aterrizar directo en lo relevante.

**Resultado esperado:** el shell puede recordar y pre-seleccionar la
organización con la que el usuario trabajó más recientemente para ordenar
superficies org-agnósticas (Home, Work, Create, notificaciones, default de
creación de un recurso nuevo) — **sin que esa preferencia otorgue, deniegue
ni influya en ninguna autorización real**.

## 2. Alcance

### Incluido

- Un campo de preferencia (`preferredOrganizationId`, nombre reservado en
  `docs/ws-01c/WS-01C-Naming-Collision-Register.md`) que el shell puede leer
  para ordenar/priorizar superficies org-agnósticas.
- Actualización de esa preferencia cuando el usuario navega activamente a
  una organización distinta (ver Escenarios).
- Pre-selección (no auto-asignación) de organización en flujos de creación
  de recursos nuevos que hoy no tienen ya un org determinado por otro medio
  (ej. "publicar un job" desde cero).

### Fuera de alcance

- **Cualquier forma de autorización.** Esta spec no introduce, reemplaza ni
  toca `rbac.ts`, ningún guard, ni ningún scope de query Prisma. Ver
  Invariante de seguridad más abajo — es la razón de ser de esta spec.
- Reintroducir un mecanismo de "active org"/"context switch" con forma de
  sesión — eso fue evaluado y rechazado explícitamente en `ADR-040`
  ("Reconciliation decision 2026-09-18 (owner)"). Esta spec es justamente lo
  que sobrevivió de esa evaluación.
- Cambiar cómo `universal-identity-multi-role.spec.md` deriva la capacidad
  activa por recurso — sigue derivándose 100% del proyecto/org abierto.
- Tocar `OperatorContext`, el `workspaceId` de Prometeo, o el módulo
  `apps/api/src/modules/workspace/` (UI shell de Mission Control) — tres
  colisiones de nombre ya documentadas, ninguna relacionada con esta spec.
- Multi-dispositivo/multi-sesión sync de la preferencia — puede vivir
  server-side o local; si vive server-side, no hay requisito de que
  converja entre pestañas/dispositivos en esta primera versión.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Usuario autenticado con ≥1 `Membership` | ninguno nuevo — lectura/escritura de su propia preferencia, no de un recurso | la preferencia es un dato del `User`, no de un `Org`/`Tenant` | leer y actualizar su propia `preferredOrganizationId` | usar la preferencia para leer o mutar un recurso de una org en la que no tiene `Membership` `ACTIVE` |

- **Tenant boundary:** no aplica — la preferencia no es un dato tenant-scoped, es una propiedad del `User` (aunque su *valor* sea un `orgId`).
- **Ownership/resource policy:** sin cambio. Ningún endpoint de recurso (job, milestone, evidence, payment, change order) puede leer esta preferencia como parte de su resolución de autorización. Ver invariante de seguridad.
- **Step-up o aprobación humana:** no aplica — cambiar la preferencia nunca es una acción sensible.
- **Datos `privacyCritical`:** no — es un `orgId` que el usuario ya puede ver (viene de sus propios `Membership`s).
- **Requisitos de auditoría:** ninguno nuevo. Cambiar la preferencia no es una acción material — no genera `AuditEvent`. (Si en el futuro se decide que sí conviene trazarla para soporte/debug, sería un `DomainEvent` de UX, nunca un evento de seguridad.)

### Invariante de seguridad (la razón de ser de esta spec)

> Ningún campo con forma de "active org"/"current workspace"/"session
> context" puede ser jamás un input de un check de `rbac.ts`, un scope de
> query Prisma, o un guard de controller. `preferredOrganizationId` existe
> exactamente para nombrar ese límite de forma que sea imposible de ignorar
> en un code review: el nombre mismo dice "preferencia", no "contexto" ni
> "sesión".

Esta invariante viene directo de `ADR-040` y no es negociable dentro de esta
spec — cualquier futura extensión que la viole necesita su propio ADR, no
una extensión silenciosa de esta.

## 4. Escenarios y criterios de aceptación

### P1 — Preselección en creación de recurso nuevo

```gherkin
DADO un usuario con preferredOrganizationId = "org_b" y Membership ACTIVE en org_a y org_b
CUANDO abre el flujo de "publicar un job" (que hoy no tiene ya una org determinada)
ENTONCES el formulario pre-selecciona org_b como organización del nuevo job
Y el usuario puede cambiarla a org_a antes de enviar
Y al enviar, el backend valida Membership/capability para la org efectivamente enviada (org_a o org_b, lo que el usuario haya dejado), nunca asume la preferencia como ya autorizada
Y la organización validada en ese momento queda grabada como dueña real del nuevo recurso
```

### P2 — La preferencia nunca autoriza un recurso existente

```gherkin
DADO un usuario con preferredOrganizationId = "org_b" y SIN Membership en org_c
CUANDO pide leer o mutar un recurso que pertenece a org_c
ENTONCES el backend deriva la organización del recurso mismo (org_c), nunca de la preferencia
Y la autorización se evalúa contra Membership del usuario en org_c
Y la respuesta es la misma (denegada) sin importar qué valor tenga preferredOrganizationId
```

### P3 — Actualización de la preferencia por navegación activa

```gherkin
DADO un usuario con Membership ACTIVE en org_a y org_b, preferredOrganizationId = "org_a"
CUANDO navega activamente a una superficie de org_b (ej. abre un proyecto de org_b)
ENTONCES preferredOrganizationId se actualiza a "org_b"
Y esa actualización no requiere ni dispara ninguna re-evaluación de permisos — es solo UX
```

Casos borde:

- [ ] Usuario sin ninguna `Membership` `ACTIVE` (todas `SUSPENDED`/`REVOKED`) — la preferencia no debe apuntar a una org donde ya no tiene acceso; degradar a "sin preferencia" (estado `empty`, no un error)
- [ ] `preferredOrganizationId` apunta a una org que fue eliminada/el `Membership` fue revocado desde la última vez — el flujo de creación debe manejarlo como si no hubiera preferencia, no crashear
- [ ] Cross-org/cross-tenant: preferencia apuntando a una org de OTRO tenant (no debería poder pasar si se valida al escribir, pero el criterio de aceptación explícito es que aunque pasara, ningún endpoint de recurso la usaría para autorizar nada — ver invariante de seguridad)

## 5. Contratos

### API — `GET /v1/me/preferences/organization`

```yaml
auth: required
permissions: []
input_schema: none
output_schema: "{ preferredOrganizationId: string | null }"
errors:
  401: no autenticado
effects:
  audit_log: no
  domain_event: no
  sse: no
  payment_governance: no
```

### API — `PUT /v1/me/preferences/organization`

```yaml
auth: required
permissions: []
input_schema: "{ organizationId: string }"
output_schema: "{ preferredOrganizationId: string }"
errors:
  400: organizationId vacío o mal formado
  401: no autenticado
  409: el usuario no tiene ningún Membership (de cualquier status) para esa org — no se puede preferir una org con la que no tiene relación alguna
effects:
  audit_log: no
  domain_event: no
  sse: no
  payment_governance: no
```

> Nombres de ruta y de campo son propuestas — deben revalidarse contra
> `docs/ws-01c/WS-01C-Naming-Collision-Register.md` en el momento de
> implementar, no asumir que siguen libres si pasó tiempo desde esta spec.

### UI

```yaml
surfaces:
  - selector opcional en el header/nav del shell (no obligatorio para v1 — puede ser puramente implícito por navegación, ver P3)
  - pre-selección en formularios de creación org-agnósticos (ej. Post a Job)
states:
  - loading
  - empty          # sin preferencia — no es un error
  - ready
  - forbidden       # no aplica realmente (no hay autorización que fallar), incluido por completitud de estados obligatorios
  - degraded        # preferencia apunta a una org ya no accesible — degrada a empty, no crashea
  - error
required_behavior:
  - nunca renderizar la preferencia como si fuera autorización ("estás en org_b" no debe leerse como "tenés permiso sobre todo lo de org_b")
```

### Agente/Prometeo

```yaml
tools: []
input_schema:
output_schema:
source_citations_required: false
approval_policy: no aplica — sin acción sensible
forbidden_behavior:
  - Prometeo no debe usar preferredOrganizationId para decidir qué datos mostrar o qué acción tomar sobre un recurso — debe seguir la misma regla que el backend: autorización viene del recurso, no de la preferencia
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno — no es una entidad con ciclo de vida propio, es un campo de preferencia mutable.
- Invariantes: ninguna nueva en `docs/foundation/DOMAIN_INVARIANTS.md` — revisar si corresponde agregar la invariante de seguridad de la sección 3 ahí también, como recordatorio transversal, al implementar.
- Eventos declarados: ninguno — no genera domain event ni audit event (ver sección 3).

## 7. Datos y migración

- **Modelos Prisma:** una columna nueva, aditiva, en `User` (o tabla de preferencias separada si el equipo prefiere no tocar `User` directamente — decisión de implementación, no de esta spec): `preferredOrganizationId String?`, nullable, sin default forzado (null = sin preferencia).
- **Migración:** aditiva pura, sin backfill necesario (null es un estado válido y esperado para todo usuario existente).
- **Estrategia expand/contract:** no aplica — no reemplaza ningún campo existente.
- **Backfill:** ninguno.
- **Compatibilidad hacia atrás:** total — un cliente que no lee este campo simplemente no ve la preselección, sin romper nada.
- **Rollback:** eliminar la columna es seguro en cualquier momento — ningún otro sistema depende de su presencia (por invariante de diseño: no autoriza nada).

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna crítica — a lo sumo, tasa de uso de la preselección (adopción de producto, no operacional).
- **Logs/traces/correlation:** sin requisito especial.
- **Feature flags:** recomendado lanzarlo detrás de un flag simple, dado el patrón ya usado en `universal-identity-multi-role.spec.md` (`SEMSE_IDENTITY_CAPABILITY_UI_ENABLED`) — flag equivalente a definir al implementar.
- **Plan de canary:** interno/admin primero, luego una porción de usuarios con múltiples `Membership` reales (mismo bloqueo que ya tiene `org-membership-status.spec.md`: falta una query de solo lectura contra producción para dimensionar esa población).

## 9. Tests requeridos

- [ ] `PUT /v1/me/preferences/organization` rechaza una org donde el usuario no tiene ningún `Membership`
- [ ] `GET` devuelve `null` cuando no hay preferencia (no un error, no un 404)
- [ ] Un endpoint de recurso arbitrario (ej. lectura de un milestone) da el mismo resultado de autorización con y sin `preferredOrganizationId` seteado — prueba negativa directa de la invariante de seguridad
- [ ] Preferencia apuntando a una org con `Membership` `REVOKED`/`SUSPENDED` degrada a estado `empty` en el flujo de creación, no crashea
- [ ] UI: los 6 estados obligatorios cubiertos (loading/empty/ready/forbidden/degraded/error)

## 10. Mapa de implementación

### API

- `apps/api/src/modules/users/` (o un módulo nuevo `preferences/` si `users` ya está sobrecargado — decisión de implementación)

### Web

- Formulario de creación de job (`apps/web/app/(app)/client/jobs/new/`) y cualquier otro flujo org-agnóstico identificado al implementar
- BFF proxy nuevo en `apps/web/app/api/semse/[module]/route.ts` per `semse-bff-pattern`

### Worker/Packages/DB

- `packages/db/prisma/schema.prisma` (columna aditiva)

### Tests

- `apps/api/test/...`

## 11. Investigación externa

- Reporte con tres búsquedas primarias: no ejecutado en esta pasada — esta spec es síntesis de una decisión de arquitectura ya tomada (ADR-040), no investigación de mercado nueva.
- Aplicado ahora: n/a
- Backlog: si conviene investigar patrones de "recently viewed workspace" de otras plataformas multi-tenant antes de implementar la UI, queda para la fase de `plan`.
- Descartado: n/a

## 12. Gates de cierre

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

**Antes de cualquiera de estos gates: promover `status` de `DRAFT` a
`APPROVED` requiere sign-off explícito del owner de producto, per
`AGENTS.md`. Esta spec no autoriza implementación tal como está.**
