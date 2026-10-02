---
id: "agro.mobile-report"
title: "Agro — pantallas en apps/mobile: reporte + mis tareas (T-055)"
domain: "agro"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "low"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/mobile/src/api/agro.ts
  - apps/mobile/src/api/tasks.ts
  - apps/mobile/src/screens/worker/AgroFarmsScreen.tsx
  - apps/mobile/src/screens/worker/AgroIncidentsScreen.tsx
  - apps/mobile/src/screens/worker/AgroReportIncidentScreen.tsx
  - apps/mobile/src/screens/worker/AgroTasksScreen.tsx
  - apps/mobile/src/navigation/AgroStackNavigator.tsx
  - apps/mobile/src/navigation/WorkerTabNavigator.tsx
  - apps/mobile/src/navigation/types.ts
related_tests:
  - apps/mobile/src/screens/worker/AgroFarmsScreen.test.tsx
  - apps/mobile/src/screens/worker/AgroIncidentsScreen.test.tsx
  - apps/mobile/src/screens/worker/AgroReportIncidentScreen.test.tsx
  - apps/mobile/src/screens/worker/AgroTasksScreen.test.tsx
related_endpoints:
  - v1/agro/memberships
  - v1/agro/farms/:farmId/incidents
  - v1/agro/farms/:farmId/intake/propose
  - v1/tasks
  - v1/agro/tasks/:taskId/start
  - v1/agro/tasks/:taskId/complete
  - v1/evidence/presign
related_events: []
related_agents:
  - prometeo
last_verified: "2026-09-27"
---

# Spec: Agro en apps/mobile — reporte + mis tareas

> Aprobación: solicitud explícita del propietario de producto en la sesión del
> 2026-09-27. Alcance elegido entre las opciones presentadas: "Reporte + mis
> tareas" (no workforce/finanzas/dashboard móvil), y nueva pestaña "Agro"
> siempre visible en el tab WORKER (no condicionada a membresía existente).

## 1. Resultado

Hasta T-055, el reporte de campo Agro (`agro-prometeo-intake.spec.md`) solo
existía como web responsive (`apps/web/app/agro/[farmId]/incidents/report/page.tsx`).
Este spec cubre la primera pantalla nativa: una persona con rol WORKER o PRO
ve una pestaña "Agro" en la barra inferior, puede listar sus fincas, reportar
una incidencia (con la misma propuesta-nunca-escribe de Prometeo), adjuntar
fotos, ver las incidencias de la finca, y ver/completar sus tareas Agro desde
"mis tareas" entre dominios.

## 2. Alcance de este corte (v1)

- **Mis fincas** (`AgroFarmsScreen`): usa `GET /v1/agro/memberships` — solo
  fincas donde el usuario es `AgroFarmMember` ACTIVE. **Gap conocido y
  documentado, no silencioso**: una finca que el usuario posee
  (`AgroFarm.ownerId`) sin ser también miembro no aparece aquí; encaja con el
  público de este corte (trabajadores de campo reportando), no con el dueño
  viendo su finca desde el celular. Con cero fincas, el estado vacío es
  honesto ("No estás asignado a ninguna finca todavía"), en vez de ocultar la
  pestaña — evita una llamada extra al arrancar la app solo para decidir si
  mostrar el tab.
- **Reportar incidencia** (`AgroReportIncidentScreen`): reusa
  `POST .../intake/propose` → revisión humana obligatoria
  (`requiresHumanReview: true` siempre) → `POST .../incidents`. Solo texto en
  este corte — ver §3 (gap de audio). Adjuntar fotos es best-effort: se suben
  con el mismo contrato presign→PUT que `EvidenceCapture` (`/v1/evidence/presign`
  genérico, sin campo `domain`), pero se registran como evidencia **inline**
  en el body de `POST .../incidents` (`evidence: [{mediaType: "PHOTO", fileUrl}]`),
  no como `AgroEvidenceItem` independiente — más simple para v1, sin necesitar
  pre-registrar evidencia antes de proponer. **Consecuencia**: las fotos no se
  envían a `intake/propose` como `evidenceIds`, así que esta pantalla nunca ve
  `visionSignals` en la propuesta (el reconocimiento de objetos de T-054 sigue
  sin usarse desde mobile) — deliberado, no un bug.
