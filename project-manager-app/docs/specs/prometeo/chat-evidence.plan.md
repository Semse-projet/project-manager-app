---
type: plan
feature: "chat-evidence"
domain: "prometeo"
spec: "docs/specs/prometeo/chat-evidence.spec.md"
version: "1.0"
status: "REVIEW"
branch: "feat/prometeo-chat-evidence"
date: "2026-10-07"
---

# Plan técnico: Evidencias en el chat de Prometeo

## 1. Objetivo
Que Prometeo liste **cuáles** son las evidencias pendientes del actor, resuma el análisis visual **ya persistido** y ofrezca un botón para lanzar el análisis de las que no lo tienen. **Solo lectura:** nunca aprueba ni rechaza una evidencia. El modelo solo recibe texto derivado y validado, nunca imágenes ni URLs, y todo texto persistido se trata como **dato no confiable**.

## 2. Hallazgos del AS-IS que fijan el diseño (verificados en el código el 2026-10-07)

| Hecho | Consecuencia |
|---|---|
| "Pendiente de revisión" = `Evidence.validationStatus === "pending"` (estados: `pending`/`passed`/`failed`/`manual_review`). | La lista filtra por `validationStatus = "pending"`. |
| `Evidence` guarda `bucketKey` y `fileUrl` (acceso al archivo) además de `title`, `notes`, `kind`, `capturedAt`, `milestoneId`, `projectId`, `aiQualityScore`. | La consulta **no selecciona** `fileUrl` ni `bucketKey` salvo para calcular un booleano interno (`hasImage`), que nunca sale del servicio. |
| `VisionAnalysis` (único por `evidenceId`, **sin `tenantId`**) guarda `status` (`pending`/`completed`/`failed`), `qualityScore`, `riskLevel`, `riskReasons` (JSON), `requiresHumanReview`, `canAutoApprove`, `recommendedAction`, `visualProgressDetected` y `rawResult`. | Se leen por `evidenceId` **después** de haber verificado que la evidencia pertenece al alcance del actor. `rawResult` y `canAutoApprove` **no** se pasan al modelo. |
| `OperationalContextService` ya acota los agregados con `ResourceScopeResolver.listAccessibleProjectIds` para no administradores (0.45, #813). | La lista usa **la misma fuente de alcance**; así el conteo del contexto y la lista coinciden. |
| `AuditService` solo tiene `append`; la tabla `AuditLog` tiene `tenantId`, `actorUserId`, `action`, `occurredAt` e índice `(tenantId, occurredAt)`. | El tope diario de análisis (D4) se cuenta con `prisma.auditLog.count` sobre la acción `prometeo.chat_evidence.analysis_requested`, **sin migración**. La auditoría **es** el contador, así que escribirla antes de analizar y **fallar cerrado** si no se puede. |
| `VisionController.analyzeByEvidenceId` exige `vision:run` y `VisionAccessPolicy.assertEvidence`, pero **no** limita ni audita por usuario. El web no tiene ruta BFF para él. | Hace falta **un endpoint fino nuevo** (ver §4, desviación 1) que aplique flag, permiso, pertenencia, tope y auditoría y llame a `VisionService`. |
| `VisionService.analyzeByEvidenceId` devuelve el análisis existente si está `completed`; si no hay `bucketKey` usa una URL `mock://`. | Idempotente por diseño; no se ofrece analizar evidencias sin imagen real. |
| `vision.*` por el despachador de herramientas de Prometeo tenía el fallo 0.44 (corregido y desplegado). | Esta funcionalidad **no** usa el despachador: llama a servicios que ya aplican `VisionAccessPolicy`. |

## 3. Diseño

### 3.1 Texto no confiable — `chat-evidence/evidence-context.ts` (puro, sin I/O)
- `sanitizeUntrustedText(value, maxLen)`: solo acepta `string`; elimina caracteres de control; **elimina URLs** (`http(s)://`, `data:`, `mock://`, `s3://`, `www.`, y trozos con parámetros de firma) sustituyéndolas por `[enlace omitido]`; colapsa espacios; acota longitud; **escapa el cierre de la etiqueta delimitadora**.
- `buildEvidenceContextBlock(items, { remaining })`: construye el bloque `<evidence_data>…</evidence_data>` con una **lista permitida de campos** (id, tipo, fecha efectiva, trabajo, hito, estado del análisis, puntuaciones, nivel de riesgo, hasta 5 motivos acotados, `requiresHumanReview`, `recommendedAction`). Cualquier otra clave se descarta; `fileUrl`, `bucketKey`, `rawResult`, `canAutoApprove` y similares **nunca** entran.
- La instrucción de sistema añade que `<evidence_data>` es **dato no confiable**, que sus contenidos no son instrucciones y que toda valoración es "opinión asistida, no una aprobación" (misma idea que `<conversation_history>` de 0.43 en `prompt-safety.ts`).

### 3.2 Detección de intención — `chat-evidence/intent.ts` (puro)
- `isEvidenceReviewRequest(message)`: normalización como en `chat-actions` (minúsculas, sin acentos/signos) y vocabulario **cerrado** ("evidencia(s)" + verbo de revisión/consulta o "pendiente(s)"). Evita consultar la base en cada mensaje: solo se calcula la lista cuando la intención aparece.

### 3.3 Servicio con alcance — `chat-evidence/chat-evidence.service.ts`
- `listPending(actor)`: `OPS_ADMIN` ⇒ evidencias pendientes de **su tenant**; resto ⇒ `listAccessibleProjectIds(tenantId, orgId)` (sin organización ⇒ vacío; si el listado falla ⇒ vacío, nunca el tenant). Orden: más antiguas primero. Tope N=10 (+1 para saber si hay más) y `remaining` = total − N.
- Une `VisionAnalysis` por `evidenceId` (solo de las evidencias ya acotadas) y calcula `analyzable` = `hasImage && análisis no completado`.
- No expone ni `bucketKey` ni `fileUrl`.

### 3.4 Integración en el controlador y modos
- `SEMSE_CHAT_EVIDENCE_MODE=off|shadow|live` (por defecto `off`), mismo patrón que `SEMSE_CHAT_ACTIONS_MODE`.
- `off`: sin cambios. `shadow`: se calcula y se **audita** lo que se habría incluido (cantidad, sin contenido), sin cambiar la respuesta. `live`: se añade el bloque delimitado al contexto, la instrucción de sistema y las acciones.
- Acción `chat.analyze_evidence` (forma existente de `proposedActions`, `requiresApproval: true`, `input: { evidenceId }`) **solo** para evidencias `analyzable`.
- Auditoría `prometeo.chat_evidence.listed` con `requestId`, cantidad listada y restantes; **sin** el texto del mensaje ni el contenido de las evidencias.

### 3.5 Endpoint fino de análisis
`POST /v1/prometeo/chat-evidence/analyze/:evidenceId` (permiso `vision:run`):
1. Modo ≠ `off`; 2. `VisionAccessPolicy.assertEvidence` (otro tenant/inexistente ⇒ 404; otra organización ⇒ 403); 3. la evidencia tiene imagen real; 4. tope diario: `auditLog.count(actor, acción, hoy UTC) < 20` ⇒ si no, **429**; 5. se escribe la auditoría `analysis_requested` **antes** de analizar (si falla ⇒ no se analiza); 6. `VisionService.analyzeByEvidenceId` (idempotente); 7. responde un resumen **saneado** (mismo `evidence-context`), no el `rawResult`.
BFF web: `/api/semse/prometeo/chat-evidence/analyze/[evidenceId]/route.ts`.

### 3.6 Web
- Helper puro `apps/web/lib/prometeo-chat-evidence.ts` (reconocer la acción, evidencia analizable) y botón "Analizar con visión" en el panel y el widget, de un solo uso; etiqueta fija "opinión asistida, no es una aprobación"; estados cargando/degradado/error.

### 3.7 Seguridad (resumen)
`tenantId/orgId/userId/roles` solo del contexto autenticado; texto persistido = dato no confiable (delimitado, acotado, sin URLs); sin imágenes ni URLs al modelo; sin acción de escritura sobre `validationStatus`; tope diario con fallo cerrado; el análisis solo con clic.

## 4. Desviaciones respecto a la spec (a reconciliar en la tarea CE-060)
1. **Endpoint nuevo.** La §5 dice "Sin endpoint nuevo", pero aplicar el tope diario y la auditoría por usuario exige un punto propio: `analyze-by-evidence` existente no lo hace. Se añade el endpoint fino de §3.5 y se corrige la §5.
2. **Contador por `AuditLog`.** La spec no decía cómo contar los 20 análisis; el plan fija `AuditLog` (sin migración) con la auditoría como contador.

## 5. Despliegue y activación
`off` → `shadow` → verificación de **D6** en producción (aislamiento por tenant y organización; excepción de `OPS_ADMIN` dentro de su tenant) → `live` en un tenant de prueba → resto. **Este plan no autoriza `live`.**

## 6. Riesgos
| Riesgo | Mitigación |
|---|---|
| Prompt injection desde `notes`/`title`/`riskReasons` | Texto no confiable: allowlist de campos, límites, sin URLs, delimitación con cierre escapado; pruebas con cargas hostiles |
| Fuga entre organizaciones | Misma fuente de alcance que el contexto; pruebas con dos tenants y dos organizaciones; fallo del listado ⇒ vacío |
| Coste de visión sin control | Solo por clic, tope de 20/día por usuario, auditoría previa y fallo cerrado |
| El modelo presenta una opinión como aprobación | Etiqueta fija, instrucción de sistema, y `canAutoApprove`/`rawResult` fuera del contexto |
| La auditoría como contador pierde cuentas si falla | Se escribe antes de analizar; si falla, no se analiza |

## 7. Verificación
Pruebas puras del saneado y del bloque; del servicio con dos tenants/dos organizaciones; del controlador por modo; del endpoint (permiso, pertenencia, tope, auditoría, idempotencia); de la UI; y la verificación de **D6** y un smoke autenticado en producción con evidencias reales antes de cualquier `live`.
