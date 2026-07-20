# Plan de remediación — Auditoría SEMSE 2026-07

> Documento vivo. Se actualiza a medida que se audita cada módulo (Cliente → Worker → Admin) y a medida que se corrige cada hallazgo. No es un reporte de una sola sesión — es el backlog de trabajo.

## Cómo usar este documento

- Cada hallazgo tiene: severidad, estado (`[ ]` pendiente / `[x]` corregido), archivo:línea, qué está mal, y hacia dónde apunta el fix.
- El narrativo completo (por qué importa, cómo se verificó, capturas de pantalla en vivo) está en el reporte original: artefacto **"SEMSE — Auditoría de UI/UX y backend"**, publicado en esta cuenta de Claude — pídele a Claude que lo busque con `action: "list"` si necesitas el contexto largo de un hallazgo específico. Este documento es el resumen accionable, no el reemplazo.
- Orden de trabajo sugerido: **Sección 0 (seguridad transversal) primero**, sin importar en qué módulo estés — son los hallazgos más graves y no son específicos de una sola pantalla. Después, módulo por módulo: Cliente (ya auditado) → Worker (pendiente) → Admin (pendiente).
- Al corregir un hallazgo: márcalo `[x]`, y si vale la pena, anota el commit/PR al final de la línea.

**Estado de auditoría por módulo:**

| Módulo | Código estático | En vivo (producción) | Fecha |
| --- | --- | --- | --- |
| Backend transversal (auth, pagos, Forge, SSE, algoritmos) | ✅ Completo | Parcial (solo lo alcanzable desde el rol Cliente) | 2026-07-20 |
| Cliente | ✅ Completo | ✅ Completo | 2026-07-20 |
| Worker | 🟡 Parcial (via labor-engine/tracker, no como módulo dedicado) | ❌ Pendiente — falta credencial de worker | — |
| Admin | 🟡 Parcial (via los agentes de UX/backend) | ❌ Pendiente — falta credencial de OPS_ADMIN | — |

---

## Sección 0 — Seguridad transversal (hacer esto primero, sin importar el módulo)

### 0.1 — CRÍTICO — Bypass de login vía spoofing de headers en el BFF
- **Qué:** `apps/web/middleware.ts` no descarta los headers `x-semse-user-id/tenant-id/org-id/roles` cuando no hay sesión, en rutas públicas como `/api/semse/auth/login`. El BFF usa esos headers atacante-controlados para pedir un token real al backend con el secreto `SEMSE_BOOTSTRAP_TOKEN` propio del servidor.
- **Dónde:** `apps/web/middleware.ts:43-55,84-86` · `apps/web/lib/semse-api-auth.ts:6` · `apps/web/app/api/semse/_server.ts:141-159,201-224` · `_access-token-bootstrap.ts:74-80`
- **Fix:** el middleware debe descartar/sobrescribir los headers `x-semse-*` entrantes SIEMPRE que no haya sesión válida, antes de evaluar si la ruta es pública — no solo cuando sí hay sesión.
- **Estado:** [ ] Pendiente

### 0.2 — CRÍTICO — `SEMSE_BOOTSTRAP_TOKEN` no se exige en código
- **Qué:** a diferencia de `AUTH_SECRET` (obligatorio en producción), esta variable es opcional en el código — si faltara, `POST /v1/auth/token` firma tokens para cualquiera. Hoy SÍ está configurada en Railway (verificado 2026-07-20), pero el código no lo garantiza.
- **Dónde:** `apps/api/src/modules/auth/auth.controller.ts:31-50,69-88`
- **Fix:** hacer que el arranque del servicio truene si la variable no está seteada en producción, igual que `AUTH_SECRET`.
- **Estado:** [ ] Pendiente

### 0.3 — CRÍTICO — Ni logout ni cambio de rol invalidan el token
- **Qué:** el JWT es stateless, solo se verifica firma/expiración. `logout()` y el reset de contraseña solo marcan la sesión en BD como revocada, nunca invalidan el token en sí. TTL real: 8 horas.
- **Dónde:** `apps/api/src/modules/auth/auth.service.ts:127-137,233-255` · TTL: `358,383,299`
- **Fix:** verificar el estado de la sesión en BD en cada request (no solo la firma), o reducir el TTL agresivamente y aceptar el trade-off, o implementar una lista de revocación real.
- **Estado:** [ ] Pendiente

