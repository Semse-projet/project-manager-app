# SDD_GOVERNANCE — SEMSEproject

**Versión:** 2.0
**Fecha:** 2026-07-28
**Estado:** APROBADO
**Referencia:** GitHub Spec Kit + gates operativos SEMSE

> El spec gobierna intención y criterios; el código, CI, merge, deploy y
> activación demuestran etapas diferentes de entrega.

## 1. Flujo obligatorio

```text
constitution
  -> specify
  -> clarify
  -> plan
  -> tasks
  -> analyze
  -> checklist
  -> implement
  -> validate
  -> PR/CI
  -> merge
  -> deploy
  -> activate/canary
  -> verify/report
```

Para programas grandes se usa una spec de programa que descompone slices
independientes. Cada slice recorre el flujo completo y debe caber en un cambio
reversible. F0-F9 no se implementa como un único PR.

## 2. Fuentes canónicas

1. `.specify/memory/constitution.md`
2. `docs/SPEC_INDEX.md`, generado desde metadata
3. `docs/SOURCE_OF_TRUTH.md`
4. `docs/foundation/DOMAIN_INVARIANTS.md`
5. `docs/foundation/STATE_MACHINES.md`
6. `docs/foundation/EVENT_CATALOG.md`
7. `docs/architecture/SEMSE_API_SURFACE_V1.md`
8. Spec, plan, tasks y checklist del slice

Un reporte histórico informa; no autoriza implementación si contradice estas
fuentes o el estado actual de producción.

## 3. Artefactos y plantillas

La fuente de plantillas es `.specify/templates/overrides/`:

- `semse-spec.md`
- `semse-plan.md`
- `semse-tasks.md`
- `semse-checklist.md`

`docs/specs/templates/semse-spec-template.md` es una copia controlada del
template de spec y el validador debe fallar si diverge.

Los comandos de Spec Kit pueden presentarse como slash commands, skills o no
estar instalados en una superficie concreta. El nombre del comando no cambia
el proceso: si no existe, se crean los mismos artefactos manualmente desde las
plantillas y se ejecutan los scripts `pnpm spec:*`.

## 4. Estados del spec

| Estado | Significado | Autoriza código |
|---|---|---|
| `DRAFT` | Requisitos incompletos | No |
| `REVIEW` | Listo para revisión/clarificación | No |
| `APPROVED` | Contrato autorizado para implementar | Sí |
| `IMPLEMENTED` | Código completo y tests locales; puede no estar fusionado o activo | Ya implementado |
| `VERIFIED` | CI, merge, deploy y activación verificados en producción | Ya cerrado |
| `DEPRECATED` | Sólo referencia histórica | No |

`PARTIAL`, `MISSING`, `REVIEW_REQUIRED` y `ACTIVE` son vocabulario legacy. Se
aceptan sólo durante migración de documentos antiguos y no se usan en specs
nuevas.

## 5. Metadata de entrega SDD 2.0

Toda spec nueva o modificada sustancialmente declara `sdd_version: "2.0"` y:

```yaml
code_status: NOT_STARTED | IN_PROGRESS | COMPLETE
ci_status: NOT_RUN | PASS | FAIL
merge_status: UNMERGED | MERGED
deploy_status: NOT_DEPLOYED | DEPLOYING | DEPLOYED | FAILED | ROLLED_BACK
activation_status: INACTIVE | CANARY | ACTIVE | PAUSED | ROLLED_BACK
migration_status: NOT_APPLICABLE | PENDING | APPLIED | VERIFIED | ROLLED_BACK
feature_flags: []
production_evidence: []
last_verified: "YYYY-MM-DD"
```

Invariantes:

- `IMPLEMENTED` requiere `code_status: COMPLETE` y tests relacionados.
- `DEPLOYED` requiere CI `PASS` y merge `MERGED`.
- `CANARY` o `ACTIVE` requiere deploy `DEPLOYED`.
- `VERIFIED` requiere código completo, CI verde, merge, deploy, activación
  `ACTIVE`, `last_verified` y evidencia de producción.
- Una migración aplicada manualmente sigue siendo deuda hasta que su archivo,
  schema y checksum estén reconciliados en Git.

Las specs SDD 1.x existentes se migran cuando se tocan. No se inventa evidencia
retroactiva para completar metadata.

## 6. Reglas antes de implementar

