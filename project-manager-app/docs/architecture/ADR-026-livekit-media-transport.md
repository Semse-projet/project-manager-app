# ADR-026 — Transporte de media para LiveSession: LiveKit (SFU)

**Estado:** PROPOSED
**Fecha:** 2026-09-07
**Relacionado con:**
- `docs/specs/prometeo/live-sessions.spec.md` (`APPROVED` 2026-09-07)
- `docs/specs/prometeo/live-sessions.plan.md` §3, §11
- ROADMAP F7 — Prometeo Multimodal ("voz, cámara, fotos y archivos binarios",
  "video intelligence", "streaming, tool cards y approval cards", "quotas,
  retention y redacción")
- `docs/consolidation/LIVESESSION_RECOVERY_CONTRACT.md`

---

## 1. Contexto

`LiveSession` (spec `prometeo.live-sessions`) necesita un canal de audio/vídeo
en tiempo real entre dos participantes autorizados de un `Job`/`FreeProject`
(más Prometeo como observador lógico), para inspección remota y asistencia
guiada. SEMSE no tiene hoy ningún transporte de media propio; cualquier vídeo
ocurre fuera de la plataforma.

La implementación de referencia hallada en el árbol sin Git
`project-manager-app-main` (`apps/api/src/modules/live-sessions/livekit.service.ts`)
ya asume **LiveKit**: la API firma un token de participante y el cliente se
conecta a un SFU. Este ADR decide si se adopta esa dirección o se cambia.

Requisitos que impone el spec sobre el transporte:

- Token **efímero por participante**, firmado server-side, acotado al room de
  la sesión, nunca logueado.
- **Webhooks de ciclo de vida** que el backend pueda usar como drivers de la
  FSM (`CONNECTING→ACTIVE`, `ENDING→ENDED`, `CONNECTING→FAILED`).
- Prometeo como participante lógico (poder recibir/observar el stream a
  futuro para `ObservationMission`) — descarta P2P puro.
- Cliente **React Native** (Expo SDK 57), con la restricción de que el módulo
  nativo **no** carga en Expo Go (sólo development/production build).
- **Sin grabación ni retención** en este corte (eso es gate F7 aparte); el
  transporte no debe forzar egress/almacenamiento.
- Aislamiento por tenant + participante; el backend es la única autoridad que
  decide quién recibe un token.

## 2. Opciones consideradas

### A. LiveKit (SFU gestionado o self-host) — **elegida**

SFU open-source con `livekit-server-sdk` (Node) para firmar tokens con grants,
webhooks de room/participante, y SDKs de cliente para React Native. Cloud
gestionado disponible; self-host posible (contenedor + Redis).

- **A favor:** cubre los 6 requisitos directamente; ya es la premisa de la
  implementación de referencia (menos trabajo de reescritura); grants finos
  por room; webhooks nativos; SDK RN mantenido; Prometeo puede unirse como
  participante server-side a futuro; egress es opt-in (no obligado).
- **En contra:** dependencia externa nueva (cuenta/plan + `LIVEKIT_*` en
  Railway = acción humana); el SDK RN obliga a development build (rompe el
  flujo Expo Go — mitigado con estado `degraded`); coste por minuto de
  participante en el plan cloud.

### B. WebRTC peer-to-peer directo (sin SFU)

`react-native-webrtc` + señalización propia sobre el SSE/WS existente.

- **A favor:** sin dependencia de terceros; sin coste por minuto.
- **En contra:** no escala más allá de 1:1 (Prometeo como 3er participante ya
  no entra); sin webhooks de ciclo de vida (habría que inferir estado desde
  ICE, frágil como driver de FSM); NAT traversal necesita igualmente
  STUN/TURN (que también se paga/hospeda); toda la lógica de señalización,
  reconexión y calidad queda a cargo del equipo. Rechazada: el coste de
  ingeniería y la falta de webhooks superan el ahorro.

### C. Proveedor de vídeo "llave en mano" (Daily, Twilio Video, Agora, Vonage)

- **A favor:** menos operación que self-host; SDKs RN; algunos con Expo config
  plugin.
- **En contra:** mismo lock-in y coste por minuto que LiveKit cloud, pero
  alejándose de la implementación de referencia (reescritura completa del
  módulo); menos control sobre self-host si el coste cloud se vuelve
  problema; Twilio Video está en camino de descontinuación. No aporta sobre A.

### D. No hacer LiveSession con media en tiempo real (sólo estado + chat)

- **A favor:** cero dependencia nueva; el modelo/FSM/SSE del spec ya aportan
  valor (una "sesión" coordinada con Prometeo y evidencia asíncrona).
- **En contra:** no cumple el resultado esperado del spec ("ver el estado real
  de la obra ahora"). Queda como **fallback** si la decisión de infra de
  LiveKit se demora: la Fase B (modelo + FSM + tests) del plan no depende de
  LiveKit y puede mergearse; la Fase C de media espera.

## 3. Decisión

**Adoptar LiveKit (opción A)** como transporte de media para `LiveSession`,
reusando la dirección de la implementación de referencia. Modo de despliegue
(cloud gestionado vs self-host en Railway) queda **abierto** — lo decide el
propietario junto con `LIVEKIT_*`; no bloquea el modelo, la FSM, los contratos
ni los tests (Fases A-B del plan).

Concreto:

- `apps/api` firma tokens de participante con `livekit-server-sdk`, TTL ≤ vida
  de la sesión, grants acotados al room `live-session:<tenantId>:<sessionId>`,
  sólo para usuarios con fila activa en `LiveSessionParticipant`.
- `LiveKitWebhookController` verifica la firma del webhook y traduce
  `room_started`/`participant_joined`/`room_finished`/error a transiciones de
  la FSM.
- Cliente móvil usa el SDK RN de LiveKit **sólo** en development/production
  build; en Expo Go la pantalla renderiza `degraded` y no importa el módulo
  nativo.
- **Sin egress/grabación.** Si más adelante se necesita grabación, retención o
  transcripción, va en su propio ADR/child spec bajo el gate F7.

## 4. Consecuencias

**Positivas:**

- La implementación de referencia se puede reusar con correcciones acotadas
  (los 8 huecos de spec §13), no reescribir.
- Webhooks dan drivers de FSM confiables → menos sesiones colgadas.
- Camino claro para que Prometeo se una como participante server-side
  (`ObservationMission`, futuro).

**Negativas / a gestionar:**

- **Acción humana bloqueante:** cuenta/plan LiveKit + `LIVEKIT_URL` /
  `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` en Railway antes de la Fase F. Un
  agente no toca env de producción.
- **Expo Go deja de cubrir esta pantalla.** Aceptado: se documenta y se
  degrada con gracia; el resto de `apps/mobile` sigue funcionando en Expo Go.
- **Coste por minuto de participante** en el plan cloud. Mitigación: `expiresAt`
  corto, tope de sesiones `ACTIVE` concurrentes por recurso, y la opción de
  self-host si el coste escala.
- Nueva superficie de seguridad (webhook público). Mitigación: verificación de
  firma obligatoria, y el webhook sólo transiciona la FSM, no crea sesiones ni
  emite tokens.

## 5. Reversibilidad

El feature entero va detrás de `SEMSE_LIVE_SESSIONS_ENABLED` (off por defecto)
+ canary por tenant. Rollback = flag off. Si LiveKit resulta inadecuado, el
modelo/FSM/SSE (Fase B) son independientes del transporte: se puede cambiar de
proveedor tocando sólo `livekit.service.ts` + el webhook controller + el SDK
de cliente, sin migración de datos. La migración Prisma es aditiva y su `DROP`
es seguro mientras el flag nunca se activó.

## 6. Pendiente antes de `APPROVED`

- [ ] Decisión del propietario: LiveKit **cloud gestionado** vs **self-host en
      Railway** (coste vs operación).
- [ ] Revisión de seguridad del endpoint de webhook (firma, rate-limit,
      idempotencia por `room`/`event id`).
- [ ] Confirmar que `react-native-livekit` / su config plugin es compatible con
      Expo SDK 57 development builds (spec §11 lo cita como investigación
      primaria; validar en un build real).