### 0.4 — CRÍTICO (seguridad) — IDOR cross-tenant en aprobación de evidencia de milestones
- **Qué:** `updateEvidenceItemStatus` filtra por `id`/`milestoneId`, nunca por `tenantId` — a diferencia de sus funciones vecinas en el mismo archivo. Afecta directo la auto-liberación de escrow. `itemId` es predecible (timestamp + 4 chars).
- **Dónde:** `apps/api/src/modules/milestones/milestones.repository.ts:714-738` · controller: `milestones.controller.ts:220-266`
- **Fix:** agregar el filtro `tenantId` (o `milestone: { project: { tenantId } }`, el patrón que ya usan `archiveEvidenceItem`/`replaceEvidenceItem` dos funciones al lado).
- **Estado:** [ ] Pendiente

### 0.5 — CRÍTICO (seguridad) — IDOR cross-org en change-orders
- **Qué:** `findOwned()` filtra solo por `id` + `tenantId`, nunca verifica que el actor pertenezca a la org cliente o profesional del job. Aprobar/rechazar/aplicar confían en ese lookup sin capa adicional.
- **Dónde:** `apps/api/src/modules/change-orders/change-orders.service.ts:378-386`
- **Fix:** agregar verificación de org-ownership antes de cualquier mutación.
- **Estado:** [ ] Pendiente

### 0.6 — CRÍTICO (seguridad) — Cross-tenant en canal SSE del copiloto (explotable en vivo)
- **Qué:** `planStream`/`delegationsStream` filtran por tenant solo en el snapshot inicial — el canal de push en vivo se suscribe directo a `plan:${planId}`/`delegations:${projectId}` sin revalidar tenant. Los 8 endpoints SSE además son `@Public()` sin verificación de sesión propia.
- **Dónde:** `apps/api/src/infrastructure/sse/sse.controller.ts:31-84`
- **Fix:** revalidar ownership del `planId`/`projectId` contra el tenant conectado antes de abrir la suscripción push; considerar quitar `@Public()` y verificar sesión también a nivel API, no solo confiar en el header que pone el BFF.
- **Estado:** [ ] Pendiente

### 0.7 — CRÍTICO (seguridad) — Un header del cliente decide en qué tenant se escribe un archivo
- **Qué:** el emisor de planes de subida lee `tenantId` de `x-tenant-id` (header del cliente) en vez de `resolveRequestContext(req)`. La ruta de descarga es pública sin firma/expiración.
- **Dónde:** `apps/api/src/infrastructure/storage/uploads.controller.ts:174-175,237-238`
- **Fix:** usar la sesión verificada, no el header.
- **Estado:** [ ] Pendiente

### 0.8 — CRÍTICO (seguridad) — Descargar un archivo por el BFF no manda identidad al backend
- **Qué:** el handler `GET` de `uploads/files/[...key]` no adjunta headers autorizados a la petición saliente (el `PUT` en el mismo archivo sí). El backend recibe la descarga como anónima.
- **Dónde:** `apps/web/app/api/semse/uploads/files/[...key]/route.ts` — PUT:15-39 vs GET:60-78
- **Fix:** aplicar el mismo `buildAuthorizedHeaders` que ya usa el PUT.
- **Estado:** [ ] Pendiente

### 0.9 — CRÍTICO (confianza) — Verificación de identidad del worker (firma DID) es un stub
- **Qué:** el código literalmente comenta "for now, return synthetic verification" y solo valida que las strings no estén vacías. Cero criptografía real.
- **Dónde:** `apps/api/src/modules/worker-verification/worker-verification.repository.ts:115-135`
- **Fix:** implementar verificación criptográfica real (crypto.subtle o tweetnacl, como el propio comentario del código sugiere), o dejar de exponer "verificado" en el producto hasta que exista.
- **Estado:** [ ] Pendiente

### 0.10 — CRÍTICO (seguridad) — vision-service sin autenticación, expuesto públicamente
- **Qué:** ningún endpoint verifica API-key/firma. CORS con `allow_origins=["*"]` + `allow_credentials=True`. Cualquiera con la URL pública puede llamar endpoints costosos (análisis en lote) gratis.
- **Dónde:** `apps/vision-service/app/main.py:13-19` · `app/routes/evidence.py`
- **Fix:** agregar autenticación (API-key compartida entre `apps/api` y `apps/vision-service` como mínimo), corregir CORS.
- **Estado:** [ ] Pendiente

