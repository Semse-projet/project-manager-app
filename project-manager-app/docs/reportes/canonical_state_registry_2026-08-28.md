# Registro Canónico de Estado del Sistema — creación de la infraestructura

**Fecha:** 2026-08-28
**Alcance:** `docs/CANONICAL_STATE_REGISTRY.md` (nuevo) + spec/plan/tasks en
`docs/specs/platform/canonical-state-registry.*` + referencia cruzada en
`docs/SOURCE_OF_TRUTH.md` + `tests/unit/canonical-state-registry.test.ts`.
**Método:** formalización directa de una propuesta de gobernanza entregada
por el usuario del proyecto (diagnóstico forense sobre coordinación
multiagente y divergencia entre rastros documentales), aterrizada al flujo
SDD del repo (spec → plan → tasks → implementación) y verificada contra
código y specs existentes en este mismo commit.
**Naturaleza:** entrega de infraestructura de gobernanza documental. No toca
`apps/api`, `apps/web`, `apps/worker` ni `packages/db/prisma/`.

---

## 1. Qué se construyó

El diagnóstico de origen identifica un problema real y ya visible en este
repositorio: SEMSEproject tiene gobernanza sobre las *acciones* de los
agentes (constitución, RBAC, audit log, flujo SDD) pero no una gobernanza
equivalente sobre la *verdad* que esos agentes consumen antes de actuar.
`docs/reportes/forge_agent_harness_auditoria_2026-08-10.md` es evidencia
directa de exactamente ese patrón dentro de este mismo repo: 12 specs de
Forge en `APPROVED`, con código real y tests reales, pero operando en
`dry-run` — un lector que sólo mirara `SPEC_INDEX.md` habría podido asumir
un harness gobernado y ejecutándose en vivo.

Se creó `docs/CANONICAL_STATE_REGISTRY.md`, que define:

- Una **jerarquía de verdad de 9 niveles** (comportamiento verificado en
  producción → tests reproducibles → código de `main` → este registro →
  specs vigentes → decisiones aceptadas → reportes históricos → handoffs y
  checkpoints → inferencias de nombres de rama/worktree), con la regla
  explícita de que un nivel bajo (7-9) nunca puede por sí solo declarar una
  capacidad terminada si contradice un nivel alto (1-3).
- Un **esquema de 11 campos** por capacidad (Capacidad, Propietario, Estado
  real, Evidencia, Entorno, Commit verificado, Limitaciones, Riesgos, Última
  verificación, Documentos obsoletos, Próxima decisión), tal como fue
  propuesto por el usuario.
- Un vocabulario de **Estado real** (`no_iniciada` / `simulada` / `parcial` /
  `operativa` / `verificada`) deliberadamente distinto del `status` de
  `SPEC_INDEX.md`, para que un spec `IMPLEMENTED`/`VERIFIED` no se confunda
  con una capacidad `verificada` por comportamiento real.
- Reglas de mantenimiento: no fabricar evidencia, citar fuente exacta,
  caducidad a 60 días, actualización disparada por evento (no por
  calendario).

## 2. Qué se sembró — y qué deliberadamente no

Fase 1 (esta entrega) siembra **3 filas**, cada una con evidencia verificada
en este mismo commit:

1. El propio registro (`operativa`, evidencia: el documento + el test que lo
   valida, ambos verdes en `pnpm test:unit`).
2. `field-ops/time-tracker` legacy (`parcial`, evidencia: el código todavía
   existe en `apps/api/src/modules/field-ops/`, con la limitación explícita
   de que no se re-auditó en esta sesión cuáles de sus endpoints siguen
   recibiendo tráfico real más allá de lo que ya documenta el `CLAUDE.md`
   canónico).
3. `operations.project-lifecycle-projection` (heredado del spec `VERIFIED` +
   `CANARY`, marcado explícitamente como "no re-verificado de forma
   independiente en esta sesión" — la fila no se apropia de una verificación
   que no se hizo).

**No se pobló el resto del sistema.** Rellenar las nueve dominios completos
con filas habría requerido auditar cada uno como se hizo con Forge el
2026-08-10 — trabajo real de varias sesiones, no una tarea de esta entrega.
Hacerlo de otra forma (copiar el `status` de `SPEC_INDEX.md` a `Estado real`
sin verificar) habría recreado exactamente el problema que este registro
existe para prevenir: estado imaginado por transcripción, no por evidencia.
Esa auditoría queda como Fase 2, listada explícitamente en
`docs/specs/platform/canonical-state-registry.tasks.md` como backlog no
ejecutado — dominio por dominio, con Payments/Trust marcado como el primero
en requerir doble verificación por el Artículo IV de la constitución.

## 2.1 — Avance de Fase 2 (mismo PR): `field-ops` vs. Labor Engine (T-028)

