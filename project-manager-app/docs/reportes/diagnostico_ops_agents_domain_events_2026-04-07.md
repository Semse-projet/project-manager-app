# Diagnóstico de agents, ops y domain-events

Fecha: 2026-04-07
Ruta objetivo: `/home/yoni/labsemse/project-manager-app`

## Pregunta

Validar si el backend que sostiene `/admin/ops` tiene estos huecos:

- `agents` sin `policy.ts`
- `ops` sin `repository.ts`
- `domain-events` solo como infraestructura, sin controller ni endpoint formal
- confirmar existencia de `/v1/ops/agent-runtime`

## Resultado

### 1. `/v1/ops/agent-runtime` sí existe

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ops/ops.controller.ts`

Endpoints confirmados:

- `GET /v1/ops/agent-runtime`
- `GET /v1/ops/agent-runtime/:correlationId`

Protección:

- `@RequirePermissions("ops:dashboard:read")`

## Hallazgos

### Hallazgo A

`agents` no tiene `policy.ts`, pero no está sin control de acceso.

Archivos:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/agents/agents.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/permissions.decorator.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/rbac.guard.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/rbac.ts`

Lectura:

- la policy no está por módulo, está centralizada
- `agents.controller.ts` usa `@RequirePermissions(...)`
- `RbacGuard` aplica esas reglas
- `rbac.ts` asigna permisos por rol

Conclusión:

- no es correcto decir que `agents` está “sin control de acceso por rol”
- sí es correcto decir que no tiene una `policy.ts` dedicada del módulo
- eso es una deuda de organización, no una ausencia de enforcement

### Hallazgo B

`ops` sí mezcla orquestación con acceso directo a Prisma.

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ops/ops.service.ts`

Lectura:

- `OpsService` consulta `auditLog`, `agentRun`, `riskScore`, `job`, `project`, `dispute` directo por `PrismaService`
- no existe `ops.repository.ts`

Conclusión:

- este hueco sí es real
- el módulo funciona, pero tiene deuda de separación de capas
- si `admin/ops` va a crecer, conviene extraer `OpsRepository`

### Hallazgo C

`domain-events` sigue siendo infraestructura interna, no superficie pública.

Archivos:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/domain-events/domain-events.module.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/domain-events/domain-event-bus.service.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/domain-events/agent-trigger-router.service.ts`

Lectura:

- el módulo exporta `DomainEventBus`
- no tiene controller
- no expone endpoints HTTP

Conclusión:

- este punto también es real
- hoy `domain-events` es una infraestructura interna consumida por `jobs`, `milestones` y `disputes`
- no existe todavía una API formal para emitir/inspeccionar eventos desde afuera

## Evaluación final

Diagnóstico corregido:

- `agents`:
  - sin `policy.ts` propia: sí
  - sin control de acceso por rol: no

- `ops`:
  - sin `repository.ts`: sí
  - hoy consulta Prisma directo desde el service: sí

- `domain-events`:
  - solo infraestructura interna, sin controller ni endpoint formal: sí

- `/v1/ops/agent-runtime`:
  - sí existe y está protegido por RBAC

## Prioridad recomendada

1. extraer `OpsRepository` para consolidar queries de runtime, audit y risk;
2. decidir si `domain-events` debe seguir siendo solo interno o si necesita controller;
3. si `agents` crece en reglas de acceso, crear `agents.policy.ts` como capa explícita de permisos semánticos.
