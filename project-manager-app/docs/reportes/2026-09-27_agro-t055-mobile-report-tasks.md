# 2026-09-27 — Agro T-055: pantallas en apps/mobile (reporte + mis tareas)

Spec: `docs/specs/agro/agro-mobile-report.spec.md`. Continúa T-050 … T-054.

## Qué había

Hasta T-054, el reporte de incidencias Agro (intake Prometeo, propone-nunca-escribe)
solo existía como web responsive. `apps/mobile` no tenía ningún código Agro —
greenfield completo.

## Decisiones de alcance (aprobadas antes de escribir código)

- **Alcance de pantallas**: "Reporte + mis tareas" — fincas → reportar
  incidencia (Prometeo intake) → adjuntar evidencia (foto) → ver incidencias,
  más una pantalla "mis tareas" sobre el endpoint entre dominios
  `GET /v1/tasks` (T-058b). Fuera de este corte: workforce, finanzas,
  dashboard.
- **Punto de entrada**: nueva pestaña "Agro" siempre visible en el tab
  navigator de WORKER (cubre también PRO, mismo mapeo que el resto de tabs),
  con estado vacío honesto si no hay membresías — en vez de ocultar la
  pestaña condicionalmente, que hubiera exigido una llamada extra al
  arrancar la app.

## Diagnóstico antes de tocar código

- Investigación completa de la arquitectura mobile existente (navegación,
  cliente API con refresh de sesión, patrones de pantalla/test, flujo de
  evidencia) antes de escribir ninguna pantalla.
- **Gap real encontrado**: el endpoint genérico
  `PATCH /v1/tasks/:taskId/status` exige `jobs:update`, permiso que el WORKER
  de Agro no tiene (solo `tasks:read:self`, T-058b). Resuelto usando los
  endpoints nativos de Agro (`POST /v1/agro/tasks/:taskId/{start,complete}`),
  recuperando el id nativo del `AgroFarmTask` desde el prefijo determinístico
  `agrotask_` del id espejo (T-051) — sin campo adicional en la API.
- **Segundo gap**: `AgroFarmAccessService.listMemberships()` solo devuelve
  fincas donde el usuario es miembro ACTIVE, no las que posee sin ser
  también miembro. Documentado como limitación aceptada de este corte (no
  silenciada) — encaja con el público objetivo (trabajadores reportando).
- **Tercer gap, descubierto a mitad de investigación**: `apps/mobile` no
  tiene `expo-av`/`expo-audio` — el "reporte por audio" que sí construyó
  T-054 en el API no se puede implementar en mobile sin agregar una
  dependencia nativa nueva (no trivial, dado que el proyecto ya usa
  `expo-dev-client`). Se documentó como gap explícito en vez de forzar una
  implementación a medias o abrir una tercera ronda de preguntas para lo que
  es, en el fondo, una consecuencia de ingeniería del alcance ya aprobado.
  La pantalla de reporte quedó texto-solamente para este corte.

## Qué cambió

- **`apps/mobile/src/api/agro.ts`** (nuevo): `fetchAgroMemberships`,
  `fetchAgroIncidents`, `proposeAgroIntake`, `createAgroIncident` — shapes
  verificados contra los controllers/servicios reales de `apps/api`, no
  asumidos (un error de shape propio se detectó y corrigió en revisión antes
  de cualquier test).
- **`apps/mobile/src/api/tasks.ts`** (nuevo): `fetchMyTasks` (`GET /v1/tasks`),
  `isAgroTask`/`toAgroFarmTaskId` (detección por prefijo `agrotask_`),
  `startAgroTask`/`completeAgroTask`/`completeAgroTaskFromAnyStatus` (llama
  `start` primero si la tarea está `PENDING`, porque el FSM de
  `AgroFarmTask` no permite `PENDING → COMPLETED` directo).
- **4 pantallas nuevas** (`apps/mobile/src/screens/worker/`):
  `AgroFarmsScreen` (home, lista fincas + acceso a "mis tareas"),
  `AgroIncidentsScreen` (por finca), `AgroReportIncidentScreen` (propone →
  revisión humana obligatoria → confirma; adjunta fotos vía
  presign→PUT genérico + `evidence` inline al crear la incidencia),
  `AgroTasksScreen` (filtra `GET /v1/tasks` por origen Agro, completa vía
  endpoints nativos).
- **`AgroStackNavigator.tsx`** (nuevo) + wiring en `WorkerTabNavigator.tsx`
  (nueva pestaña "Agro") y `navigation/types.ts` (`AgroStackParamList`,
  extensión de `WorkerTabParamList`).
- **4 suites de test nuevas**, mismo patrón que el resto de pantallas
  (`@testing-library/react-native`, mocks de `useFocusEffect` y de los
  módulos API): estado vacío honesto, listado, navegación, y — en el
  reporte — que la incidencia solo se crea tras confirmación humana explícita
  (nunca automáticamente desde la propuesta).

## Qué no se tocó

- Ningún endpoint ni servicio de `apps/api` — T-055 es 100% cliente, reusa
  contratos ya existentes sin cambios.
- `EvidenceCapture` (componente compartido): no se generalizó para aceptar
  `farmId` — el registro final de evidencia de Agro es distinto (inline en
  el incidente, no `POST /v1/evidence`), así que la subida se implementó
  directamente en la pantalla de reporte en vez de forzar un cuarto caso en
  ese componente.
- `visionSignals`/reconocimiento de objetos (T-054): no llega a esta v1
  porque requeriría pre-registrar evidencia como `AgroEvidenceItem` antes de
  `intake/propose`, fuera de alcance de este corte — documentado en el spec.

## Verificación

- `apps/mobile`: 50/50 suites de test, 232/232 tests (4 suites nuevas).
- `pnpm typecheck` (workspace completo, incluye `tsc --noEmit` de mobile) —
  limpio.
- `pnpm lint` — 0 errores, mismos 36 warnings preexistentes (React hooks
  deps / `<img>` en web, nada de mobile).
- `pnpm spec:validate:strict` — 0 errores/warnings, 143 specs.
- Sin cambios en `apps/api`, así que no aplica re-correr sus suites de
  integración.

## Backlog restante

No queda ningún ítem abierto en `docs/specs/agro/agro-consolidation.tasks.md`
tras este corte. Pendientes documentados (no bloqueantes para este merge):

| Ítem | Dónde |
|---|---|
| Reporte por audio en mobile (depende de decisión sobre `expo-av`/`expo-audio`) | `agro-mobile-report.spec.md` §3 |
| Owner-no-miembro no ve su finca desde mobile | `agro-mobile-report.spec.md` §2 |
| `visionSignals` no llega a mobile (requeriría pre-registrar evidencia) | `agro-mobile-report.spec.md` §2 |
| R8 — controllers Agro no capturan `ZodError` (500 en vez de 400) | documentado en T-053 |
| Activación real en producción de `SEMSE_ASR_PROVIDER`/`VISION_OBJECT_PROVIDER` + DPIA | `agro-prometeo-intake.spec.md` |
