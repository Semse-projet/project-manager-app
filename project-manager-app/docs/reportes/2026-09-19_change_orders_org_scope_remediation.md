# Remediación de aislamiento de órdenes de cambio - 2026-09-19

## Objetivo

Continuar la remediación del ecosistema, reparando el aislamiento por organización
pendiente en Change Orders. Base `origin/main@5f5b9c09`; rama
`fix/remediation-change-order-org-scope-20260919`.

Autoridad: spec `api-change-orders`, DOMAIN_INVARIANTS (tenant no autoriza por sí
solo) e instrucción del usuario de continuar la remediación. Alcance local.

## Hallazgos y cambios

- El listado exponía candidatos de otras organizaciones del mismo tenant.
- La comprobación individual anterior cubría solo jobId; omitía BuildOps e hitos.
- La creación aceptaba referencias sin verificar pertenencia ni tenant.
- Ahora cada referencia se verifica contra su recurso padre: cliente o profesional
  asignado para Job/Project/Milestone; orgId para BuildOpsProject.
- Una referencia propia no autoriza otra ajena en el mismo candidato. Los huérfanos
  se ocultan a no administradores. OPS_ADMIN conserva acceso dentro de su tenant;
  incluso sus altas validan que las referencias están dentro de ese tenant.
- La consulta aplica autorización antes del límite. La búsqueda individual común
  protege submit/approve/reject/request-changes/apply/impact/risk.
- Denegación individual uniforme con 404, sin escribir ni emitir eventos.
- Spec migrado a metadata SDD 2.0 e índice regenerado. No se presenta el VERIFIED
  legacy como prueba de una entrega nueva. Plan, tareas y checklist adjuntos.

## Evidencia local

- RED, servicio real compilado antes del cambio: 33 tests, 10 PASS / 23 FAIL.
  Fallos de autorización/filtros/contrato de error; sin fallos de importación.
- GREEN: 33 tests de aislamiento nuevos + 26 tests existentes de lifecycle/Bloque Z:
  **59/59 PASS**. `node --experimental-strip-types --test
  apps/api/test/change-orders-org-scope.test.ts
  apps/api/test/change-order-lifecycle.test.ts apps/api/test/bloque-z-change-orders.test.ts`.
- Riesgo: `node --experimental-strip-types --test
  tests/unit/change-order-risk-agent.test.ts`: **9/9 PASS**.
- Build inicial mostró 25 errores por Prisma/schemas generados desactualizados.
  `corepack pnpm build:api` regeneró paquetes y Prisma y pasó; build API posterior
  sobre la corrección también pasó. No cambió schema ni ninguna migración.
- ESLint del servicio: PASS, sin diagnósticos.
- `node scripts/spec-validate.mjs --strict`: **128 specs, 0 errores, 0 warnings**.
- `git diff --check`: PASS.
- Regresión completa con cobertura, tras build: `node apps/api/scripts/run-tests.mjs
  --coverage`: **2326 tests: 2296 PASS, 29 FAIL, 1 SKIP**, exit 1. Los 29 fallos
  son PrismaClientInitializationError: conexión no disponible a 127.0.0.1:5433;
  cero AssertionError. Archivos: contributor-program-extraction, contributor-program-registry,
  contributor-program.service y originator.service. Estas pruebas cargan la
  configuración local de DB; no se modificó ni se intentó usar producción.
- El resumen c8 supera los umbrales numéricos (líneas/statements 76.59%, ramas
  82.25%, funciones 68.13%), pero el comando **no pasa** por las 29 pruebas fallidas.
  Además c8 solo reporta los archivos fuente instrumentados; no se interpreta ese
  porcentaje como cobertura completa del servicio compilado.
- Recibos locales completos: `C:/Users/SEMSEproject/backups/remediation-change-orders-20260919/`.
  Cada log tiene hash SHA-256 en `SHA256SUMS.txt`.

Los tests nuevos invocan el servicio compilado, con un doble de persistencia que
interpreta predicados Prisma; no son una integración con PostgreSQL. No acreditan
concurrencia con cambios de ownership ni comportamiento en producción.

## Investigación externa

1. Consulta: OWASP API1 2023 Broken Object Level Authorization every endpoint.
   [OWASP API1](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/).
2. Consulta: Prisma filtering sorting relation queries where AND OR.
   [Prisma Client v6](https://docs.prisma.io/docs/orm/v6/reference/prisma-client-reference).
3. Consulta: OWASP authorization deny by default validate permissions every request.
   [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

Aplicado: verificación por recurso, denegación por defecto y composición AND para
referencias múltiples. Backlog: relaciones persistentes/EXISTS para organizaciones
con grandes conjuntos de IDs. Descartado para este slice: migrar tablas o cambiar
la política económica para corregir un defecto de autorización.

## Impacto y rollback

Clientes/profesionales pierden acceso a órdenes de otras organizaciones o con
referencias huérfanas/ajenas. Los propietarios conservan acceso a sus recursos.
No se modificaron importes, reglas de escrow, transiciones ni nombres de eventos.
No se tocaron producción, Railway, CI/CD ni variables de entorno.

Rollback: revertir el commit del slice; no requiere migración. Reabre la brecha.
El listado resuelve tres conjuntos de IDs autorizados (sin N+1 por candidato);
organizaciones con conjuntos muy grandes requieren evaluación de rendimiento.

## Pendientes

- Levantar una base de pruebas aislada y repetir las 29 pruebas dependientes de DB;
  el gate global sigue fallando. CI y revisión pendientes.
- Clasificar esas cuatro suites como integración (sufijo `-integration.test.ts`),
  según TDD_GOVERNANCE, para no mezclar conexiones DB con tests unitarios.
- Merge, despliegue y canary autenticado con dos organizaciones y dos tenants.
- Auditar entrega SSE por organización: el canal BuildOps sigue siendo por tenant;
  esta corrección no declara cerrado ese canal.
- El guard de escrow para candidatos sin jobId conserva su limitación previa;
  resolverla pertenece a la reconciliación económica, fuera de este slice.
