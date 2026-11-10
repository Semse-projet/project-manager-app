---
id: "core.geofence-policy"
title: "Preferencia de ubicación y decisión ante eventos de geocerca — parte de servidor (BO-09)"
domain: "core"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags:
  - "SEMSE_GEOFENCE_POLICY_ENABLED"
production_evidence: []
related_files:
  - "apps/api/src/modules/geofence/geofence.policy.ts"
  - "apps/api/src/modules/geofence/geofence.service.ts"
  - "apps/api/src/modules/geofence/geofence.controller.ts"
  - "packages/db/prisma/schema.prisma"
related_tests:
  - "apps/api/test/geofence-policy.test.ts"
related_endpoints: []
related_events:
  - "location_preference.changed"
related_agents: []
last_verified: "2026-10-20"
---
# BO-09 — Preferencia de ubicación y decisión de geocerca (servidor)

Fuente: plan Astra `03_producto/08_TIME_TRACKER_GEO_NOTIFICACIONES.md`. La app móvil ya detecta proximidad en segundo plano (`apps/mobile/src/geo`); este slice añade la **política del servidor**: qué hacer ante cada evento, según la preferencia de la persona.

## Estado: NO CERRADO
Este slice cubre solo la parte de servidor, probada con pruebas unitarias. **No se ha probado en dispositivos.** El plan exige probar en iOS y en Android, en primer plano, en segundo plano, con ahorro de batería, sin conexión y con ubicación mala. Los teléfonos disponibles (2026-10-20) son dos iPhone: iOS podrá verificarse, Android no. Hasta entonces BO-09 es `PARTIAL / NOT VERIFIED` (Gate 5 del plan). Tampoco incluye notificaciones al supervisor ni proveedor push (OPEN-16).

## Decisiones del propietario
| ID | Decisión | Efecto |
|---|---|---|
| OPEN-07/08 | ASK por defecto. | Sin preferencia guardada, el modo es ASK. AUTO solo con un **consentimiento específico y separado** del trabajador; salir de AUTO lo revoca. Sin ubicación fuera de jornada: la app decide cuándo enviar eventos. |
| OPEN-10 | Retención mínima. | **No se guardan coordenadas**: el cuerpo del evento ni siquiera las admite. Solo el resultado, el modo y un rango de precisión (`GOOD` ≤ 50 m, `POOR`, `UNKNOWN`). |
| OPEN-09 | Política versionada. | `policyVersion` se guarda con cada decisión y sube al cambiar la preferencia. |

## API (tras `SEMSE_GEOFENCE_POLICY_ENABLED`; apagado → 404)
- `GET/PUT /v1/me/location-preference` — `{ mode: ASK|AUTO|OFF, autoStartConsent? }`.
- `POST /v1/me/geofence-events` — `{ eventId, type: ARRIVAL|LEAVE|OFF_SITE_AT_SHIFT, worksiteId, occurredAt, accuracyMeters? }` → una **decisión**.
- `GET /v1/me/geofence-events` — transparencia: la persona ve qué decidió el sistema con sus eventos.

## Tabla de decisión
| Evento | ASK | AUTO consentido | OFF |
|---|---|---|---|
| Llegada, buena señal | `PROMPT` | `AUTO_START_ALLOWED` | `IGNORE` |
| Llegada, señal mala o desconocida | `MANUAL_ONLY` | `MANUAL_ONLY` | `IGNORE` |
| Hora de turno estando fuera | `PROMPT` | `EXCEPTION` (no se inicia por horario ni por ubicación ausente) | `IGNORE` |
| Salida con reloj activo | `LEAVE_PROMPT` | `LEAVE_PROMPT` (nunca termina en silencio) | `IGNORE` |
Además se ignoran: obra ajena o inexistente, evento fuera de la ventana (más de 10 min de antigüedad o más de 5 min en el futuro), repetido dentro del enfriamiento (10 min), y llegada con una sesión ya activa (no hay doble sesión). Un AUTO sin consentimiento vigente se comporta como ASK.

## Reglas
1. **El servidor decide, no actúa:** nunca inicia ni termina un reloj ni inventa una hora. `AUTO_START_ALLOWED` es un permiso que la app puede usar.
2. Idempotente por `eventId`: repetir devuelve la misma decisión (`replayed: true`) sin duplicar.
3. La obra debe ser de una Org donde la persona es miembro ACTIVE.
4. Un cambio de preferencia se audita (`location_preference.changed`).

## Criterios de aceptación
AC-01 flag apagado → 404 · AC-02 sin preferencia es ASK · AC-03 AUTO exige consentimiento aparte · AC-04 salir de AUTO lo revoca · AC-05 llegada en ASK pregunta y no guarda coordenadas · AC-06 AUTO permite pero no inicia · AC-07 idempotencia · AC-08 enfriamiento · AC-09 sin doble sesión; la salida pregunta · AC-10 obra ajena y evento viejo se ignoran · AC-11 OFF no usa ubicación y la persona ve sus eventos.

## Fuera de alcance
Pruebas en dispositivos (iOS y Android), notificaciones push y su proveedor (OPEN-16), aviso al supervisor, horario programado y recordatorios de turno (usan BO-08), y la pantalla de preferencia en la app.

## Riesgos
Rastreo indebido: por eso no hay coordenadas, ASK por defecto y OFF la apaga. Falsa precisión de entrega de avisos: este slice no promete entrega.
