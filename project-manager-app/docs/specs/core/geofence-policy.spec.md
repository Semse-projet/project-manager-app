---
id: "core.geofence-policy"
title: "Preferencia de ubicación y decisión ante eventos de geocerca — parte de servidor (BO-09)"
domain: "core"
sdd_version: "2.0"
version: "0.3"
status: "APPROVED"
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
related_endpoints:
  - "GET /v1/me/location-preference"
  - "PUT /v1/me/location-preference"
  - "POST /v1/me/geofence-events"
  - "GET /v1/me/geofence-events"
related_events:
  - "location_preference.changed"
related_agents: []
last_verified: "2026-11-12"
---
# BO-09 — Preferencia de ubicación y decisión de geocerca (servidor)

Fuente: plan Astra `03_producto/08_TIME_TRACKER_GEO_NOTIFICACIONES.md`. La app móvil ya detecta proximidad en segundo plano (`apps/mobile/src/geo`); este slice añade la **política del servidor**: qué hacer ante cada evento, según la preferencia de la persona.

## Estado: NO CERRADO
Este slice cubre solo la parte de servidor, probada con pruebas unitarias. **No se ha probado en dispositivos.** El plan exige probar en iOS y en Android, en primer plano, en segundo plano, con ahorro de batería, sin conexión y con ubicación mala. Los teléfonos disponibles (2026-10-20) eran dos iPhone; desde 2026-11-12 el propietario dispone además de un Motorola, así que iOS **y** Android pueden verificarse. Hasta entonces BO-09 es `PARTIAL / NOT VERIFIED` (Gate 5 del plan). Tampoco incluye notificaciones al supervisor ni proveedor push (OPEN-16).

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
Notificaciones push y su proveedor (OPEN-16), aviso al supervisor, horario programado y recordatorios de turno (usan BO-08). Las pruebas en dispositivos y la integración del cliente móvil pasan a ser trabajo planificado (ver v0.2), no fuera de alcance.

## Riesgos
Rastreo indebido: por eso no hay coordenadas, ASK por defecto y OFF la apaga. Falsa precisión de entrega de avisos: este slice no promete entrega.

## v0.2 — Capa web, cliente móvil y aprobación (2026-11-12)

**Autorización del propietario.** En la sesión de diseño de pantallas, Samuel pidió continuar con geofence: «si el spec no está créalo y ajústalo y si tenemos que probar en dispositivos yo tengo los dispositivos tengo tres celulares un Motorola y dos iPhone», y luego «Continúa». Se registra como autorización para implementar la capa web descrita abajo sobre la API existente. **No** cierra el Gate 5 (pruebas en dispositivos), **no** activa `SEMSE_GEOFENCE_POLICY_ENABLED` y **no** decide OPEN-17.

### Capa web (`/worker/location`)
- La persona ve su modo efectivo (ASK/AUTO/OFF), lo cambia, y para AUTO otorga un **consentimiento específico y separado** (casilla explícita; sin ella la API responde 422). Salir de AUTO revoca el consentimiento y la pantalla lo dice antes de confirmar.
- Transparencia (AC-11): lista de los últimos 50 eventos con tipo, decisión, motivo, modo, precisión (rango, nunca coordenadas) y versión de política.
- Flag apagado → la pantalla indica que la función no está habilitada. BFF por el proxy autenticado (sin caída a OPS_ADMIN).

### OPEN-17 — Dos fuentes de preferencia (DECIDIDO 2026-11-12: «BO-09 manda»)
Hallazgo 2026-11-12: el móvil (`apps/mobile/src/geo/proximityService.ts`) **no llama** a esta API. Usa `User.proximityCheckInMode` (`ask|auto|off`, del perfil) y, en `auto`, **inicia el reloj por sí mismo** enviando coordenadas en el check-in, sin el consentimiento separado ni la decisión del servidor que exige este spec. Hasta resolver OPEN-17 conviven dos preferencias. Propuesta: con el flag encendido, el móvil envía cada evento a `POST /v1/me/geofence-events` y solo auto-inicia ante `AUTO_START_ALLOWED`; con el flag apagado (404) conserva el comportamiento actual. Requiere decisión explícita porque cambia el camino real del reloj (horas pagables).

### Plan de verificación en dispositivos (Gate 5)
Motorola (Android) y dos iPhone; cada uno en primer plano, segundo plano, ahorro de batería, sin conexión y con ubicación mala; modos ASK, AUTO con consentimiento y OFF; llegada, salida con reloj activo y hora de turno fuera de obra. Evidencia por caso: decisión registrada en `GET /v1/me/geofence-events` y comportamiento observado en el teléfono.

## v0.3 — Decisión OPEN-17 e implementación (2026-11-12)

**Decisión del propietario (OPEN-17):** «BO-09 manda». Con `SEMSE_GEOFENCE_POLICY_ENABLED` encendido, `LocationPreference` reemplaza a `User.proximityCheckInMode`; con el flag apagado (404) todo sigue como antes.

Implementado en esta versión:
- **Mapeo único** (`apps/web/lib/location-mode.ts`, espejo en `apps/mobile/src/geo/locationMode.ts`): el modo **efectivo** de BO-09 alimenta el interruptor local de proximidad de los clientes: OFF → `off`; ASK → `ask`; AUTO con consentimiento vigente → `auto`; AUTO sin consentimiento → `ask`.
- **Web:** `/worker/settings` muestra la preferencia BO-09 (con consentimiento separado y revocación al salir de AUTO) en lugar del selector antiguo, y Guardar deja de enviar `proximityCheckInMode`. `/worker/tracker` toma el modo de BO-09. `/worker/location` añade la transparencia de eventos (AC-11).
- **Móvil:** `refreshProximitySites()` guarda el modo mapeado de BO-09 y la pantalla de Ajustes cambia a BO-09, con diálogo nativo de consentimiento y de revocación.

### OPEN-18 — Identidad de la obra en los eventos (pendiente de decisión)
`POST /v1/me/geofence-events` solo considera válida una `Worksite` (BO-07) de una Org donde la persona es ACTIVE; si no, la decisión es `IGNORE` («obra no permitida»). Pero las `Worksite` **no tienen coordenadas** y los clientes detectan proximidad contra **jobs y proyectos libres**. Hoy ningún cliente puede generar un evento válido, así que la decisión por evento del servidor (precisión GOOD/POOR, enfriamiento, «sin doble sesión», excepción por horario) **todavía no gobierna** el auto-inicio: lo hace el interruptor local mapeado. Opciones: (a) aceptar `siteKind` + `siteId` (job asignado / proyecto libre propio) en el evento; (b) dar coordenadas y radio a `Worksite` (migración) y que los clientes detecten obras. Hasta decidir, el consentimiento separado y OFF ya se respetan, pero la regla «con señal mala no se auto-inicia» no está garantizada en el cliente.

### Notas de verificación
Las pruebas unitarias de la lógica de mapeo pasan en web (`tests/unit/location-mode.test.ts`) y en móvil (`src/geo/locationMode.test.ts`, ejecutada con Node porque el preset jest-expo no arranca en el sandbox: falta `react-native` instalado; la misma falla ocurre sin estos cambios). CI no ejecuta pruebas del móvil. El Gate 5 (dispositivos) sigue pendiente.