- El spec existe en `docs/specs/**` y está `APPROVED`.
- El problema, scope, no-objetivos y escenarios P1 son verificables.
- Permisos backend, tenant, org, ownership y policy están definidos.
- FSM e invariantes están reconciliados.
- API/UI/agent contracts y estados de error están definidos.
- Datos, migración, compatibilidad y rollback están definidos.
- Eventos/outbox/idempotencia/replay están definidos si aplica.
- Los tests requeridos se escriben antes del código de negocio.

Si una respuesta es desconocida y cambia materialmente el resultado, se
clarifica antes de implementar. Si puede verificarse en código o producción,
se inspecciona en vez de adivinar.

## 7. Gates por riesgo

### Seguridad

- Cero lecturas cross-tenant.
- Cross-org sólo mediante ownership/policy explícita.
- Operaciones críticas con permiso backend y, cuando aplique, step-up o
  aprobación humana.
- No se exponen secretos, PII ni payloads sensibles en logs o evidencia.

### Eventos

- Cambio de estado + outbox en la misma transacción.
- Consumidores idempotentes.
- Replay sin efecto duplicado.
- DLQ operable y correlation end-to-end.

### Evidence

- Storage real, checksum, subject y ownership.
- Custodia/retención auditables.
- Un resultado de IA es señal; no aprobación humana automática.

### Economía

- Payment provider y ledger son responsabilidades separadas.
- Fallos/reversals no cuentan como dinero liberado o gastado.
- Reversals inmutables y moneda explícita.
- Débitos y créditos balanceados cuando aplique ledger.

### Offline

- Duplicados producen un solo efecto.
- Reintento seguro.
- Conflicto visible y resoluble.

## 8. Migraciones de producción

- Git conserva el historial completo `packages/db/prisma/migrations`.
- Nunca se edita ni elimina una migración aplicada.
- Producción usa `prisma migrate deploy`, preferiblemente en pre-deploy/CI.
- `prisma migrate reset` y `db push` no se usan en producción.
- Hotfix o drift se audita con `migrate status`, metadata de PostgreSQL y
  documentación oficial; se restaura el SQL exacto o se crea un forward-fix.
- El checksum registrado y el archivo versionado deben coincidir.
- Toda migración define compatibilidad con la versión anterior del servicio.

## 9. Entrega y producción

Orden mínimo:

1. tests dirigidos;
2. regresión proporcional al riesgo;
3. build/typecheck/lint;
4. `pnpm spec:validate:strict`;
5. PR y CI terminal;
6. merge SHA;
7. migración/pre-deploy;
8. deployment terminal de cada servicio afectado;
9. health/readiness;
10. canary o smoke autenticado;
11. métricas/SLO;
12. activación o rollback;
13. actualización de evidencia y estado.

Railway `SUCCESS`/health 200 demuestra que el contenedor arrancó; no demuestra
que el journey autenticado funcione. La activación se valida por separado.

## 10. Investigación externa

Al cerrar cada módulo, PR, migración o bloque SDD:

1. ejecutar al menos tres búsquedas independientes;
2. usar fuentes primarias para decisiones técnicas;
3. registrar links e ideas;
4. decidir aplicado ahora/backlog/descartado;
5. no ampliar scope sin actualizar spec y plan.

Formato mínimo:

```markdown
## Investigación externa

1. [consulta] — [fuente primaria]
2. [consulta] — [fuente primaria]
3. [consulta] — [fuente primaria]

- Aplicado ahora:
- Backlog:
- Descartado:
```

## 11. Automatización

```text
pnpm spec:validate
pnpm spec:validate:strict
pnpm spec:index
pnpm spec:coverage
```

`spec:index` genera la única matriz de specs vigente. Los scripts deben:

- detectar IDs duplicados;
- validar rutas, tests, endpoints y eventos;
- validar invariantes de entrega SDD 2.0;
- mantener un tiempo de ejecución apto para CI;
- fallar si las plantillas canónicas divergen.

## 12. Criterio de cierre

Una feature está cerrada sólo cuando:

- cumple su spec y tests;
- CI está verde;
- el SHA está fusionado;
- la migración está reconciliada;
- el deploy terminó correctamente;
- la activación está verificada;
- existe evidencia operativa sin secretos;
- índice, matriz, roadmap/API/event catalog están alineados;
- rollback o forward-fix es ejecutable.
