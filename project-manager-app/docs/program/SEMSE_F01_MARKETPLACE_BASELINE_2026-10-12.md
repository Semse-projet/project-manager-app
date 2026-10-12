# SEMSE — F01 Marketplace: línea base y contrato de verificación

**Fecha:** 2026-10-12 · **Estado:** `READ_ONLY_PARTIAL / E2E_ACTUAL_NO_VERIFICADO` · **Origen:** fase 0 del programa de 36 flujos.  
**Fuente de inspección:** rama `main`, commit de referencia `fd902626a7ce84987eda6b741f44f65242df9de1`. **Esta ficha no es un resultado de ejecución de tests.**  
**Skills aplicadas como protocolo:** `semse-business-flow-e2e`, `semse-synthetic-test-data`, `semse-railway-release-verification` y `semse-backup-restore-verification` (su incorporación al repositorio está propuesta en PR #889).

## 1. Contrato de negocio y dueños canónicos

**Actores:** CLIENT publica/contrata; PRO oferta; OPS_ADMIN supervisa bajo permisos aprobados. Cliente propietario no puede ofertar su propio trabajo. Recurso primario `Job`, su `Bid`, el `Project` materializado tras adjudicar y la eventual cadena Contract→Milestone→Evidence→Approval→Escrow/Payment.

**Recorrido obligatorio del Marketplace (diferente del recorrido por reserva):**
`CLIENT crea Job → publica → PRO ajeno al org propietario crea Bid → CLIENT ve propuestas → CLIENT acepta Bid → proyecto/contrato coherentes → ejecución y evidencia → aprobación → pago simulado gobernado → cierre y reputación`.

**Ramas separadas que no prueban por sí mismas F01:** reserva/aceptación de reserva; proyecto privado sin puja; orden directa; trabajador pagado por horas. No obligar hitos/escrow donde el contrato de modalidad no corresponda.

## 2. Evidencia de código y documentación inspeccionada

| Superficie | Evidencia comprobada en repositorio | Qué NO demuestra |
|---|---|---|
| Contrato Jobs/Bids | `docs/specs/api/jobs.spec.md`: `status: VERIFIED` con `last_verified: 2026-07-23`; `docs/specs/operations/jobs-bids-event-projection.spec.md`: `IMPLEMENTED`, canario no verificado. | La fecha histórica de spec no prueba el recorrido E2E de octubre. |
| Job HTTP | `apps/api/src/modules/jobs/jobs.controller.ts` declara `POST /v1/jobs`, `POST /v1/jobs/:jobId/transition`, GET de detalle/lista, permisos del actor. | No acredita respuesta real, transiciones bajo sesión autenticada ni persistencia en el deploy actual. |
| Bid HTTP | `apps/api/src/modules/bids/bids.controller.ts`: `POST /v1/jobs/:jobId/bids`, `POST /v1/bids/:bidId/accept`, listados de bids, actor y organización propagados. | No demuestra autorización multiempresa ni carrera entre dos accepts en DB real. |
| Bid service | `apps/api/src/modules/bids/bids.service.ts`: delegación al repositorio, `AuditService.append`, SSE y notificaciones. | Side effects notificación pueden ser best-effort; auditar qué es transaccional y qué se reintenta, sin atribuir atomicidad automáticamente. |
| Unit de propuestas | `apps/api/test/marketplace-bids.test.ts` declara expresamente «Sin DB, sin HTTP»; valida ejemplos de inputs/estados. | No prueba controlador, Prisma, aislamiento ni integración de Job→Bid→Project. |
| E2E existente | `tests/e2e-semse/job-lifecycle-rating.spec.ts` recorre Job→**Reservation**→Contract→Escrow `paymentMethod: mock`→Milestone→Evidence→Release→rating usando cabeceras de prueba. | No recorre `POST /v1/jobs/:id/bids` + `POST /v1/bids/:id/accept`; no acredita login Bearer real, provider real, JWT/identidad productiva, ni su ejecución reciente. Preservar esta suite como cobertura adyacente, no duplicarla. |
| UI | `docs/specs/ui/client-flows-remediation.spec.md` documenta rutas reales `/client/*`, correcciones históricas y pendientes de validación; la app tiene `/client/jobs/new` y `/client/marketplace`. | No asegura correspondencia entre el wizard UI y una respuesta completa del API/worker en producción. |
| Events/worker | `docs/runbooks/JOBS_BIDS_PROJECTION_CANARY.md` indica canario `tenant_default` activado el 2026-10-11, read-through OFF, **no verificado** por falta de evento+receipt+ventana de observación. | `deployment SUCCESS` no prueba `DomainOutboxEvent→consumer→projection`. |
| Riesgo transversal | PR #885 `https://github.com/Semse-projet/project-manager-app/pull/885` en draft para hipótesis de membresía de servicio worker. | No inferir que ese PR corrigió las colas ni ejecutar script de membresías en producción sin autorización y preflight. |

**Conclusión de línea base:** existen piezas funcionales a nivel de código y cobertura histórica, pero F01 no está acreditado como `SIMULADO_VALIDADO`, `PRODUCCION_TECNICAMENTE_VERIFICADA` ni `PILOTO_REAL_VALIDADO` para el SHA actual. No se ha ejecutado todavía un E2E Marketplace específico y autenticado en esta intervención.

## 3. Contrato mínimo de datos sintéticos

Usar `testRunId` único y seed fijo, sobre DB efímera/local o staging **segregado** (nunca datos de prueba en tenant productivo):
- Tenant A: organización cliente A1, profesional A2, profesional competidor A3; actor CLIENT, dos PRO, supervisor autorizado.
- Tenant B: organización cliente B1 y profesional B2; actor ajeno que jamás debe leer/escribir recursos del tenant A.
- Job `TEST_<runId>_job`, dos Bids con importes/ETA explícitos, estados válidos, contrato falso verificable, Evidence de bytes sintéticos con SHA-256, hito aprobado y pago **mock/sandbox**.
- Identificar datos por `testRunId`, capturar DB rows/eventos/auditoría, conservar trazas sanitizadas y ejecutar teardown idempotente limitado a esa ejecución.
- No inventar modelo Prisma, permiso o evento; cotejar `packages/db/prisma/schema.prisma`, schemas Zod y `EVENT_CATALOG.md` antes de crear fixtures.

## 4. Batería priorizada de escenarios de aceptación

| ID | Escenario | Gate / aserción exigida |
|---|---|---|
| F01-A01 | CLIENT crea y publica un Job | API 2xx y `Job` leído bajo identidad del mismo org con estado canónico y AuditLog. |
| F01-A02 | PRO A2 consulta Marketplace y envía Bid | Bid asociada a Job visible, monto/ETA validado, creada una sola vez. |
| F01-A03 | CLIENT lee dos ofertas y acepta A2 | Solo Bid A2 `ACCEPTED`, A3 rechazada según política, Job/Project coherentes y relación propietario-proveedor correcta. |
| F01-A04 | Proyecto→contrato→hitos→evidencia→aprobación | Transiciones válidas, archivos sintéticos íntegros, aprobación y auditoría verificadas con lectura real. |
| F01-A05 | Pago mock y cierre | No liberar sin evidence/contract/approval/financial gates; un retry no duplica release; sin provider real. |
| F01-N01 | PRO del mismo org cliente intenta ofertar propio Job | Operación rechazada por policy; no crea Bid. |
| F01-N02 | Tenant B consulta/acepta Bid o Job del A | 403/404 sin revelar existencia y sin alteración en DB. |
| F01-N03 | Actor sin membresía activa intenta escribir | 401/403 según auth; no dejar bypass por `x-roles` en entornos JWT reales. |
| F01-N04 | Cliente ajeno acepta una Bid de A | 403/404 y estado sin cambios. |
| F01-N05 | Dos peticiones aceptan ofertas diferentes en paralelo | Solo una ganadora, transacciones concurrentes sin doble Project/Contract/escrow. |
| F01-N06 | POST repetido/timeout/worker retry | Idempotencia y evento outbox/receipt únicos en resultado, sin notificaciones económicas falsas. |
| F01-N07 | Evidencia faltante/corrupta/no aprobada | Release bloqueada; registrar code, motivo, audit, correlación. |
| F01-N08 | Sesión revocada o token inválido | Sin acceso; no usar bypass de auth en prueba que se etiquete «producción autenticada». |
| F01-E01 | Canary projection tenant aislado | Evento de bid publicado, receipt `COMPLETED`, duplicado sin segundo efecto y observabilidad dentro de SLO. |
| F01-E02 | Recuperación de Evidence | Fixture SHA-256 pasa; respaldo REAL únicamente con restauración separada autorizada y conciliación PostgreSQL. |

## 5. Secuencia de implementación segura (sin saltar SDD)

1. Reconciliar `jobs.spec.md`, `bids.spec.md`, FSM, schema y repositorio, validar estatus APPROVED y contratos de ids/ownership. Abrir spec/plan/tasks si se necesitan garantías nuevas.
2. Preparar fixtures aislados y harness de autenticación realista, sin hardcode de credenciales productivas ni escritura externa.
3. Añadir un E2E específico **Bid→Accept**, reutilizando `tests/e2e-semse/` y las suites existentes. Hacer primero los tests negativos multi-org/tenant/concurrencia.
4. Ejecutar `pnpm spec:validate:strict`, `pnpm test:unit`, tests de API integración y `pnpm test:e2e` relevantes, registrando comandos, SHA, run ID y entornos. Si no hay acceso local/CI, marcar `UNVERIFIED`, no `PASS`.
5. Cerrar hallazgos por PR pequeño y gobernado. Pruebas sintéticas primero; CI+review antes de merge. Desplegar por cadena de release controlada y observar canario con recursos de prueba explícitos y sin dinero real.
6. Solicitar piloto real solamente después del gate técnico y autorizaciones/privacidad; registrar `PENDIENTE_PILOTO_REAL` hasta entonces.

## 6. Estado y siguiente intervención

- `spec`: **HISTÓRICAMENTE VERIFIED; requiere reconciliación vigente**.
- `code`: **rutas Jobs/Bids y servicios presentes en `main`**.
- `unit`: **fuentes de test presentes; no ejecutadas en esta intervención**.
- `integration`: **no comprobada aquí**.
- `e2e_synthetic`: **suite adyacente de reserva presente; F01 Bid→Accept no ejecutado ni demostrado**.
- `CI/merge/deploy/activation`: **no atribuir éxito a F01 sin evidencia propia del SHA**.
- `production`: **canario de proyección declarado activado, no verificado**.
- `real_pilot`: **PENDIENTE_PILOTO_REAL**.
- **Próxima acción concreta:** identificar harness de API multi-tenant y fixtures existentes; construir una prueba F01 Bid→Accept sin pagos externos en rama separada, verificar que sea reproducible y cerrar gaps específicos en specs antes de escribir cambios funcionales.

No se ejecutaron semillas, scripts de membresía worker, pagos, migraciones, escrituras a Railway ni restores en esta auditoría documental.
