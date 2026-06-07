# Architecture Audit and Migration Backlog

## Objetivo

Traducir la vision canonica en un backlog tecnico priorizado sobre la
implementacion actual del monorepo.

Fuente canonica:

- [`/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md`](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)

## Hallazgos Principales

### Critico

1. `Project` sigue concentrando ejecucion operativa que la vision atribuye a `Job`.
2. estados historicos (`PUBLISHED`, `AWARDED`) siguen mezclados con el flujo canonico.
3. pagos y escrow siguen nombrados y expuestos desde la herencia de `Project`.

### Alto

4. `Evidence` estaba desacoplado de la arquitectura modular y solo hablaba en terminos de `projectId`.
5. `Trust` existe como señales dispersas, no como capa consolidada.
6. la transicion entre dominio objetivo y schema actual no estaba suficientemente explicitada.

### Medio

7. rutas y payloads antiguos pueden seguir incentivando decisiones centradas en `Project`.
8. watchers y runtimes duplicados introducen riesgo operativo en validaciones locales.

## Trabajo Ejecutado

### Hecho

1. Se alineo `foundation` con la vision canonica y se documento la precedencia.
2. Se documento la brecha entre vision e implementacion real.
3. `evidence` se movio a un modulo Nest real.
4. `evidence` ahora puede registrarse resolviendo `jobId`, `projectId` o `milestoneId`.
5. Se agrego ruta canonica `GET /v1/jobs/:jobId/evidence`.
6. Se mantuvo compatibilidad con `GET /v1/projects/:projectId/evidence`.

## Backlog Priorizado

### P0

1. Cerrar ownership y lectura segura de `evidence`.
2. Convertir `payments/escrow` a semantica centrada en `job/milestone` sin romper compatibilidad.
3. Reducir dependencia funcional de `Project` en `milestones`.

### P1

4. Expandir `JobStatus` hacia el flujo canonico visible del producto.
5. Introducir `JobReservation` como flujo runtime real, no solo entidad Prisma.
6. Introducir `Contract` como flujo runtime real, no solo entidad Prisma.

### P2

7. Consolidar `Trust` como modulo tecnico:
   - risk score
   - dispute rate
   - evidence completeness
   - first-pass approval
8. separar mejor estados de negocio, estados financieros y estados de disputa.

### P3

9. reducir o encapsular la capa legacy restante en `common/domain-service.ts`
10. revisar frontend para que consuma rutas y lenguaje canonicos

## Secuencia Recomendada

1. `evidence`
2. `payments/escrow`
3. `milestones`
4. `job status`
5. `reservations/contracts`
6. `trust`

## Criterio de Exito

Una migracion se considera correcta solo si:

- no rompe compatibilidad inmediata del API
- reduce centralidad de `Project`
- acerca el lenguaje del runtime al lenguaje canonico de `vision`
- deja pruebas o smoke verificables
