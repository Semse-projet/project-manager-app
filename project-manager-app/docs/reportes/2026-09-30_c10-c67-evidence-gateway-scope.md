# Reporte — C10/C67 Evidence Gateway: alcance tenant + org + proyecto (Wave A, lote A3/A4)

**Fecha:** 2026-09-30 · **Base:** main (post #700)

## Estado
- C10 (ROTA): **sigue abierta** (avance). Se cierra un hueco concreto de org-scope; otros módulos sin chequeo de org siguen en inventario (liens, tasks, reservations, ratings, trust, worker-verification).
- C67 (DUPLICADA): avance — el gateway pasa a reutilizar la política canónica `evidence/evidence.policy.ts` (ADR-028); sigue teniendo repositorio/servicio propio → consolidación de código pendiente.
- Hallazgo obsoleto: el P0 de ADR-040 sobre `payment-governance` (tenant-only) ya estaba corregido (`assertEscrowReadable`).

## Hallazgo (verificado en código)
`/v1/evidence/*` (EvidenceGatewayController, registrado en `app.module`):
1. Lecturas (`:projectId/milestone/:id/status`, `results/passed|failed|pending`) filtraban sólo por el `projectId` de la URL: **cualquier actor con `evidence:read` de cualquier tenant** podía leer estado de validación y `bucketKey` de evidencia ajena.
2. `upload` confiaba en `projectId`/`milestoneId` del body: se podía escribir evidencia en proyectos de otro tenant/org (la evidencia condiciona la preparación de pagos).
3. El stream SSE no validaba el proyecto.
4. Browser Agent (C77) llamaba a `uploadEvidence` con `projectId` no verificado.

## Cambios
- `evidence-gateway.service.ts`: `assertProjectAccess(actor, projectId, read|write)` con la política canónica; proyecto fuera del tenant → 404 (sin oráculo de existencia); org ajena → 403; hito debe pertenecer al proyecto. Lecturas y subida lo aplican.
- `evidence-gateway.repository.ts`: `getProjectOwnership`, `milestoneBelongsToProject`; consultas de evidencia filtran también por `tenantId`.
- `evidence-gateway.controller.ts`: pasa el actor completo; el stream autoriza antes de emitir.
- `browser-agent.{controller,service}.ts`: propaga org/roles del actor a la subida.
- Sin migraciones; sin cambios de contrato de respuesta.

## Tests
- Nuevo `test/evidence-gateway-scope.test.ts` (8): org dueña/OPS_ADMIN permitidos; otra org mismo tenant 403; otro tenant 404 sin consultar evidencia; tenant en cada query; hito de otro proyecto; upload rechazado antes de escribir; camino feliz.
- `evidence-gateway.controller.test.ts` adaptado a las nuevas firmas.
- API unit: 2561 tests, 2524 pass, 0 fail; `tsc`, lint y nest build OK.
- Nota: `evidence-gateway.service.spec.ts` (jest) se actualizó por coherencia, pero jest no parsea el repo (falla idéntica en main antes del cambio; fuera del runner de CI).

## Abierto
- Inventario de org-scope en módulos restantes (siguiente tanda A3).
- C67: migrar el repositorio/servicio propio del gateway a `evidence/` (ADR-028) tras observar tráfico; mantener IA ≠ aprobación humana.
- Probar con smoke autenticado multi-org tras deploy (no ejecutado).