Antes de cerrar esta entrega se ejecutó un primer avance real de Fase 2 sobre
la fila de `field-ops`/tracker, siguiendo la propia regla del registro de no
copiar afirmaciones sin verificarlas. Lectura directa de código (no de
documentación) en `apps/api/src/app.module.ts`,
`apps/api/src/modules/field-ops/{field-ops,time-tracker}.controller.ts`,
`field-ops.repository.ts`, `apps/api/src/modules/labor-engine/labor-engine.repository.ts`,
y las páginas web `apps/web/app/(app)/worker/tracker/page.tsx` y
`apps/web/app/(app)/worker/field-ops/page.tsx` separó lo que
`project-manager-app/CLAUDE.md` resumía como un solo hecho ("field-ops/time-tracker
remains only as legacy API — jobs list still consumed") en tres capacidades
con evidencia propia:

1. **Labor Engine — time tracking** (`/worker/tracker`, `v1/labor`):
   operativa, es el único camino de escritura que la UI activa usa hoy para
   iniciar/pausar/reanudar/detener turnos.
2. **Field Ops legacy — endpoints de escritura de tracker**
   (`v1/time-tracker/sessions/*`): siguen registrados y activos, sin tráfico
   de UI conocido, pero — hallazgo nuevo, no documentado en ningún lugar
   previo — escriben en la **misma tabla Prisma `timeEntry`** que usa el
   Labor Engine, aplicando reglas de negocio distintas (sin las reglas de
   turno nocturno, idempotencia o proximity check-in del Labor Engine). Es
   un riesgo de datos real y activo, no hipotético: cualquier cliente que
   siga llamando a estos 6 endpoints crearía filas divergentes en el ledger
   que el Labor Engine trata como fuente de verdad.
3. **Field Ops — units/worklogs/facts/vendors/compliance**
   (`/worker/field-ops`): operativa y en producción, pero es una capacidad
   distinta del tracker — no está en el alcance del Labor Engine ni está
   siendo reemplazada. La nota de `CLAUDE.md` sobre `field-ops/` "being
   replaced" describe el sub-feature de tracker, no ésta; leída sin matizar
   podría sugerir que toda la superficie de field-ops está en camino de
   desaparecer.

El propio test estructural (`tests/unit/canonical-state-registry.test.ts`)
detectó y bloqueó una ruta de evidencia mal citada en esta actualización
(`apps/web/app/labor-api.ts`, que no existe; el archivo real es
`apps/web/app/(app)/labor-api.ts`) antes de que llegara a `main` — exactamente
el mecanismo para el que existe.

## 3. Verificación de esta entrega

- `node --test tests/unit/canonical-state-registry.test.ts` → 5/5 verde
  (estructura del esquema, jerarquía de 9 niveles, valores válidos de
  `Estado real`, existencia real de cada ruta de evidencia citada en filas
  `operativa`/`verificada`, y que ninguna fila sembrada se auto-declare
  `verificada` sin matizar el origen de esa afirmación).
- `pnpm spec:validate --strict` → 0 errores/0 warnings sobre 117 specs
  (116 preexistentes + este).
- `pnpm spec:index` → `docs/SPEC_INDEX.md` regenerado, incluye
  `platform.canonical-state-registry`.
- `pnpm test:unit` (suite completa, tras `pnpm install --frozen-lockfile`
  en este entorno): 900 pass / 11 fail / 5 skip sobre 916 tests. Las 11
  fallas (`agro-*.service.test.ts`, `autonomy.service.test.ts`,
  `browser-agent.service.test.ts`, `contracts.service.test.ts`,
  `ecosystem-5d.service.test.ts`, `vision.service.expanded.test.ts`) son
  preexistentes: `git status` confirma que esta entrega sólo tocó
  `docs/SOURCE_OF_TRUTH.md`, `docs/SPEC_INDEX.md` y archivos nuevos bajo
  `docs/` y `tests/unit/canonical-state-registry.test.ts`; ninguno de los
  archivos de código que fallan fue modificado. No se investigó la causa
  raíz de esas 11 fallas por estar fuera del alcance de este spec.

## 4. Qué queda pendiente (decisión humana o de próxima sesión)

- Ejecutar la auditoría Fase 2 dominio por dominio y sembrar filas reales.
- Decidir si este registro se automatiza vía `pnpm spec:index` o se mantiene
  de mantenimiento manual con revisión de PR (queda como decisión abierta,
  no resuelta aquí).
- Decidir si `pnpm verify:workspace` debe incluir la validación estructural
  de este registro como gate.
- Investigar, fuera de esta entrega, la causa raíz de las 11 fallas
  preexistentes detectadas en `pnpm test:unit` durante esta sesión.