- **Mis incidencias** (`AgroIncidentsScreen`): lista por finca,
  `GET .../farms/:farmId/incidents`, solo lectura.
- **Mis tareas** (`AgroTasksScreen`): usa el endpoint entre dominios
  `GET /v1/tasks` (`tasks:read:self`, T-058b) y filtra client-side las que
  espejan un `AgroFarmTask` por el prefijo determinístico `agrotask_` del id
  (`agro-jobtask-mirror.ts`, T-051) — no hay campo de origen en la respuesta.
  Completar usa los endpoints nativos de Agro
  (`POST /v1/agro/tasks/:taskId/{start,complete}`), no el genérico
  `PATCH /v1/tasks/:taskId/status`: ese último exige el permiso `jobs:update`,
  que el WORKER de Agro no tiene (solo `tasks:read:self`). El FSM de
  `AgroFarmTask` no permite `PENDING → COMPLETED` directo, así que la pantalla
  llama `start` primero cuando hace falta (`completeAgroTaskFromAnyStatus`),
  nunca lo asume el backend.

## 3. Gap explícito: audio diferido

El intake Prometeo aprobado (T-054) incluye transcripción automática de
evidencia `AUDIO`. `apps/mobile/package.json` no tiene `expo-av` ni
`expo-audio` (solo `expo-image-picker`) — grabar audio en mobile requeriría
agregar una dependencia nativa nueva, no trivial dado que el proyecto ya usa
`expo-dev-client` (no es managed workflow puro, implica reconstruir el
dev-client). Esa decisión de agregar la dependencia no se tomó en esta
sesión — el reporte por voz queda fuera de este corte, deliberadamente, hasta
que se decida por separado. La pantalla de reporte es texto-solamente.

## 4. Qué no se tocó

- Ningún endpoint de `apps/api` — T-055 es 100% cliente, reusa los contratos
  ya existentes de T-050/T-051/T-053/T-054/T-058b sin cambios.
- `EvidenceCapture` (componente compartido web/Jobs): no se generalizó su
  tipo `EvidenceTarget` para aceptar `farmId` — la subida de Agro se
  implementó inline en `AgroReportIncidentScreen` en vez de forzar ese
  componente a un cuarto caso, porque el registro final es distinto (inline
  en el incidente, no `POST /v1/evidence`).
- Workforce, finanzas (`farm.finance`), dashboard Agro: fuera del alcance
  aprobado para este corte.

## 5. Verificación

- `apps/mobile`: 50/50 test suites, 232/232 tests (incluye 4 suites nuevas:
  `AgroFarmsScreen`, `AgroIncidentsScreen`, `AgroReportIncidentScreen`,
  `AgroTasksScreen`).
- `pnpm typecheck` (workspace completo, incluye `check:mobile` → `tsc --noEmit`)
  y `pnpm lint` (0 errores; mismos 36 warnings preexistentes) — limpio.
- Sin cambios en `apps/api`, así que no se re-corrieron sus suites de
  integración/unit (nada que pudieran romper).

## Pendiente

- Reporte por audio en mobile — depende de una decisión aparte sobre agregar
  `expo-av`/`expo-audio` (ver §3).
- Owner-no-miembro no ve su finca desde mobile (ver §2) — mismo criterio que
  se documentaría para cualquier futura pantalla Agro que use
  `listMemberships`.
- Vision signals (T-054) no llegan a esta pantalla — requeriría pre-registrar
  evidencia (`POST .../farms/:farmId/evidence`) antes de `intake/propose`,
  fuera de alcance de este corte (ver §2).
