---
name: semse-synthetic-test-data
description: "Preparar datos sintéticos deterministas, aislados por tenant y organización, con fixtures, factories, seed y teardown para probar los 36 flujos de SEMSE sin contaminar producción."
---

# SEMSE — Synthetic Test Data
**Versión:** 1.0.0 | **Ámbito:** exclusivamente fixtures/entornos de prueba; no reemplaza `semse-prisma-workflow` ni `semse-schemas-contract`.

## Activación
Usar cuando una tarea demande inventar clientes, profesionales, empresas, contratos, trabajos, horas, hitos, pagos sandbox, expedientes o fallos artificiales reproducibles. Seleccionar esta skill junto con `semse-prisma-workflow` para migraciones y `semse-security-baseline` para multiempresa.

## Autoridad y límites
- Antes de actuar, leer `project-manager-app/AGENTS.md`, la constitución, `docs/SPEC_INDEX.md`, `docs/SOURCE_OF_TRUTH.md`, `docs/foundation/DOMAIN_INVARIANTS.md` y la spec del dominio correspondiente.
- `semseproject` y `semse-spec-kit-flow` gobiernan permisos, aprobaciones, trazabilidad y secuencia SDD. Esta skill no concede permisos de merge, gastos, pagos, secretos, escrituras en producción ni bypass de CI.
- Comprobar GitHub HEAD, branch, PRs concurrentes, specs, contratos, rutas reales y Railway antes de cambiar archivos. Elegir REUSE → EXTEND → ADAPT → CONSOLIDATE → NEW.
- Trabajar en rama y PR borrador; no modificar producción ni datos de terceros por implicación. Registrar incertidumbres como UNVERIFIED, no como éxito.
- Diferenciar: diseño ≠ código ≠ tests ≠ CI ≠ merge ≠ deploy ≠ activation ≠ piloto real.

## 1. Clasificación del entorno antes de escribir
1. Determinar el host, base de datos, tenant y organización del proceso; documentar su finalidad y `NODE_ENV`. Comprobar que NO es `SEMSEproject/production` ni una copia con credenciales de producción.
2. Solo escribir a DB efímera/local o entorno staging explícitamente reservado para testing. Credenciales falsas o sandbox, sin números de tarjetas, firmas reales ni PII auténtica.
3. Abort si la conexión apunta a producción, si la identidad de base no puede probarse, si existe un dato real sin un scope de borrado seguro, o si se pretende crear `OPS_ADMIN` universal sin política.
4. Generar identificadores claramente sintéticos y únicos: `TEST_<runId>_<entity>`; añadir provenance `synthetic` y `testRunId` en un campo de metadatos ya aprobado cuando exista, nunca alterar Prisma schema sin spec y migración.
5. No generar datos de prueba visibles para clientes reales ni introducir `seed` genérico en el runtime productivo.

## 2. Grafo base de fixtures
Crear un `TestRun` lógico reversible con identificador fijo y PR/SHA; semilla (seed) determinista configurable:
- Dos tenants distintos (T_A, T_B), dos organizaciones por tenant; cliente propietario, contratista, subcontratista, empleado, supervisor, administrador permitido y actor ajeno.
- Job de Marketplace, proyecto privado, orden de servicio, trabajador por horas y ciclo de mantenimiento; representar solo relaciones existentes en el esquema verificado.
- Estimación, propuesta, contrato ficticio, milestone, evidencia (sha256 ficticio verificable), revisión, aprobación, factura, gasto, recurso y evento de auditoría; pago solo en mock del adapter o proveedor sandbox.
- Negativos: org cruzada, IDOR, rol insuficiente, transición inválida, revisión rechazada, sesión revocada, evidencias ausentes, duplicación, concurrencia, red/worker indisponibles, restore con hash alterado.
- Montos/horarios inmutables por seed y fixtures nombradas (no randomness sin semilla). Fechas fijas o reloj inyectable para que las pruebas sean repetibles.
- Nunca adjudicar un modelo inventado como presente: consultar Zod, Prisma, máquina de estados y API surface antes de construir una factory.

## 3. Procedimiento de ejecución
1. Seleccionar un flujo F01–F36, identificar ruta UI→API→FSM→DB→worker y preparar referencias de recursos consistentes.
2. Crear las factories mínimas por dependencia, usando transacciones locales cuando sea posible. Propagar `tenantId`, `orgId`, `actorId`, `resourceId`, `testRunId` y `correlationId`.
3. Validar cada precondición y el aislamiento de lectura y escritura con cuentas realmente diferenciadas.
4. Registrar snapshot/resultados de setup, ejecutar los casos en aislamiento y realizar teardown limitado al `testRunId` únicamente tras verificar el scope. No borrar tablas ni datos preexistentes en forma indiscriminada.
5. Comprobar idempotencia de setup/cleanup, ausencia de orphan records y ausencia de efectos económicos externos.
6. Si faltan tablas, crear una propuesta SDD; las tablas ficticias no sustituyen entidades reales y no deben promocionarse sin migración gobernada.

## 4. Pruebas mínimas obligatorias
- Seed repetido produce entidades equivalentes sin duplicados; teardown repetido no destruye datos ajenos.
- Actor propietario obtiene resultado contratado; un tenant u org distinto recibe 403/404 según política; credenciales revocadas no acceden.
- Diferenciar `200` de persistencia real y posterior lectura autenticada; auditar eventos y compensaciones.
- Dos ejecuciones paralelas no comparten IDs ni alteran el estado de la otra.
- Una evidencia/hash/manifiesto alterado provoca rechazo y deja prueba trazable.
- Pay/escrow e identidad/firma reales no se invocan; pruebas de la política financiera usan estado falso y adaptadores sandbox.

## 5. Entregables y gate
Documentar para cada fixture: `testRunId | scope | esquema versionado | seed | precondiciones | código | test | teardown | evidencia | estado`.
Cierre de esta skill: `SIMULADO_VALIDADO` solo con resultado reproducible de tests y limpieza verificada. Registrar `PENDIENTE_PILOTO_REAL` cuando corresponda. Enlace cruzado con `semse-business-flow-e2e`.