### 0.11 — CRÍTICO (seguridad) — Bypass del SSRF-guard de vision-service por nombre de archivo
- **Qué:** el gate real es `if "localhost" in url or "127.0.0.1" in url` — substring sobre la URL completa, no el hostname. Una URL de S3 legítima que contenga esas palabras en el nombre del archivo activa el bypass y la "verificación" devuelve una imagen mock fija, sin analizar la foto real.
- **Dónde:** `apps/vision-service/app/services/image_loader.py:51-79` · duplicado en `app/routes/evidence.py:86`
- **Fix:** parsear la URL y comparar el hostname exacto, no un substring de la URL completa.
- **Estado:** [ ] Pendiente

### 0.12 — CRÍTICO (dinero) — Estado de transacción marcado SUCCEEDED sin verificar al proveedor real
- **Qué:** `depositFunds`/`releaseFunds`/`refundFunds` escriben `status: "SUCCEEDED"` siempre, sin leer el estado real (pending/processing/authorized) que devuelven Stripe/PayPal/transferencia bancaria.
- **Dónde:** `apps/api/src/modules/payments/payments.repository.ts` — depositFunds:307-314 · releaseFunds:377-385 · refundFunds:444-451
- **Fix:** leer y persistir el estado real del provider intent; solo marcar SUCCEEDED cuando el provider confirme.
- **Estado:** [ ] Pendiente

### 0.13 — CRÍTICO (dinero) — El webhook de pagos es un no-op total
- **Qué:** verifica la firma correctamente y descarta el payload — no busca la transacción, no actualiza estado, no hay idempotencia.
- **Dónde:** `apps/api/src/modules/payments/payments.service.ts:770-777`
- **Fix:** implementar reconciliación real por `providerRef`.
- **Estado:** [ ] Pendiente

### 0.14 — CRÍTICO (dinero) — El dinero se mueve en el proveedor antes de la verificación atómica de saldo
- **Qué:** `release()`/`refund()` llaman al proveedor real (el payout/transfer se dispara) y solo después intentan escribir la transacción dentro del chequeo atómico que puede rechazar por saldo insuficiente. Dos releases concurrentes pueden ambas disparar pago real y una perder la carrera sin dejar registro.
- **Dónde:** `apps/api/src/modules/payments/payments.service.ts` — release:563-611 · refund:682-712
- **Fix:** invertir el orden — verificar/reservar el saldo atómicamente primero, llamar al proveedor después.
- **Estado:** [ ] Pendiente

### 0.15 — CRÍTICO (dinero) — Mismo patrón en escrow-release.service.ts (auto-release)
- **Qué:** la transferencia real a Stripe se dispara antes de la transacción de BD. Si la BD falla después de que Stripe ya aceptó, un reintento puede pagar dos veces. Además es fire-and-forget desde `milestones.service.ts` (`.catch(() => undefined)`).
- **Dónde:** `apps/api/src/modules/payments/escrow-release.service.ts:69-122` · disparo: `milestones.service.ts:292`
- **Fix:** mismo fix que 0.14, aplicado a este servicio; no descartar el error en el caller.
- **Estado:** [ ] Pendiente

### 0.16 — CRÍTICO (dinero) — Stripe Connect: payout a cuenta compartida si el worker no está "activo"
- **Qué:** `createPayoutIntent` arranca con `STRIPE_CONNECT_ACCOUNT_ID` (cuenta legacy fija) y solo la reemplaza si la cuenta del worker está `active`. Sin error/bloqueo si no lo está.
- **Dónde:** `apps/api/.../payments/providers/stripe.provider.ts:73-83`
- **Fix:** bloquear el payout (no caer a la cuenta compartida) si la cuenta Connect del worker no está activa.
- **Estado:** [ ] Pendiente

### 0.17 — ALTO (dinero) — Webhook de Stripe Connect también es no-op
- **Qué:** no hay ruta dedicada; el estado de la cuenta Connect solo se actualiza con un sync manual.
- **Dónde:** `payments.service.ts:770-777` · `stripe-connect.service.ts:119-142`
- **Estado:** [ ] Pendiente

