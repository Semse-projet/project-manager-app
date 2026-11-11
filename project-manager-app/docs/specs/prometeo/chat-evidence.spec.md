---
id: "prometeo.chat-evidence"
title: "Evidencias en el chat de Prometeo (revisión asistida de solo lectura)"
domain: "prometeo"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "IN_PROGRESS"
ci_status: "PASS"
merge_status: "MERGED"
deploy_status: "DEPLOYED"
activation_status: "ACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: ["SEMSE_CHAT_EVIDENCE_MODE"]
production_evidence: ["2026-10-10 PR #819 mergeado (2026-10-07T16:40:29Z, merge commit 1c761a53); es ancestro del commit desplegado en semse-API.","2026-10-10 GET https://api.semseproject.com/v1/health ⇒ gitSha 7feda31c3107176efe8a430b7892e537f7bfdb13, deploymentId 9878f405-e2f2-4a45-8882-ad5ed754e7ae, environment production.","2026-10-10 POST /v1/prometeo/chat-evidence/analyze/test sin sesión ⇒ 401 (el endpoint existe y exige autenticación).","2026-10-10 Lectura (solo lectura) de variables de semse-API: SEMSE_CHAT_EVIDENCE_MODE=live. NO fue puesta por el agente en esa fecha ni hay evidencia de quién/cuándo; D6 (CE-050) y el canary (CE-052) NO estaban verificados cuando se activó.","2026-10-10 Sin líneas con chat_evidence/chat-evidence en las últimas 400 líneas de logs de semse-API: no hay evidencia de uso real todavía."]
related_files: ["apps/api/src/modules/vision/vision-access.policy.ts","apps/api/src/modules/vision/vision.controller.ts","apps/api/src/modules/vision/vision.service.ts","apps/api/src/modules/evidence/evidence.controller.ts","apps/api/src/modules/ai-models/ai-models.controller.ts","apps/api/src/modules/ai-models/context/operational-context.service.ts","apps/api/src/modules/prometeo/prometeo-tool-registry.ts","apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts","apps/api/src/modules/ai-models/chat-evidence/evidence-context.ts","apps/api/src/modules/ai-models/chat-evidence/intent.ts","apps/api/src/modules/ai-models/chat-evidence/chat-evidence.service.ts","apps/api/src/modules/ai-models/chat-evidence/chat-evidence-chat.service.ts","apps/api/src/modules/vision/chat-evidence-analysis.service.ts","apps/api/src/modules/vision/chat-evidence-analysis.controller.ts","apps/web/lib/prometeo-chat-evidence.ts","apps/web/app/api/semse/prometeo/chat-evidence/analyze/[evidenceId]/route.ts"]
related_tests: ["apps/api/test/chat-evidence-context.test.ts","apps/api/test/chat-evidence-service.test.ts","apps/api/test/chat-evidence-chat.test.ts","apps/api/test/chat-evidence-analysis.test.ts","tests/unit/prometeo-chat-evidence-ui.test.ts"]
related_endpoints: ["POST /v1/ai-models/prometeo/chat","GET /v1/vision/evidence/:evidenceId","POST /v1/vision/analyze-by-evidence/:evidenceId","GET /v1/projects/:projectId/evidence","POST /v1/prometeo/chat-evidence/analyze/:evidenceId"]
related_events: []
related_agents: ["prometeo"]
last_verified: "2026-10-10"
---

# Spec: Evidencias en el chat de Prometeo

> Contrato ejecutable SDD 2.0. **Estado `APPROVED` (2026-10-07): el dueño aprobó la spec y resolvió D1–D6 (§6). Esto autoriza plan, tareas y tests, y NO autoriza `live`: eso exige los gates de seguridad, CI y verificación en producción de §12.**
> Código, CI, merge, deploy y activación se registran por separado.

## 1. Problema y resultado

**Para quién:** quien revisa evidencias de obra (cliente, OPS_ADMIN) y el profesional que las sube y quiere saber en qué estado están.

