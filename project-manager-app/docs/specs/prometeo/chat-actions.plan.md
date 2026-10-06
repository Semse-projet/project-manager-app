---
type: plan
feature: "chat-actions"
domain: "prometeo"
spec: "docs/specs/prometeo/chat-actions.spec.md"
version: "1.0"
status: "REVIEW"
branch: "feat/prometeo-chat-actions"
date: "2026-10-06"
---

# Plan técnico: Prometeo actúa desde el chat

## 1. Objetivo
Que el chat proponga dos acciones, siempre con un paso humano explícito: **crear un trabajo** (vía el flujo de borrador que ya existe) y **navegar** a una pantalla del catálogo. Cero tool-calling libre del modelo.

## 2. Hallazgos del AS-IS que fijan el diseño

| Hecho verificado en el código | Consecuencia |
|---|---|
| El envelope de `POST /v1/ai-models/prometeo/chat` ya devuelve `proposedActions` (`buildProposedActions`, `ai-models.controller.ts`) con la forma de `prometeoProposedActionSchema`: `id`, `namespace`, `tool`, `label`, `description`, `riskLevel`, `approvalPolicy`, `requiresApproval`, `status`, `input`, `reason`. | **No se crea un tipo nuevo ni un campo `kind`.** Las acciones de chat usan `namespace: "chat"` y `tool: "create_job_draft" \| "navigate"`; el dato específico va en `input` (`{ draftId, summary }` / `{ route }`). Sin cambio de esquema y los clientes antiguos las ignoran. (La §5 de la spec se corrige en consecuencia.) |
| El panel del orquestador ya pinta `proposedActions` (`agent-chat-panel.tsx`); el widget no. | El panel necesita solo los botones nuevos; el widget necesita renderizarlas. |
| El flujo de borrador existe: `POST /v1/assistant/publish-job` (crea/continúa un borrador por `ConversationSession`) y `POST /v1/assistant/confirm-draft` (exige `jobs:create`). | La acción `create_job_draft` **no crea nada**: apunta a un `draftId`; solo `confirm-draft` crea el trabajo. |
| La intención de "publicar trabajo" hoy la decide `isPublishJobIntent` en el **cliente** con frases exactas. El servidor clasifica por palabras clave (`classifyIntent`) y por el router (`routeAgentRequest` → `DecisionLayerService`, acciones `AGENT_ROUTE_ACTIONS`). | La detección pasa al **servidor** (D1): una función pura y determinista de normalización y coincidencia; el router existente queda como respaldo solo para ambigüedad, con vocabulario cerrado. El cliente deja de decidir. |
| El chat no tiene herramientas (`requiresTools: false`); las de lectura solo corren con una `requestedAction` explícita. | Se mantiene: las acciones salen de un clasificador cerrado, no del texto del modelo. |

## 3. Diseño

### 3.1 Clasificador (puro, sin I/O) — `chat-actions/intent.ts`
- `normalizeMessage(text)`: minúsculas, sin acentos, colapsa signos, **inserta separación entre palabras pegadas conocidas** ("quieroplanear" → "quiero planear", "trabajonuevo" → "trabajo nuevo") mediante una lista cerrada de prefijos/verbos y sustantivos, no con un modelo.
- `classifyChatAction(normalized): { kind: "create_job" | "navigate" | "none"; route?: string; confidence }`.
- Ambigüedad ("quiero planear" sin objeto): `none` + pista de aclaración; **nunca** se adivina.
- Vocabulario cerrado y versionado (`CHAT_ACTIONS_VOCABULARY_VERSION`).

### 3.2 Catálogo de rutas — `chat-actions/route-catalog.ts`
- Lista cerrada `{ id, label, path, requires: permission[] }` (dashboard, disputas, evidencias, escrow, proyectos, pagos, perfil).
- `resolveRoutesFor(actor)` filtra por permisos **en el servidor**; una ruta que el actor no puede abrir no se propone.

### 3.3 Orquestación — `chat-actions/chat-actions.service.ts`
- Entrada: mensaje, actor (de `resolveRequestContext`), modo (`SEMSE_CHAT_ACTIONS_MODE`).
- `create_job`: exige `jobs:create`; abre/continúa el borrador con `AssistantService.handlePublishJob` (reutilizado, no duplicado) y devuelve la acción con `draftId` y resumen.
- `navigate`: devuelve la acción con la ruta del catálogo.
- Auditoría: `prometeo.chat_action.proposed` con `correlationId` (id de petición), tipo, ruta/`draftId`, **sin el texto del mensaje**.
- Modo `shadow`: calcula y audita lo que **habría** propuesto; no cambia la respuesta.