### 0.18 — CRÍTICO (integridad, Forge) — `completeTask` acepta un resultado fabricado
- **Qué:** el payload de `.../tasks/:taskId/complete` no está validado, incluye `policy.decision`, y el harness le cree para avanzar el run — nunca vuelve a llamar la verificación real. `manifest.fileScopes` es código muerto (nunca se pasa `changedFiles`).
- **Dónde:** `apps/api/.../forge.controller.ts:151-171` · `forge.service.ts:293-309` · `packages/forge/src/policy.ts:86-122`
- **Fix:** derivar la decisión de política server-side a partir de datos reales, no del payload del caller; pasar `changedFiles` real a `evaluateForgePolicy`.
- **Estado:** [ ] Pendiente

### 0.19 — CRÍTICO (cumplimiento laboral) — No existe multiplicador de horas extra
- **Qué:** `(minutos/60) * tarifa` flat, sin ningún umbral semanal. Solo existe una alerta de QualityGuard para que un admin lo vea — nunca toca el pago real.
- **Dónde:** `apps/api/.../labor-engine.repository.ts:253`
- **Fix:** implementar el multiplicador real (1.5x u otra regla, según la política laboral de SEMSE) en el cálculo de pago, no solo en la alerta.
- **Estado:** [ ] Pendiente

### 0.20 — ALTO — Labor Engine sin idempotencia real (duplica horas pagables)
- **Qué:** el `event.id` del cliente nunca se manda al backend; `createTimeEntry` siempre inserta con UUID nuevo. Al fallar la sync a medio lote, el arreglo de reintento conserva TODOS los eventos, incluidos los ya exitosos.
- **Dónde:** `apps/web/.../worker/tracker/page.tsx` — syncPendingEvents:367-434 · `apps/api/.../labor-engine.repository.ts:79-104`
- **Fix:** mandar `event.id` como clave de idempotencia al backend; podar del arreglo de reintento los eventos ya confirmados.
- **Estado:** [ ] Pendiente — **es del módulo Worker, ver sección Worker también**

### 0.21 — ALTO — Herramientas internas abiertas a cualquier rol
- **Qué:** `/anatomy`, `/knowledge`, `/repo-map`, `/runtime-map` están gateadas por `knowledge:read`, permiso que `rbac.ts` otorga a TODOS los roles.
- **Dónde:** `apps/api/.../{anatomy,knowledge,repo-knowledge,runtime-knowledge}/*.controller.ts` · `packages/auth/src/rbac.ts:47,94,110,191`
- **Fix:** crear un permiso `internal:architecture:read` exclusivo de roles internos/admin, o gatear por rol directamente.
- **Estado:** [ ] Pendiente

### 0.22 — ALTO — Barridos programados pueden revertir un estado ya cambiado legítimamente
- **Qué:** `sweepExpired()` (reservas) y `reclaimStale()` (agent runs) hacen `findMany` + `update` sin repetir el filtro de estado en el WHERE, sin transacción — a diferencia de sus métodos hermanos.
- **Dónde:** `apps/api/.../reservations.repository.ts:380-403` · `agents.repository.ts:157-204`
- **Fix:** envolver en transacción y repetir el filtro de estado original en el WHERE del update (mismo patrón que `accept`/`release`/`expire`).
- **Estado:** [ ] Pendiente

### 0.23 — ALTO — Aprobar change-order nunca valida contra el escrow restante
- **Dónde:** `change-orders.service.ts:158-169,229-233,251-312`
- **Fix:** consultar el módulo de pagos/escrow antes de aprobar/aplicar un aumento de presupuesto.
- **Estado:** [ ] Pendiente

### 0.24 — ALTO — Una entrada manual no puede representar un turno que cruza medianoche
- **Dónde:** `apps/api/.../labor-engine.service.ts:124-131`
- **Fix:** permitir `endedAt` en el día siguiente cuando `startTime > endTime`.
- **Estado:** [ ] Pendiente — **módulo Worker**