**Problema (evidencia real, 2026-10-06):** el panel muestra "6 evidencias pendientes de revisión" y Prometeo, al preguntarle, responde que "sabe que hay 6 pero no puede verlas". El chat solo recibe un **conteo** (`OperationalContextService`: `validationStatus === "pending"`); no ve cuáles son, de qué trabajo o hito, ni qué dijo el análisis visual que ya se persistió. Revisar sigue siendo abrir una por una.

**Resultado esperado:** al pedir "revisa las evidencias pendientes", Prometeo lista **cuáles** son (con su trabajo/hito y estado), resume lo que el análisis visual ya persistido dice de cada una (calidad, riesgo, acción recomendada) y, para las que **no** tienen análisis, ofrece un botón para lanzarlo. Todo de **solo lectura**: el chat nunca aprueba ni rechaza una evidencia.

## 2. Alcance

### Incluido (V1)

- Listar, en el chat, las evidencias **pendientes** del alcance del actor (máx. N por respuesta), con identificador, tipo, trabajo/hito y fecha.
- Resumir el análisis visual **ya persistido** (`VisionAnalysis`: `qualityScore`, `riskLevel`, `riskReasons`, `requiresHumanReview`, `recommendedAction`, `visualProgressDetected`) para cada evidencia que lo tenga.
- Para evidencias sin análisis: acción propuesta "Analizar con visión" (botón; confirmación por clic) que usa `POST /v1/vision/analyze-by-evidence/:evidenceId` (el servidor resuelve la imagen; el cliente no pasa URLs).
- Respuesta del modelo **solo con texto** (métricas y metadatos), citando los ids de evidencia.
- Modo de despliegue `off → shadow → live` (`SEMSE_CHAT_EVIDENCE_MODE`).

### Fuera de alcance

- **Aprobar, rechazar o cambiar el `validationStatus` de una evidencia** desde el chat. Nunca en la V1.
- **Enviar imágenes, bytes o URLs firmadas a un proveedor de LLM.** Analizar la foto con un modelo multimodal externo (la propuesta de Prometeo) queda fuera: es una decisión de privacidad aparte.
- Guardar el dictamen como comentario de la evidencia.
- Video y audio (`vision.analyze_video` está marcada `adapterPending`).
- Evidencias de agro (`AgroEvidenceItem`) y de contexto de granja.
- Un endpoint genérico `/ai/evidence/analyze` o tablas nuevas (`evidence_reviews`): se reutiliza lo existente. **Excepción reconciliada (CE-060, decisión del dueño 2026-10-07):** un único endpoint fino específico para lanzar el análisis desde el chat (§5), sin migración (el contador es la tabla `AuditLog` existente).

## 3. Actores, permisos y límites

| Actor | Permisos backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| Cliente, profesional asignado | `evidence:read`, `vision:read` (+ `vision:run` para analizar) | evidencias de proyectos en los que participa (org cliente o profesional asignada) | ver su lista y los análisis persistidos; lanzar un análisis | ver evidencias de otra organización; aprobar |
| OPS_ADMIN | los mismos | todos los proyectos **de su tenant** | igual | cruzar de tenant; aprobar desde el chat |

