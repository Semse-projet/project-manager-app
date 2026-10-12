---
name: semse-business-flow-e2e
description: "Verificar end-to-end los 36 flujos de negocio, operaciones y plataforma de SEMSE, con escenarios multirol, negativos, trazabilidad y evidencias diferenciadas de pruebas sintéticas y pilotos reales."
---

# SEMSE — Business Flow End-to-End Verification
**Versión:** 1.0.0 | **Ámbito:** matriz de journeys F01–F36, pruebas y evidencia; sin alterar permisos ni crear nuevas APIs sin spec aprobada.

## Activación
Usar cuando se pida completar, auditar o probar un recorrido del Marketplace, proyectos privados, personal por horas, servicio, compras, Evidence, escrow, Prometeo o Mission Control. Acompañar con `aaa-zoom-loop-execution` y `semse-ci-pr-workflow`.

## Autoridad y límites
- Antes de actuar, leer `project-manager-app/AGENTS.md`, la constitución, `docs/SPEC_INDEX.md`, `docs/SOURCE_OF_TRUTH.md`, `docs/foundation/DOMAIN_INVARIANTS.md` y la spec del dominio correspondiente.
- `semseproject` y `semse-spec-kit-flow` gobiernan permisos, aprobaciones, trazabilidad y secuencia SDD. Esta skill no concede permisos de merge, gastos, pagos, secretos, escrituras en producción ni bypass de CI.
- Comprobar GitHub HEAD, branch, PRs concurrentes, specs, contratos, rutas reales y Railway antes de cambiar archivos. Elegir REUSE → EXTEND → ADAPT → CONSOLIDATE → NEW.
- Trabajar en rama y PR borrador; no modificar producción ni datos de terceros por implicación. Registrar incertidumbres como UNVERIFIED, no como éxito.
- Diferenciar: diseño ≠ código ≠ tests ≠ CI ≠ merge ≠ deploy ≠ activation ≠ piloto real.

## 1. Modelo de una ficha por flujo
Cada F01–F36 debe tener un contrato de aceptación independiente:
`flowId, nombre, modalidad, origen, actor, tenant/org, precondiciones, trigger, entrada UI, ruta API, FSM, dependencias, economía, evidenceRefs, auditRefs, expectedOutcome, negativeCases, tests, SHA, deploy, featureFlags, canary, realPilotPending`.
No tratar las 11 modalidades de negocio como 11 microservicios; reutilizar los 17 procesos y 8 capacidades de plataforma cuando sea pertinente.
No obligar `Estimate`, `Milestone`, `Escrow` ni `Contract` a todos los flujos por defecto: describir ramas opcionales y condiciones por modalidad.

## 2. Capas mínimas de pruebas
- `UNIT`: reglas, estados, policy, decisiones, límites; mocks de dependencias externos claramente identificados.
- `CONTRACT`: validación Zod/DTO, errores 4xx, payloads y eventos; cliente/web y API deben acordar.
- `DB_INTEGRATION`: PostgreSQL/Prisma reales de prueba, migraciones, relaciones, transacciones, outbox y queries por tenant.
- `E2E_SYNTHETIC`: UI/BFF/API/worker en entorno aislado; fixtures con `testRunId` y proveedores en sandbox.
- `STAGING_CANARY`: entorno no productivo con configuración representativa, datos sintéticos separados, protección de no envío externo.
- `PROD_CANARY`: operación autenticada, deliberada, limitada al recurso/actor de prueba, sin dinero, contratos ni proveedores reales salvo aprobación puntual.
- `REAL_PILOT`: una operación verdadera con usuarios autorizados, privacidad y aceptación humana; no sustituible por los seis niveles anteriores.

## 3. Escenarios que deben cubrirse por modalidad
1. Happy path completo desde intención hasta estado final observable mediante lectura autenticada; verificar los cambios de estado persistidos y el AuditLog.
2. Permisos por rol, `tenantId`, membresía de organización y ownership de objeto; 403/404/401 según contratos.
3. Evidencia faltante/rechazada; aprobación expirada o revocada; contrato no verificado; escrow no liberable cuando el gate falla.
4. Idempotencia de POST, doble clic, retries BullMQ, requeue de jobs, simultaneidad y fallos de API/DB/Redis/proveedor.
5. Cancelación, cambio de alcance, disputa, rollback/compensación y lectura consistente después de reiniciar servicios.
6. Accesibilidad básica, mobile first y idioma ES/EN cuando el flujo exponga UI.

## 4. Ejecución
- Leer `docs/SPEC_INDEX.md` y la spec concreta, identificar qué está VERIFICADO vs legacy. Seleccionar una sola skill principal + auxiliares.
- Inspeccionar todos los escritores y caminos alternativos; no suponer que la misma UI cubre todas las rutas.
- Referenciar `semse-synthetic-test-data` para factories de datos y test harness, nunca crear usuarios reales para facilitar pruebas.
- Escribir tests negativos antes de modificar el código afectado; capturar request/response redacted, estados DB, eventos y correlación.
- Ejecutar suites concretas y después regresión relevante (`pnpm test:unit`, integración, `pnpm test:e2e`, `pnpm spec:validate:strict`, build/CI aplicables). Reportar si el entorno no permite una de ellas.
- No convertir `CI verde` ni `Railway SUCCESS` en `flow verified`; exigir el recorrido funcional bajo el SHA desplegado.

## 5. Criterio de cierre
Mantener por flujo matriz `designed | implemented | unit | integration | e2e_synthetic | CI | merged | deployed | activated | prod_canary | real_pilot`, cada columna con URL/SHA/entorno/fecha/actor de prueba.
Estados admitidos: `UNVERIFIED`, `SIMULADO_VALIDADO`, `STAGING_VALIDADO`, `PRODUCCION_TECNICAMENTE_VERIFICADA`, `PILOTO_REAL_VALIDADO`. Si una capa requerida falla o está ausente, no declarar el flujo completo; dejar `PENDIENTE_PILOTO_REAL` explícito.