### 0.25 — ALTO — El esquema de evidencia diseñó una banda de "revisión manual" que la decisión real ignora
- **Qué:** `ValidationScore.status` distingue 3 bandas, pero `validateEvidenceAsync` calcula su propio estado, ignora `score.status`, y usa un corte binario duro en 0.65.
- **Dónde:** `apps/api/.../evidence-gateway.service.ts:136,295`
- **Fix:** usar `score.status` (que ya tiene la banda de revisión manual) en `validateEvidenceAsync` en vez de recalcular con un binario propio.
- **Estado:** [ ] Pendiente

### 0.26 — ALTO — El score de calidad de evidencia no verifica el sujeto de la foto
- **Qué:** solo combina nitidez/luz/contraste. El comparador de referencia y el detector de oficio existen pero no alimentan el score numérico.
- **Dónde:** `apps/vision-service/app/services/scoring.py:37`
- **Fix:** considerar (a mediano plazo) blender la señal de `reference_match`/`trade_detector` al score numérico, no solo a metadata.
- **Estado:** [ ] Pendiente

### 0.27 — ALTO (algoritmo) — Matching penaliza sistemáticamente a profesionales experimentados
- **Dónde:** `apps/api/.../matching/matching.algorithm.ts:67-75` (Jaccard) · pesos: `20-25`
- **Fix:** cambiar a una métrica de cobertura (`intersección / palabras del job`) en vez de Jaccard simétrico.
- **Estado:** [ ] Pendiente

### 0.28 — ALTO (algoritmo) — Cold-start: profesional nuevo entierra en 0 real, no neutral
- **Dónde:** `packages/db/prisma/schema.prisma:230` (`trustScore` default 0) · `matching.service.ts:65-67`
- **Fix:** definir un prior neutral en vez de 0, o una rampa de arranque para profesionales nuevos.
- **Estado:** [ ] Pendiente

### 0.29 — ALTO (algoritmo) — Estimador de presupuesto no usa área ni ubicación; fallback mezcla trabajos sin relación
- **Qué:** confirmado en vivo — un job de "reparación de fugas" (referencia $80) recibió sugerencia de $2,074–$4,839, auto-aplicada sin confirmar.
- **Dónde:** `apps/api/.../budget-intelligence.service.ts:39-45,65-101,122-140`
- **Fix:** incorporar área/sqft y el multiplicador de `LocationCostService` (ya existe, no está conectado); no promediar categorías no relacionadas en el fallback de pocos datos.
- **Estado:** [ ] Pendiente