### 3.4 Integración en el controlador
- `prometeoChat` llama al servicio después de construir el contexto y **antes** de la llamada al modelo solo para decidir las propuestas; la respuesta del modelo no cambia. Las acciones se **añaden** a `proposedActions`.
- Con `off` no se invoca el servicio.

### 3.5 Web
- Contrato y helper compartidos en `apps/web/lib/prometeo-chat-actions.ts` (puro, probado): `describeChatAction(action)`, `isChatAction(action)`.
- Panel del orquestador: botones para `chat.navigate` (navega con `router.push` al clic) y `chat.create_job_draft` ("Confirmar" → `confirm-draft`; deshabilitado tras el primer clic; muestra el trabajo creado).
- Widget: renderiza las mismas acciones; **se elimina** la decisión por frase exacta (`isPublishJobIntent`) del panel, que pasa a depender del servidor.
- Estados: cargando, degradado con reintento, error con motivo.

### 3.6 Seguridad
- `tenantId/orgId/userId` solo del contexto autenticado. El texto del usuario solo alimenta el clasificador; nunca elige herramienta, ruta fuera del catálogo ni parámetros de ejecución.
- La confirmación reutiliza `confirm-draft` (permiso + tenant ya aplicados); doble clic idempotente por `draftId` (ya garantizado por el estado del borrador; se prueba).
- Texto con instrucciones al modelo no altera la propuesta (no pasa por el modelo para decidirla).

## 3.7 Desviaciones del plan original (implementación, 2026-10-06)

1. **El borrador se abre al PULSAR, no al clasificar.** El plan decía que `ChatActionsService` llamaría a `AssistantService.handlePublishJob`. Eso habría creado sesiones y borradores (y una llamada al modelo) por el solo hecho de que el clasificador acertara, incluso en `shadow`. Ahora el servicio **no tiene efectos secundarios** (solo propone y audita) y el panel, al pulsar "Crear el trabajo", llama al flujo `publish-job` existente con el mensaje que el usuario ya escribió; el borrador sigue pasando por su confirmación explícita (`confirm-draft`).
2. **El widget solo ofrece acciones con pantalla.** No tiene interfaz de borrador: "crear trabajo" se ofrece ahí solo si el rol tiene un asistente propio (`/client/jobs/new`, solo clientes); navegar funciona para todos los roles con ruta.
3. **`isPublishJobIntent` (atajo del cliente por frases exactas) se conserva** hasta validar `live`. Quitarlo con el flag en `off` haría perder el flujo actual. Se retira en una PR posterior, con evidencia.
4. **Auditoría:** se emiten `prometeo.chat_action.proposed`, `.shadow` y `.suppressed` (con motivo). **No** se emiten `confirmed`/`dismissed`: la confirmación vive en el flujo de borrador, que ya audita sus propias acciones; descartar un botón no tiene hoy una señal fiable.
5. **Doble barrera de rutas:** además del catálogo cerrado del servidor, el cliente solo navega a rutas relativas de `/client`, `/worker` o `/admin` (`safeChatRoute`).
## 4. Flags y despliegue
`SEMSE_CHAT_ACTIONS_MODE=off|shadow|live` (por defecto `off`). Orden: código con `off` → `shadow` → `live` para un tenant de prueba → resto. Rollback: `off`.

## 5. Riesgos
| Riesgo | Mitigación |
|---|---|
| Falsos positivos del clasificador (propone crear trabajo sin quererlo) | Es solo una propuesta con botón; se mide en `shadow` antes de `live`; lista cerrada y casos de prueba con frases reales |
| Separación de palabras pegadas incorrecta | Lista cerrada de pares conocidos; sin heurística libre; pruebas con las frases de la evidencia |
| Duplicar borradores | Reutiliza el borrador por sesión de `publish-job`; prueba de idempotencia |
| Divergencia panel/widget | Un solo helper compartido y pruebas de contrato |

## 6. Verificación
Pruebas unitarias del clasificador y del catálogo, del servicio (doble de `AssistantService`), contrato del envelope, UI (helper puro y estructura), y smoke autenticado en producción con la conversación de la evidencia.
