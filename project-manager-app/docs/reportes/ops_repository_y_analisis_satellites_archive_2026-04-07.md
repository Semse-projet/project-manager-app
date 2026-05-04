# OpsRepository y análisis de satellites-archive

Fecha: 2026-04-07
Ruta objetivo: `/home/yoni/labsemse/project-manager-app`

## Objetivo

1. cerrar el hueco real del backend en `ops` extrayendo acceso a datos a un repository;
2. analizar `satellites-archive` para ubicar material útil que permita abordar los demás huecos:
   - `policy.ts` explícita;
   - `domain-events` como superficie formal;
   - mejor separación de runtime / views / repositorios.

## Implementación aplicada en el core

### Nuevo repository de ops

Archivo creado:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ops/ops.repository.ts`

Se extrajeron a esta capa las lecturas de:

- `auditLog`
- `agentRun`
- `agentRun` por `correlationId`
- auditoría para runtime trace
- `riskScore`
- agregados de dashboard
- `job` recientes con proyecto activo

### Integración en el módulo

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ops/ops.module.ts`

Cambio:

- `OpsRepository` agregado a `providers`

### Simplificación del service

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ops/ops.service.ts`

Resultado:

- `OpsService` deja de consultar Prisma directo para runtime, audit, risk y dashboard
- pasa a usar `OpsRepository`
- queda más cerca del patrón ya usado en otros módulos

## Verificación

Comando ejecutado:

- `npm run build:api`

Resultado:

- compila correctamente

## Análisis de satellites-archive

Ruta analizada:

- `/home/yoni/labsemse/app semse/_satellites-archive/project-manager-copi`

## Hallazgo 1: patrón repository ya validado

Archivos:

- `/home/yoni/labsemse/app semse/_satellites-archive/project-manager-copi/apps/api/src/modules/field-ops/field-ops.service.ts`
- `/home/yoni/labsemse/app semse/_satellites-archive/project-manager-copi/apps/api/src/modules/field-ops/field-ops.module.ts`

Lectura:

- `FieldOpsService` es fino
- valida entradas y delega a `FieldOpsRepository`
- el módulo exporta ambos

Conclusión:

- este satélite confirma que el camino correcto para `ops` era exactamente ese refactor

## Hallazgo 2: existe un patrón explícito de policy

Archivo:

- `/home/yoni/labsemse/app semse/_satellites-archive/project-manager-copi/apps/api/src/modules/agent-runtime/agent-runtime.policy.ts`

Lectura:

- la policy no reemplaza RBAC
- agrega reglas semánticas y de seguridad sobre acciones concretas
- clasifica comandos como:
  - `ALLOW`
  - `APPROVAL_REQUIRED`
  - `BLOCKED`

Conclusión:

- esto sirve como referencia para crear futuras `policy.ts` de módulo
- especialmente útil si `agents` o `domain-events` necesitan reglas más expresivas que “permiso sí/no”

## Hallazgo 3: existe un controller formal para runtime

Archivo:

- `/home/yoni/labsemse/app semse/_satellites-archive/project-manager-copi/apps/api/src/modules/agent-runtime/agent-runtime.controller.ts`

Lectura:

- el satélite expone un módulo formal con controller HTTP
- endpoints claros para:
  - `providers`
  - `attached`
  - `status`
  - `audit`
  - `bootstrap`
  - `attach`

Conclusión:

- esto es el mejor referente interno para decidir cómo formalizar `domain-events` si se expone
- no conviene exponer servicios internos “tal cual”; conviene diseñar una superficie dedicada

## Hallazgo 4: existe separación tipo registry

Archivo:

- `/home/yoni/labsemse/app semse/_satellites-archive/project-manager-copi/apps/api/src/modules/agent-runtime/agent-runtime.registry.ts`

Lectura:

- el runtime persistente no vive dentro del service principal
- la persistencia y el mapping a DB viven en un `registry`

Conclusión:

- si `domain-events` crece, puede necesitar una separación parecida:
  - `bus`
  - `router`
  - `registry` o `repository`
  - `controller`

## Hallazgo 5: hay view models compartidos de runtime

Archivo:

- `/home/yoni/labsemse/app semse/_satellites-archive/project-manager-copi/packages/schemas/src/agent-runtime.view.ts`

Lectura:

- el satélite tipa explícitamente:
  - manifests
  - status
  - audit feed
  - command policies
  - attached providers

Conclusión:

- esto refuerza el patrón correcto para `domain-events` y `agent-runtime trace`:
  - contracts compartidos primero
  - luego controller/service/repository

## Hallazgo 6: documentación explícita sobre domain events

Archivo:

- `/home/yoni/labsemse/app semse/_satellites-archive/project-manager-copi/docs/foundation/SCHEMA_RUNTIME_ALIGNMENT.md`

Punto clave:

- `domain-events.schema.ts` está marcado como `Canonical`
- se recomienda exportarlo y convertirlo en fuente de workers/agentes/audit

Conclusión:

- el satélite empuja en la misma dirección que ya detectamos:
  - `domain-events` hoy existe en el core solo como infraestructura
  - el siguiente salto natural es volverlo una superficie más formal y tipada

## Síntesis estratégica

Después de revisar el satélite, la ruta para cerrar los huecos queda mucho más clara:

1. `ops`
   - ya corregido parcialmente con `OpsRepository`

2. `agents`
   - no necesita rehacer RBAC
   - sí puede ganar `agents.policy.ts` para reglas semánticas de operación

3. `domain-events`
   - no conviene exponer el bus interno sin diseño
   - conviene crear una superficie dedicada, inspirada en `agent-runtime.controller.ts`

4. `schemas`
   - cualquier formalización nueva debe salir desde contratos compartidos

## Siguiente paso recomendado

El siguiente refactor con mejor retorno sería:

1. crear `domain-events.controller.ts` con endpoints de inspección y reemisión controlada;
2. crear `domain-events.repository.ts` o `registry` para timeline/consulta;
3. si hace falta, crear `agents.policy.ts` para reglas de retry/requeue/manage más expresivas que RBAC simple.