- **Tenant boundary:** `tenantId/orgId/userId/roles` salen del contexto autenticado, nunca del texto ni del modelo. Otro tenant o inexistente ⇒ 404; otra organización ⇒ 403 (mismo contrato que `VisionAccessPolicy` y `resource-scope`).
- **Aprobación humana:** el análisis solo se lanza con un clic; **aprobar** una evidencia sigue siendo su flujo existente, fuera del chat.
- **Datos `privacyCritical`:** el modelo recibe únicamente texto derivado, estructurado y validado (tipo de evidencia, fecha efectiva, trabajo/hito, puntuaciones, nivel y motivos de riesgo y los metadatos expresamente permitidos), **nunca** imágenes, bytes, URLs ni URLs firmadas.
- **Texto no confiable (prompt injection):** todo texto persistido que proceda de evidencias, análisis o metadatos (títulos, notas, motivos de riesgo, `rawResult`) se trata como **dato no confiable**: se limita a una lista de campos permitida, se acota su longitud, se eliminan caracteres de control y URLs, y se entrega dentro de un bloque delimitado que el modelo debe tratar como datos, con el cierre de etiqueta escapado. Nada de ese texto puede cambiar la lista, las acciones propuestas ni las reglas del sistema.
- **Auditoría:** cada listado y cada análisis lanzado desde el chat deja registro con `correlationId` (el `requestId`), tipo y cantidad, **sin** el contenido de las evidencias ni el texto del mensaje.

### Precondiciones (verificadas en el código el 2026-10-06)

