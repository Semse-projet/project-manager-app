# F2 — Prometeo Tool Registry gobernado

**Fecha:** 2026-07-20
**PRs:** #369 (F2-A/B), #371 (F2-C), #372 (F2-D) — las tres mergeadas a `main`
**Base:** `origin/main@ce37b2c` (spec/plan/tasks aprobados, #368) →
`origin/main@14ab34e` (F2-D mergeado)
**Scope:** T-001–T-026 (Fase 0–2), T-030–T-035 (Fase 3), T-040–T-044 (Fase 4)
de `docs/specs/prometeo/tool-registry-governance.tasks.md`. Fase 5
(T-050–T-056, validación/documentación) es este mismo reporte; T-072-equivalente
(deploy/canary) no aplica — no hay switches de producción en este spec.

## Resultado

El Prometeo Tool Registry pasó de ser un catálogo declarativo sin
enforcement real a tener gobernanza completa de extremo a extremo:

- **Permisos por tool en el 100% de las invocaciones.** Antes de F2 solo se
  verificaba el permiso genérico `agents:run:create` en el controller; un
  actor `CLIENT` podía invocar `time_tracker.get_status` sin tener
  `field-ops:read`. `evaluatePrometeoToolPolicy` ahora se evalúa dentro de
  `invokeReadTool`/`invokeWriteTool` contra `descriptor.permissions`, con
  denegación 403 explícita (`missingPermissions`), no un 200 silencioso.
- **Auditoría real de cada invocación.** `PrometeoToolInvocationAudit`
  persiste tenant/actor/namespace/name/mode/status/blockedReason/requestId
  para las tres ramas de ejecución (bloqueada por policy, bloqueada por
  adapter no cableado, exitosa) — antes no existía este registro.
- **Escritura gobernada por aprobación.** `PrometeoProposedAction` +
  `POST /v1/prometeo/tools/invocations/:id/approve|reject`: ninguna de las 7
  write tools ejecuta su efecto directo al invocarse — `time_tracker.*` y
  `agro.create_task` (`approvalPolicy: "confirm"`) esperan confirmación
  (el propio actor puede auto-aprobar su propia propuesta, o un `OPS_ADMIN`
  puede hacerlo por él); `payments.propose_release`
  (`approvalPolicy: "human_required"`) exige un `OPS_ADMIN` que no sea el
  proponente.
- **Transiciones de estado a prueba de carrera.** `transitionProposedAction`
  usa un `prisma.updateMany` condicionado por `status IN (...)` — dos
  aprobaciones concurrentes de la misma acción nunca ejecutan el efecto dos
  veces; la que pierde la carrera recibe 409, no una re-ejecución silenciosa.
- **Gate híbrido de pagos real.** `payments.propose_release` llama al mismo
  `PaymentsService.release()` que usa el endpoint REST
  (`POST /v1/milestones/:milestoneId/escrow/release`), sin duplicar ni
  debilitar sus invariantes (contrato firmado, milestone aprobado, sin
  disputa abierta, fondos suficientes). El dinero solo se mueve a través de
  `approveProposedAction`, nunca desde `invokeWriteTool` directamente.
- **Catálogo honesto.** `executable: !adapterPending` en
  `GET /v1/prometeo/tools` ahora refleja la realidad: 18/24 read tools y
  7/7 write tools tienen adapter real cableado; los 6 `vision.*` restantes
  (incluye `analyze_video`) siguen declarados pero no ejecutables.

## Decisiones de producto tomadas durante la implementación

Dos decisiones se marcaron explícitamente como "no asumir unilateralmente"
en `tool-registry-governance.tasks.md` y se resolvieron con el owner antes
de escribir código de Fase 4:

1. **Permiso de `payments.propose_release`:** el descriptor original
   declaraba `payments:write`, que no existe en ningún rol de
   `packages/auth/src/rbac.ts` (ni siquiera `OPS_ADMIN`) — hallazgo de F2-B
   que dejaba la tool inejecutable por cualquiera una vez el enforcement
   quedó activo. Se decidió reutilizar el permiso existente `finance:write`
   (lo tienen `CLIENT`/`PRO`/`OPS_ADMIN`) en vez de introducir un permiso
   dedicado.
2. **Política de aprobación del release:** `human_required` (un solo
   `OPS_ADMIN`, nunca el proponente) en vez de `dual_approval` — esta última
   habría requerido una máquina de estados de doble firma que
   `PrometeoProposedAction` no tiene hoy; se dejó como alcance futuro
   explícito, no implícito.

Ninguna de las 7 write tools pasó a `approvalPolicy: "none"` en ningún
incremento (T-031): el mecanismo de aprobación queda operativo para las 7,
incluso las de bajo riesgo, priorizando rastro auditable sobre fricción cero.

## Bugs encontrados y corregidos en el camino

- **`agro.create_task` inejecutable en la práctica.** Su `inputSchema` no
  declaraba `type` como requerido, pero `AgroTaskService.createTask` lo
  exige y rechaza con 400 cualquier valor fuera de `VALID_TYPES`. Sin este
  fix, la tool habría quedado "cableada" pero todo intento real habría
  fallado. Corregido en F2-C.
- **`approveProposedAction` sin manejo de excepciones del ejecutor.** No
  tenía `try/catch` alrededor de la ejecución del efecto — cualquier
  excepción (no solo en pagos: los invariantes de
  `PaymentsService.release()` como disputa abierta, contrato sin firmar,
  milestone no aprobado, fondos insuficientes, todos lanzan) dejaba la
  `PrometeoProposedAction` atascada en `APPROVED` para siempre, sin
  finalizar. Corregido de forma genérica en F2-D: la excepción real (con su
  status HTTP real) se propaga al caller en vez de enmascararse, y la
  acción se finaliza `BLOCKED` con el error persistido.

## Ciclo de trabajo

Cada fase siguió TDD estricto: tests que fallan por ausencia controlada
antes de escribir el código de producción (confirmado explícitamente en
T-015 para F2-A/B), luego implementación mínima para pasarlos en verde.

- F2-A/B (#369): 11 tests nuevos — `prometeo-tool-governance.policy.test.ts`,
  `prometeo-tool-governance.repository.test.ts`,
  `prometeo-tool-execution.service.test.ts` (extendido),
  `prometeo-tool-registry.test.ts` (extendido).
- F2-C (#371): 12 tests nuevos/actualizados —
  `prometeo-tool-write-execution.service.test.ts` (10 tests: deny 403,
  creación de proposed action, aprobar ejecuta y persiste `resultJson`,
  rechazar no ejecuta nada, RBAC self vs OPS_ADMIN, 404, 409 en acción
  terminal, concurrencia de doble aprobación) + 2 tests de registry
  actualizados.
- F2-D (#372): 6 tests nuevos — identidad del aprobador vs proponente,
  rechazo de pago nunca llama `release()`, invariante de pago roto falla
  limpio y finaliza `BLOCKED`, concurrencia de doble aprobación de pago
  llama `release()` exactamente una vez.

## Evidencia de este corte (Fase 5, 2026-07-20)

- `pnpm spec:validate:strict` → **91 specs escaneados, 0 errores, 0
  warnings** (T-050).
- `pnpm --filter @semse/api build && node --experimental-strip-types --test
  $(find test -name '*.test.ts' ! -name '*-integration.test.ts')` →
  **1940/1940 passing**, sin regresiones (T-051).
- `pnpm verify:workspace` (incluye `verify:modules`, `audit:prisma-usage`,
  `check:toolchain`, `check:dockerfiles`, `railway:preflight` y la suite
  completa de `@semse/api`) → **verde, exit 0** (T-052).
- `docs/architecture/SEMSE_API_SURFACE_V1.md` y
  `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md` actualizados con los
  endpoints y conteos reales post-implementación (T-053, T-054).
- `ROADMAP.md` sección F2 actualizada reflejando gobernanza completa /
  adapters `vision:run` pendientes (T-055).

## Pendiente (fuera de alcance de este spec, o explícitamente diferido)

- ~~**6 adapters `vision:run`**~~ — **resuelto el mismo día, ver Addendum al
  final de este reporte.** 5 de los 6 (`analyze_image`, `compare_before_after`,
  `detect_material`, `classify_space`, `check_safety`) ya llaman a
  `VisionService` real. Solo `analyze_video` sigue pendiente — necesita un
  pipeline temporal que no existe hoy.
- **"Verification y compensación" explícita** — el roadmap original (F2)
  la mencionaba como entregable, pero no se tradujo a una tarea concreta en
  `tool-registry-governance.tasks.md`. Hoy el estado terminal
  (`BLOCKED`/`EXECUTED`) + el audit trail cubren la necesidad práctica; si
  se requiere un paso de verificación/compensación separado (p. ej. reversar
  un efecto parcialmente aplicado), es un incremento futuro a especificar.
- **`dual_approval`** — el enum existe en el schema y `assertCanDecide` lo
  trata igual que `human_required` (solo `OPS_ADMIN`, nunca el proponente),
  pero ninguna tool lo usa hoy y no hay máquina de estados de doble firma
  distinta de un solo aprobador. Quedó documentado como decisión consciente
  en T-040, no como bug.
- El spec no se marcó `IMPLEMENTED`/`VERIFIED` en su frontmatter en este
  corte — se deja para una revisión final que confirme que el criterio de
  cierre completo (incluyendo `vision.analyze_video`, el único adapter que
  sigue pendiente tras el addendum) está satisfecho o formalmente re-scoped.

## Addendum 2026-07-20 (mismo día) — adapters `vision:run`

Cerrado el mismo día como incremento separado (fuera del scope de tareas de
`tool-registry-governance.tasks.md`, que es gobernanza — esto es cobertura de
adapters, explícitamente diferido en la sección "Pendiente" original de este
reporte).

`executeReadTool` en `PrometeoToolExecutionService` ahora cablea 5 de los 6
tools `vision:run` a los métodos reales de `VisionService` — los mismos que
usa `VisionController`, sin duplicar ni modificar lógica:

- `vision.analyze_image` -> `VisionService.runAnalysis()`;
- `vision.compare_before_after` -> `VisionService.matchReference()`;
- `vision.detect_material` -> `VisionService.detectMaterial()`;
- `vision.classify_space` -> `VisionService.classifySpace()`;
- `vision.check_safety` -> `VisionService.checkSafetyEnriched()`.

`vision.analyze_video` sigue `adapter_pending` — no hay pipeline temporal de
video, tratado como capacidad separada (fila "Video tool" en
`IMPLEMENTATION_STATUS_MATRIX.md`), no como deuda de gobernanza.

**Bug encontrado:** el descriptor de `vision.analyze_image` no declaraba
`evidenceId` como requerido, pese a que `VisionService.runAnalysis()` lo usa
para indexar el `VisionAnalysisRecord` persistido — el mismo patrón de bug
que `agro.create_task` en F2-C (campo real requerido por el service, ausente
del `inputSchema` del descriptor). Corregido: `evidenceId` ahora es
requerido en el descriptor.

**Evidencia:**
- `pnpm spec:validate:strict` → 91 specs, 0 errores, 0 warnings.
- Suite completa `@semse/api` → 1947/1947, sin regresiones.
- 7 tests nuevos en `apps/api/test/prometeo-tool-vision-execution.service.test.ts`
  (uno por tool wireada + `evidenceId` requerido + confirmación de que
  `analyze_video` sigue bloqueado) + 2 tests de registry actualizados.
- Conteo real: 23/24 read tools cableados (antes 18/24), 30/31 tools totales
  ejecutables (antes 25/31) — solo `vision.analyze_video` queda `adapter_pending`.