### 0.30 — ALTO (algoritmo) — Calculadora de madera usa espaciado no estándar (18" en vez de 16" o.c.)
- **Dónde:** `packages/tools/src/materials/materials-calculator.ts:305`
- **Fix:** cambiar `lengthFt / 1.5` a `lengthFt / 1.333` (16" on-center).
- **Estado:** [ ] Pendiente

### 0.31 — CRÍTICO — Función caída: "Calcular estimado" de ProTools da 404 en cada intento
- **Qué:** confirmado en vivo — `POST /api/semse/agents/protools/estimate` → 404. El frontend muestra el error crudo de parseo JSON al usuario.
- **Dónde:** `/client/protools` (frontend) — falta encontrar/crear la ruta backend correspondiente
- **Fix:** implementar o corregir la ruta del BFF/backend para ese endpoint; agregar manejo de error decente en el frontend para cuando la respuesta no sea JSON válido.
- **Estado:** [ ] Pendiente

---

## Sección 1 — Módulo Cliente (auditado completo, código + en vivo, 2026-07-20)

### Dinero sin confirmación (UI)
- **1.1 CRÍTICO** — Fondear escrow / liberar pago sin confirmación ni monto visible. `apps/web/app/(app)/client/jobs/[jobId]/page.tsx` — handleFundEscrow:288-301 · handleRelease:333-350 · botones:728-745,923-930. [ ] Pendiente
- **1.2 CRÍTICO** — Mismo patrón en `apps/web/app/jobs/[jobId]/escrow/page.tsx:75-94` y `packages/ui/src/components/EscrowTimeline.tsx:256-264` — el modal seguro (`EscrowFundModal`) ya existe pero solo está cableado en `client/payments`. [ ] Pendiente
- **1.3 CRÍTICO** — "Resolver disputa" del cliente fijo a `pro_favor`, sin opción ni confirmación. `apps/web/app/jobs/[jobId]/page.tsx:276-293`. [ ] Pendiente

### Navegación y datos desconectados (confirmado en vivo)
- **1.4 CRÍTICO — patrón sistémico** — Dashboard, Trabajos→Activos, Mis hitos, Proyectos/Copiloto IA y Pagos muestran "0" a la vez mientras la cuenta tiene jobs reales `Aceptado`/`ACCEPTED`. Root cause probable: el `Project.upsert()` en la aceptación de bid no se está enlazando bien (ver 0.22-adjacent, revisar junto con la race condition de aceptación de bids). [ ] Pendiente — **requiere investigación de causa raíz antes de fix**
- **1.5 ALTO** — El rol "Cliente" mezcla dos personas (dueño que contrata vs. contratista con CRM propio) — `/client/leads`, `/client/bids` (copy de "aplica a trabajos"), `/client/marketplace` (cliente ve su propio job con botón "Aplicar"). [ ] Pendiente — **decisión de producto, no solo código**
- **1.6 ALTO** — `/dashboard` (ruta huérfana) carga con todo en cero y expone un banner de migración interna ("Mission Control") a cualquier cliente. [ ] Pendiente
- **1.7 MEDIO** — `/field-ops` (tercera implementación huérfana) carga sin nav, callejón sin salida. [ ] Pendiente
- **1.8 MEDIO** — Error de hidratación de React (`#418`) en `/client/milestones`, zona vacía sin estado vacío real. [ ] Pendiente

### Interacción / usabilidad (confirmado en vivo)
- **1.9 MEDIO** — Tema claro/oscuro no sobrevive un refresh/URL directa (solo persiste en navegación SPA). [ ] Pendiente
- **1.10 MEDIO** — FAB de asistente tapa el monto de una propuesta en mobile (~390-500px) en `/client/jobs/[jobId]`. [ ] Pendiente
- **1.11 MEDIO** — Catálogo de 24 agentes en `/agents`: la mayoría de las tarjetas no hacen nada al clic (sin `aria-label`); el FAB que sí abre chat ignora cuál tarjeta se clickeó y siempre abre Prometeo; solo 6 de 24 agentes son alcanzables. [ ] Pendiente
- **1.11b CRÍTICO** — El chat de Prometeo (real, vía Anthropic) confirma el bug de "cero" por una tercera vía: preguntado directo, responde "Tienes 0 trabajos activos" para una cuenta con jobs `Aceptado`/`ACCEPTED` reales. Además, sin que se le pida, menciona un **"nivel de confianza del sistema: 26/100, nivel crítico"** ligado a "1 hito activo" — una métrica que no aparece en NINGUNA otra pantalla del producto (ni Dashboard, ni Hitos). Hay que averiguar de dónde saca Prometeo ese número y por qué no se muestra en la UI normal. [ ] Pendiente — **investigar de dónde viene el "nivel de confianza" antes de decidir el fix**
- **1.11c ALTO** — El segundo widget flotante "Abrir Prometeo Copilot" (distinto del chat principal de Prometeo, que sí funciona) está roto: su botón de acción rápida "Preguntar a Prometeo" es un stub que solo responde `Acción "Preguntar a Prometeo" ejecutada.` sin hacer nada real; escribir una pregunta real en su chat devuelve el error crudo del backend `Authentication required for SEMSE API route`, mostrado tal cual al usuario. [ ] Pendiente
- **1.12 MEDIO** — Breadcrumb duplicado "Dashboard > Dashboard" en `/client/professionals`. [ ] Pendiente
- **1.13 MEDIO** — Nombre interno del algoritmo ("matching Jaccard + trust") expuesto en UI de cliente. [ ] Pendiente
- **1.14 MEDIO** — Wizard de "Publicar trabajo" pierde el 100% del progreso al refrescar, sin guardado de borrador (`client/jobs/new`). [ ] Pendiente

### Sistema de diseño / consistencia (código)
- **1.15 ALTO** — Dos librerías de componentes paralelas sin solaparse (`@semse/ui` vs `apps/web/components/ui/`), 22 archivos reinventan su propio spinner. [ ] Pendiente
- **1.16 MEDIO** — 3,306 colores hardcodeados que duplican tokens ya existentes (`#10b981`×290, `#3b82f6`×190, `#ef4444`×232). [ ] Pendiente
- **1.17 MEDIO** — Shell de navegación duplicado: `AppShell` (desktop, Tailwind) vs `Sidebar` (mobile, estilos inline) para el mismo dato de nav. `apps/web/app/(app)/layout.tsx`:145-304. [ ] Pendiente
- **1.18 MEDIO** — 24 `<div onClick>` sin `role`/`tabIndex`; solo 22 archivos usan `aria-label` en toda la app. [ ] Pendiente
- **1.19 MEDIO** — Dos sistemas de notificación: `NotificationBanner` (46 archivos) vs toasts a mano en `client/finance/page.tsx:199-210`. [ ] Pendiente
- **1.20 BAJO** — `BookingCard`/`AgentBubble` exportados desde `packages/ui`, cero referencias en `apps/web` — código muerto. [ ] Pendiente

### Marca / identidad (confirmado en vivo)
- **1.21 ALTO** — Landing dice "SEMSE Project" (tema claro), app autenticada dice "SEMSE OS" (tema oscuro) — dos identidades de marca, logos distintos. [ ] Pendiente — **decisión de producto**

---

## Sección 2 — Módulo Worker (pendiente de auditoría dedicada)

Lo que ya sabemos, encontrado al revisar Labor Engine/tracker como parte de la ronda de backend (no es una auditoría completa del módulo worker todavía — falta repetir el proceso de 5 agentes + navegación en vivo que se hizo para Cliente, en cuanto haya credenciales de worker):

- **2.1 CRÍTICO** — Dos trackers de tiempo desconectados bajo el mismo menú Worker: `/worker/tracker` (real, Labor Engine) vs `/worker/field-ops` (legacy `FieldOpsService`/`TrackerSession`, sigue funcional). `apps/web/app/(app)/worker/field-ops/page.tsx:895-1120`. [ ] Pendiente
- **2.2 ALTO** — `fetchActiveTimer()` sin `.catch()` en el `Promise.all` de carga — un solo request inestable tumba todo el tracker. `apps/web/app/(app)/worker/tracker/page.tsx` — loadTracker:341-347. [ ] Pendiente
- **2.3 ALTO** — Registros/Resumen/Reportes no leen `trackerLocalStore` — totales se subcuentan en silencio mientras el trabajador está offline. [ ] Pendiente
- **2.4 MEDIO** — Timer tab no es responsive como sus hermanas (grid fijo vs. `auto-fit/minmax`). `page.tsx:1269,1276,1336`. [ ] Pendiente
- **2.5 MEDIO** — Dos formularios de "Entrada manual" con offline-fallback distinto (uno lo tiene, el otro no). [ ] Pendiente
- **2.6 MEDIO** — Visual language split: `/worker/tracker` claro/CSS-var vs. `/worker/field-ops` oscuro/Tailwind — dos productos distintos bajo un nav. [ ] Pendiente
- **2.7 MEDIO** — `apps/web/app/field-ops/page.tsx` (top-level, huérfano) ~90% idéntico a `/worker/field-ops`, sin back-link, error handling divergente. [ ] Pendiente
- Ver también **0.19, 0.20, 0.24** (nómina/idempotencia — comparten causa raíz con el módulo worker).

**Pendiente antes de poder cerrar este módulo:**
- [ ] Conseguir credencial de worker (o registrar una cuenta de prueba) para repetir la navegación en vivo completa.
- [ ] Lanzar la misma ronda de agentes (bugs de código + inconsistencias) enfocada exclusivamente en `apps/web/app/(app)/worker/**` y `apps/web/app/(public)/worker/**`.
- [ ] Verificar en vivo el bug de duplicación de horas (2.1/0.20) con una sesión real, forzando un corte de red a medio sync.

---

## Sección 3 — Módulo Admin (pendiente de auditoría dedicada)

Lo que ya sabemos, encontrado en la ronda inicial de UX (solo análisis de código — nunca se vio funcionando, falta acceso admin):

- **3.1 ALTO** — `/admin/labor-engine` (pantalla insignia) invisible en el menú de Admin — ni en `navigation-registry.ts` ni en `ADMIN_MODULES`. Solo alcanzable vía tarjeta enterrada en `/admin/workops`. [ ] Pendiente
- **3.2 ALTO** — Resolución de disputas en Admin: un clic, sin confirmación, notifica de inmediato. `apps/web/app/(app)/admin/disputes/page.tsx` — RESOLVE_OPTIONS:658-673 · handleApprovalDecide:351. [ ] Pendiente
- **3.3 ALTO** — Falla parcial de carga en labor-engine deja el KPI de costo estimado silenciosamente incompleto. `admin/labor-engine/page.tsx:139-157`. [ ] Pendiente
- **3.4 MEDIO** — Alertas de QualityGuard son de solo lectura — sin botón para actuar desde la misma pantalla. `admin/labor-engine/page.tsx:246-267`. [ ] Pendiente
- **3.5 MEDIO** — IDs crudos (UUID) en vez de nombres; ninguna lista de Admin revisada tiene paginación. [ ] Pendiente
- **3.6 MEDIO** — Solo 4 de ~55 páginas de Admin usan `ModuleShell` — el resto arma su propio header a mano. [ ] Pendiente

**Pendiente antes de poder cerrar este módulo:**
- [ ] Conseguir credencial de OPS_ADMIN para repetir la navegación en vivo completa.
- [ ] Lanzar la misma ronda de agentes enfocada en `apps/web/app/(app)/admin/**` (58 páginas — probablemente necesite más de una ronda, dividir por sub-área: WorkOps, Trust/Finance, Intelligence/AI, Tool Hub, Verticals).
- [ ] Verificar en vivo el bug de "cero en 5 pantallas" (1.4) desde el lado admin — ¿el admin ve los mismos trabajos en cero, o solo el cliente?

---

## Cosas ya confirmadas que funcionan bien (no perder tiempo re-revisando)

- RBAC guard deny-by-default — sólido, todos los endpoints mutantes revisados tienen guardia.
- Rate limiting en auth — bien aplicado (throttler global + límites específicos por endpoint).
- Enumeración de credenciales — mensajes de error genéricos, confirmado en vivo.
- Password reset — no filtra si un email existe.
- Contratos (`sign()`) — valida identidad correcta por slot de firma, idempotente.
- Reservas `create()` — race-safe vía índice único parcial en Postgres.
- Outbox v2 (ruta de evidencia) — transaccional, `FOR UPDATE SKIP LOCKED`, idempotente.
- Notificaciones — bien desacopladas, un fallo de envío no corrompe la transacción de negocio.
- SQL crudo y secretos hardcodeados — sweep completo del repo, limpio.
- XSS / `dangerouslySetInnerHTML` con contenido de usuario — no encontrado.
- Token de sesión — nunca toca `localStorage`, cookie `HttpOnly` firmada.
- Redirect `?from=` tras login — validado en cliente y servidor.
- Vinculación de cuentas Stripe Connect — no hay path de secuestro vía callback.
- Path traversal en storage — bloqueado correctamente.
- Vision-service — timeout/retry del lado cliente bien manejado (aunque el servicio en sí no tiene auth, ver 0.10).
- Fórmulas de materiales (pintura, drywall, piso, mulch) — estándar de construcción real, redondeo correcto (excepto madera, ver 0.30).
- Worker: tenant-scoping en los handlers de jobs — limpio.
- SSE: los 4 canales que no son `planStream`/`delegationsStream` sí derivan el tenant correctamente.
- `/admin/product-intelligence` — correctamente gateado (OPS_ADMIN + kill switch).
- autonomy-server — herramienta interna pura, sin superficie de ataque real.

---

## Notas de contexto (por si se pierde el hilo entre sesiones)

- La sesión de auditoría se hizo con una cuenta de prueba en el rol **Cliente**, contra `https://semse-web-production.up.railway.app` (producción real). No se disparó ningún botón que mueva dinero real ni resuelva disputas reales — esos hallazgos están confirmados solo por lectura de código.
- El proyecto Railway es **SEMSEproject** (id `95ad1b14-d1d9-467d-82d8-5354619ba873`), ambiente `production`, servicio API es **semse-API** (id `2bd1bd3f-9aa1-4fc3-a714-4cf90c52c770`).
- Paralelamente a esta auditoría, en la misma sesión se completó y mergeó a `main` el trabajo de **F2 — Prometeo Tool Registry gobernado** (gate híbrido de pagos), que no tiene relación con estos hallazgos.
