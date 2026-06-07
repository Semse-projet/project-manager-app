# Integration Execution Plan

## Fuente Canonica

Este plan se deriva de:

- [`/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md`](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)

Y se traduce tecnicamente en:

- [`/home/yoni/labsemse/project-manager-app/docs/foundation`](/home/yoni/labsemse/project-manager-app/docs/foundation)

## Objetivo

Cerrar el frente de integracion mas riesgoso sin romper contratos existentes:

- `packages/db/prisma/schema.prisma`
- `packages/schemas`
- `apps/api/src/modules/ops`
- `apps/web`

## Principios de Ejecucion

- la vision manda sobre la herencia tecnica
- los cambios deben ser aditivos si existe riesgo de romper runtime heredado
- frontend y ops consumen reglas del backend, no las redefinen
- ownership debe leerse por organizacion, no solo por usuario o tenant
- errores `403/404/409` deben preservarse hasta la UI

## Bloques

### Bloque 1. Prisma

Objetivo:

- alinear ownership y contratos del dominio con la vision

Trabajo:

- exponer referencias por organizacion en `JobReservation`
- exponer referencias por organizacion en `Contract`
- preservar referencias heredadas por usuario para firma y auditoria

Salida:

- schema aditivo y coherente con `DOMAIN_MODEL_MVP.md`

### Bloque 2. Shared Schemas

Objetivo:

- hacer que `packages/schemas` describa el dominio real y no solo la herencia

Trabajo:

- alinear payloads de `jobs`, `reservations`, `contracts`
- publicar contratos de `projects`
- publicar contratos de `ops`

Salida:

- shared schemas listos para backend, web y documentacion

### Bloque 3. Ops Backend

Objetivo:

- exponer metricas y estados que no contradigan la vision ni el backend endurecido

Trabajo:

- mantener compatibilidad con estados heredados
- añadir campos cercanos al flujo canonico
- no reintroducir bypasses de permisos

Salida:

- `ops.dashboard` mas coherente y mas util para UI

### Bloque 4. Web

Objetivo:

- hacer que la UI consuma el contrato real sin asumir acceso universal

Trabajo:

- preservar `403/404/409` en el proxy `web -> api`
- degradar con warnings cuando falte acceso parcial
- no convertir errores de permisos en errores genericos de integracion

Salida:

- control surface y cortex tolerantes a permisos reales y datos parciales

### Bloque 5. Validacion

Objetivo:

- confirmar que la integracion queda lista para revision tecnica

Trabajo:

- `prisma generate`
- `build:api`
- `build:web`
- smoke de `projects` y, si aplica, checks de `ops/web`

Salida:

- estado validado o lista honesta de bloqueos

## Riesgos Actuales

- `Project` sigue siendo agregado transitorio
- auth real sigue pendiente; headers siguen siendo bootstrap tecnico
- el proxy `apps/web/app/api/semse` puede ocultar errores upstream si no se preservan bien
- `ops` y `web` tienen cambios locales previos que no deben pisarse

## Definition of Done

- Prisma, schemas, ops y web describen el mismo ownership y los mismos estados
- el proxy web preserva semantica de errores reales
- la UI tolera acceso parcial sin romperse
- los contratos compartidos quedan alineados con la vision canonica
- la validacion deja evidencia clara de lo que paso y lo que falta