1. **Aislamiento de las herramientas de visión (hallazgo 0.44, PR #811).** El camino de herramientas de Prometeo no comprobaba la pertenencia de `vision.get_analysis` y similares; `VisionAnalysis` no guarda `tenantId`. **Esta spec no puede pasar a `live` hasta que #811 esté desplegada**, y esta funcionalidad **no usa** el despachador de herramientas para leer análisis: llama a servicios que ya aplican `VisionAccessPolicy`.
2. **Alcance del conteo de "pendientes" (corregido, 0.45 / PR #813, ya desplegado).** Esta spec se redactó el 2026-10-06 cuando `OperationalContextService`, sin proyecto activo, calculaba evidencias, hitos, disputas y pagos con todos los proyectos del tenant. **Ya no es así:** para actores no administradores usa `ResourceScopeResolver.listAccessibleProjectIds(...)` y aplica ese alcance a esos cuatro bloques; solo `OPS_ADMIN` ve todo **su** tenant, y si el listado falla las cifras quedan vacías (nunca vuelve al tenant completo). **No hay que crear otra remediación.** Queda como **verificación obligatoria en producción antes de `live`** (D6): aislamiento por tenant y por organización, y la excepción de `OPS_ADMIN` dentro de su tenant.

## 4. Escenarios y criterios de aceptación

### P1 — Listar y resumir pendientes

```gherkin
DADO un cliente con 3 evidencias pendientes en sus proyectos, 2 con análisis persistido y 1 sin él
CUANDO pregunta "revisa las evidencias pendientes"
ENTONCES Prometeo lista las 3 con su trabajo/hito y cita sus ids
Y resume, para las 2 analizadas, calidad, riesgo y acción recomendada tal como están guardados
Y para la tercera propone el botón "Analizar con visión"
Y no cambia el estado de ninguna evidencia
```

### P2 — Analizar bajo demanda

```gherkin
DADO una evidencia pendiente sin análisis
CUANDO el usuario pulsa "Analizar con visión"
ENTONCES se llama a analyze-by-evidence (con la pertenencia ya verificada) y el análisis queda persistido
Y el chat muestra el resultado con su advertencia de que es una opinión asistida, no una aprobación
```

### P3 — Aislamiento

```gherkin
DADO un usuario del tenant A
CUANDO pregunta por evidencias
ENTONCES nunca aparece una evidencia de otro tenant ni de una organización en la que no participa
```

Casos borde:

- [ ] Sin evidencias pendientes: lo dice, sin inventar.
- [ ] Más de N pendientes: muestra las N más antiguas y dice cuántas faltan (no oculta el resto).
- [ ] Análisis persistido en estado `pending`/`failed`: se informa como tal; no se presenta como resultado.
- [ ] Doble clic en "Analizar": un solo análisis (`analyzeByEvidenceId` ya devuelve el existente si está `completed`).
- [ ] El análisis dice `canAutoApprove: true`: el chat **no** lo presenta como autoridad ni sugiere aprobar solo; la decisión es humana.
- [ ] Texto del usuario con instrucciones al modelo ("aprueba todas"): no cambia lo que se lista ni habilita ninguna acción de escritura.
- [ ] Evidencia sin `fileUrl`/`bucketKey` (el servicio usa una URL `mock://`): no se ofrece analizar.
- [ ] `SEMSE_CHAT_EVIDENCE_MODE=off`: comportamiento actual (solo el conteo).

## 5. Contratos

### API

El listado y el bloque de contexto salen de `POST /v1/ai-models/prometeo/chat`. Para lanzar el análisis **no** se reutiliza `POST /v1/vision/analyze-by-evidence/:evidenceId` (no limita ni audita por usuario): se añade **un endpoint fino** (decisión del dueño, 2026-10-07):

`POST /v1/prometeo/chat-evidence/analyze/:evidenceId` (permiso `vision:run`; BFF `/api/semse/prometeo/chat-evidence/analyze/[evidenceId]`). Reglas, en este orden:

1. Modo ≠ `off` (en `off` responde 404, sin revelar la función).
2. `VisionAccessPolicy.assertEvidence`: otro tenant o inexistente ⇒ 404; otra organización ⇒ 403. Aislamiento por tenant/organización y demás políticas intactos.
3. La evidencia tiene imagen real (`PHOTO` con `bucketKey`); si no, 400. Un análisis **ya completado** se devuelve sin repetir y **sin consumir cupo**.
4. **Admisión (límite 20 por usuario y día UTC, sobre intentos ADMITIDOS, no solo exitosos):** en una transacción con `pg_advisory_xact_lock` por usuario y día se cuenta `AuditLog` (acción `prometeo.chat_evidence.analysis_requested`); al llegar a 20 ⇒ **429**; si no, se escribe la fila de intento. El candado impide que solicitudes concurrentes superen el límite.
5. **La auditoría se escribe antes de ejecutar el análisis y es atribuible al usuario** (`actorUserId`, `requestId`, `chatRequestId` = correlación con el mensaje del chat, `origin: "chat"`). **Fallo cerrado:** si el intento no se puede persistir ⇒ **503** y no se ejecuta el análisis.
6. Se ejecuta `VisionService.analyzeByEvidenceId` y se registra el resultado en una fila enlazada al intento por `attemptId`: `prometeo.chat_evidence.analysis_succeeded` o `analysis_failed` (`SUCCEEDED`/`FAILED`).
7. La respuesta es un resumen **saneado** (sin `rawResult`, `canAutoApprove` ni enlaces) con la etiqueta «Opinión asistida, no es una aprobación».

Sin migración. Esto **no autoriza `live`**.

```yaml
auth: required
permissions: [agents:run:create, evidence:read, vision:read]   # vision:run para analizar
output_schema:
  # bloque de contexto para el modelo (no se devuelve tal cual al cliente)
  pendingEvidence:
    - id: string
      kind: string
      projectId: string
      jobId: string?
      milestoneId: string?
      capturedAt: string?
      validationStatus: "pending"
      analysis: { status, qualityScore?, riskLevel?, riskReasons?, requiresHumanReview?, recommendedAction?, visualProgressDetected? } | null
  # acción de chat (forma existente de proposedActions, ver prometeo.chat-actions)
  proposedActions:
    - namespace: "chat"
      tool: "analyze_evidence"
      requiresApproval: true       # confirmación por clic
      input: { evidenceId: string }
errors: {401: sin sesión, 403: otra organización o sin vision:run, 404: otro tenant, inexistente o función apagada, 400: sin imagen real, 429: límite diario, 503: auditoría no persistible (fallo cerrado)}
effects:
  audit_log: "prometeo.chat_evidence.listed | analysis_requested | analysis_succeeded | analysis_failed" con correlationId; sin contenido del mensaje ni de las evidencias
  domain_event: ninguno nuevo
  sse: no
  payment_governance: ninguna
```

### UI

```yaml
surfaces: [widget, panel-orquestador]
states: [loading, empty, ready, forbidden, degraded, error]
required_behavior:
  - cada evidencia citada muestra su id; el botón "Analizar con visión" no se puede pulsar dos veces
  - toda opinión del modelo lleva la etiqueta "opinión asistida, no es una aprobación"
  - el botón solo aparece para evidencias con imagen real y sin análisis completado
```

### Agente/Prometeo

```yaml
tools: []   # sin tool-calling abierto: el servidor arma el bloque de contexto con servicios que ya aplican pertenencia
input_schema: mensaje + historial + contexto de página
output_schema: texto + proposedActions (analyze_evidence)
source_citations_required: true   # ids de evidencia
approval_policy: clic del usuario para analizar; ninguna acción de escritura sobre la evidencia
forbidden_behavior:
  - aprobar, rechazar o cambiar el estado de una evidencia
  - enviar imágenes, bytes o URLs a un proveedor de LLM
  - listar evidencias fuera del alcance del actor
  - presentar un análisis pendiente o fallido como resultado
```

## 6. Decisiones (resueltas por el dueño el 2026-10-07)

| ID | Decisión | Resolución |
|---|---|---|
| D1 | ¿Qué recibe el modelo? | **Aprobada, con refuerzo:** solo texto derivado, estructurado y validado (tipo, fecha efectiva, trabajo/hito, puntuaciones, nivel y motivos de riesgo y metadatos expresamente permitidos). **Nunca** imágenes, bytes, URLs ni URLs firmadas. Todo texto persistido de evidencias, análisis o metadatos es **dato no confiable**: delimitado y validado contra prompt injection (§3). |
| D2 | ¿Cuándo se lanza un análisis? | **Aceptada tal como se proponía:** solo por **botón con clic** (cuesta cómputo y escribe `VisionAnalysis`), nunca automáticamente al listar. |
| D3 | ¿Se guarda el dictamen del modelo? | **Aceptada tal como se proponía:** no en la V1. Guardarlo como comentario de la evidencia requiere otra spec. |
| D4 | Topes | **Aceptada tal como se proponía:** 10 evidencias por respuesta; 20 análisis **admitidos** por usuario y día UTC (ajustable en `CHAT_EVIDENCE_DAILY_LIMIT`; incluye los que fallaron; concurrente-seguro). |
| D5 | ¿Quién ve qué? | **Aceptada tal como se proponía:** las reglas de `VisionAccessPolicy`: participantes del proyecto y OPS_ADMIN **del tenant**. |
| D6 | Precondición del conteo | **Aprobada con corrección:** no se crea otra remediación; la de #813 (0.45) ya existe. D6 pasa a ser la **verificación obligatoria en producción de esa corrección antes de `live`**, incluido el aislamiento por tenant y organización y la excepción de `OPS_ADMIN` dentro de su tenant. |

## 7. Datos y migración

- Modelos Prisma: ninguno nuevo. Migración: no aplica. Se lee `Evidence` y `VisionAnalysis`; se escribe solo `VisionAnalysis` (upsert existente) y solo tras el clic.
- Rollback: `SEMSE_CHAT_EVIDENCE_MODE=off`.

## 8. Observabilidad, despliegue y activación

- Métricas: listados, evidencias listadas por respuesta, análisis solicitados / completados / fallidos, denegaciones por pertenencia.
- Flags: `SEMSE_CHAT_EVIDENCE_MODE=off|shadow|live`. En `shadow` se calcula y audita lo que se habría listado, sin cambiar la respuesta.
- Canary: `shadow` → `live` en un tenant de prueba → resto.
- Evidencia de producción requerida: un listado real que coincida con las evidencias que el usuario ve en su pantalla; un usuario de otra organización no ve ninguna de ellas; un análisis lanzado con el botón queda persistido y el chat no cambia el estado de la evidencia.
- Señal de rollback: cualquier evidencia fuera de alcance en una respuesta, o un cambio de `validationStatus` originado en el chat.

## 9. Tests requeridos

- [ ] El bloque de contexto solo incluye evidencias del alcance del actor (dos tenants, dos organizaciones, OPS_ADMIN)
- [ ] Otro tenant/organización/inexistente ⇒ 404/403 y nada llega al modelo
- [ ] Resumen fiel de `VisionAnalysis` (incluidos `pending`/`failed` y `canAutoApprove: true`)
- [ ] El tope de N y el aviso de las restantes
- [ ] La acción `analyze_evidence` exige clic, es idempotente y no se ofrece sin imagen real
- [ ] Ningún camino del chat modifica `validationStatus`
- [ ] El modelo no recibe imágenes ni URLs (inspección del prompt)
- [ ] Inyección en el texto del usuario no cambia la lista ni habilita acciones
- [ ] Texto no confiable de evidencias/análisis (notas con instrucciones, etiqueta de cierre, URLs, caracteres de control, textos enormes) queda delimitado, acotado y sin URLs, y no altera el prompt, la lista ni las acciones
- [ ] Modo `off` idéntico al actual; `shadow` no cambia la respuesta
- [ ] UI widget y panel: carga, vacío, degradado, error y botón de un solo uso
- [ ] Smoke autenticado en producción con las evidencias reales del usuario

## 10. Mapa de implementación

### API
- `apps/api/src/modules/ai-models/ai-models.controller.ts` (bloque de contexto y acción)
- servicio nuevo en `apps/api/src/modules/ai-models/chat-evidence/` que reutiliza `VisionAccessPolicy`, `EvidenceService`/repositorio con el alcance del actor y `VisionService.getAnalysis`

### Web
- `apps/web/components/ai/agent-chat-panel.tsx`, `apps/web/app/components/prometeo/PrometeoCopilot.tsx` (botón y etiqueta)

### Tests
- `apps/api/test/chat-evidence-*.test.ts`

## 11. Investigación externa

- Pendiente de la fase de plan. El diseño reutiliza lo que el repo ya tiene (herramientas de visión persistidas, `VisionAccessPolicy`, `proposedActions`).

## 12. Gates de cierre

- [x] status APPROVED y D1–D6 decididas por el dueño antes de código (2026-10-07)
- [x] #811 (0.44) y #813 (0.45) desplegadas (verificado el 2026-10-07: el API sirve `512c9727`)
- [ ] D6: verificación en producción de la corrección del conteo (aislamiento por tenant y organización; excepción de `OPS_ADMIN`) **antes de `live`**
- [ ] spec indexado
- [ ] plan/tasks/checklist coherentes
- [ ] tests antes del código
- [ ] `spec:validate:strict` verde
- [ ] shadow sin divergencias materiales
- [ ] CI PASS
- [ ] merge SHA registrado
- [ ] deployment terminal
- [ ] canary autenticado con evidencias reales
- [ ] evidencia sin secretos
- [ ] sólo entonces VERIFIED

## 2026-10-18 — Proposed evidence-review RAG security extension (#974 / #987)

This is a **separate, not-yet-deployed** amendment to existing chat-evidence functionality. Evidence Review's agent receives private RAG context only when the reviewer is identified by a signed session, has ACTIVE org membership, and participates in the exact milestone project in its tenant with a live job; a validated OPS_ADMIN can use the tenant-limited privileged path. Missing scope produces rules-only/no-RAG fallback (never tenant-wide retrieval). Both model attempts require `localOnly`, and private document snippets/citations cannot silently reach cloud inference. Tests: `apps/api/test/evidence-review-rag-scope.test.ts`, `apps/api/test/prometeo-live-project-scope.test.ts` and signed-session API Integration smoke. Proposed ADR-046 and `prometeo.document-sharing-grants` REVIEW govern release; existing production `chat-evidence` evidence above is **not** evidence for this amendment.
