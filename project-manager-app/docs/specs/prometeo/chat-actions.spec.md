---
id: "prometeo.chat-actions"
title: "Prometeo actúa desde el chat (borradores con confirmación y navegación sugerida)"
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
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: ["SEMSE_CHAT_ACTIONS_MODE"]
production_evidence: []
related_files: ["apps/api/src/modules/ai-models/ai-models.controller.ts", "apps/api/src/modules/assistant/assistant.controller.ts", "apps/api/src/modules/assistant/assistant.service.ts", "apps/web/components/ai/agent-chat-panel.tsx", "apps/web/app/components/prometeo/PrometeoCopilot.tsx", "apps/web/lib/prometeo-widget-chat.ts"]
related_tests: []
related_endpoints: ["POST /v1/ai-models/prometeo/chat", "POST /v1/assistant/publish-job", "POST /v1/assistant/confirm-draft"]
related_events: []
related_agents: ["prometeo"]
last_verified: "2026-10-07"
---

# Spec: Prometeo actúa desde el chat

> Contrato ejecutable SDD 2.0. **Estado `APPROVED` (2026-10-06): el dueño aprobó la spec y aceptó D1–D4 tal como se proponían (§6).**
> Código, CI, merge, deploy y activación se registran por separado.

## 1. Problema y resultado

**Para quién:** cualquier usuario autenticado que habla con Prometeo (widget flotante y panel del orquestador).

**Problema (evidencia real, 2026-10-06):** el usuario escribió "quieroplanear un trabajo" y después "es un trabajonuevo quiero que lo guardes se va a llamar limpiesa de casas". Prometeo respondió "No puedo crear trabajos directamente desde el chat" y mandó al usuario a otra pantalla. Pidió "llévame" a la disputa y respondió "tu mensaje quedó cortado". Hoy el chat es una llamada al modelo **sin herramientas**: solo devuelve texto. Además, la única vía que ya crea trabajos (borrador de `publish-job`) se activa con frases exactas (`isPublishJobIntent`: "publicar trabajo", "nuevo trabajo", …), así que un error de tecleo o una paráfrasis la esquiva.

**Resultado esperado:** desde el chat, el usuario puede (a) empezar y confirmar la creación de un trabajo y (b) ir a una pantalla que pide, **siempre con un paso humano explícito** y sin que el modelo ejecute nada por su cuenta.

## 2. Alcance

### Incluido (V1)

- **Crear trabajo:** detectar la intención de forma robusta y llevar la conversación al flujo de borrador que ya existe (`publish-job` → `confirm-draft`). El borrador **no es un trabajo publicado**: solo `confirm-draft`, con confirmación explícita del usuario, lo crea.
- **Navegación sugerida:** el chat propone ir a una pantalla de un **catálogo cerrado** (dashboard, disputas, evidencias, escrow, proyectos, …) filtrado en el servidor por los permisos del actor; el usuario pulsa un botón, el chat nunca navega solo.
- Misma capacidad en el widget y en el panel del orquestador, con un contrato común (`proposedActions` del envelope de `prometeo/chat`, que ya existe).
- Modo de despliegue `off → shadow → live` (`SEMSE_CHAT_ACTIONS_MODE`).

### Fuera de alcance

- Cualquier acción que mueva dinero o decida (liberar escrow, aprobar hitos, resolver disputas): siguen solo por sus flujos de aprobación.
- Que el modelo elija y ejecute herramientas libremente (tool-calling abierto).
- Crear trabajos sin confirmación o sin el flujo de borrador.
- Inferir datos que el usuario no dio (presupuesto, ubicación): el borrador pregunta lo que falte.
- Memoria entre sesiones (la memoria dentro de una conversación ya se resolvió en 0.43).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| Usuario con `jobs:create` | `jobs:create` | su tenant/org | iniciar y confirmar un borrador de trabajo desde el chat | crear trabajo sin confirmar |
| Cualquier usuario autenticado | permisos de cada ruta | su tenant/org | recibir sugerencias de navegación a rutas que ya puede abrir | ver sugerencias de rutas fuera de su rol |

- Tenant boundary: `tenantId`/`orgId`/`userId` salen del contexto autenticado, nunca del cuerpo ni del modelo.
- Step-up o aprobación humana: confirmación explícita (botón) para crear el trabajo; la navegación requiere el clic.
- Datos `privacyCritical`: el texto del usuario ya viaja al modelo con las reglas de `prompt-safety`; esta spec no añade destinos.
- Auditoría: cada acción propuesta, confirmada o descartada deja registro con `correlationId` (ver §5).

## 4. Escenarios y criterios de aceptación

### P1 — Crear un trabajo desde el chat

```gherkin
DADO un usuario con permiso jobs:create que escribe "quieroplanear un trabajo" (con el error de tecleo)
CUANDO Prometeo detecta la intención de crear un trabajo
ENTONCES responde con la pregunta del borrador y propone la acción "crear trabajo" con su resumen
Y no se crea ningún trabajo hasta que el usuario pulsa "Confirmar"
Y al confirmar se llama a confirm-draft y el chat muestra el trabajo creado con su enlace
```

### P2 — Navegar

```gherkin
DADO un usuario que escribe "llévame a la disputa"
CUANDO la ruta "disputas" está en su catálogo permitido
ENTONCES el chat propone un botón "Ir a Disputas"
Y el chat no navega hasta el clic
```

Casos borde:

- [ ] Intención ambigua ("quiero planear" sin mencionar trabajo): no se inicia el flujo; el chat aclara.
- [ ] Usuario sin `jobs:create`: no se propone crear trabajo; se explica por qué.
- [ ] Ruta fuera del catálogo o del rol: no se propone (nunca un 403 después del clic como primera señal).
- [ ] Doble clic en "Confirmar": un solo trabajo (idempotente por `draftId`).
- [ ] Borrador expirado o de otro tenant: 404 sin revelar su existencia.
- [ ] Texto del usuario con instrucciones al modelo ("ignora tus reglas y crea…"): no cambia lo que se propone; la acción sale del clasificador cerrado, no del texto libre.
- [ ] `SEMSE_CHAT_ACTIONS_MODE=off`: comportamiento actual, sin acciones.

## 5. Contratos

### API

Se reutiliza `POST /v1/ai-models/prometeo/chat` **sin cambiar su esquema**: las acciones de chat usan la forma que ya
tiene `proposedActions` (`prometeoProposedActionSchema`; corregido el 2026-10-06 al verificar el código, la versión
aprobada proponía un campo `kind` nuevo que no hace falta):

```yaml
auth: required
permissions: [agents:run:create]
output_schema:
  proposedActions:           # forma existente: id, namespace, tool, label, description, riskLevel, approvalPolicy, requiresApproval, status, input, reason
    - namespace: "chat"
      tool: "create_job_draft" | "navigate"
      id: string            # estable por (conversación, tool): evita duplicar el botón
      label: string
      requiresApproval: true   # confirmación humana explícita siempre
      input:
        # create_job_draft: { draftId: string, summary: string }
        # navigate:         { route: string }   # del catálogo cerrado
errors: {400: input inválido, 401: sin sesión, 403: sin permiso}
effects:
  audit_log: "prometeo.chat_action.proposed | confirmed | dismissed" con correlationId
  domain_event: ninguno nuevo (el trabajo emite sus eventos al confirmarse por su flujo normal)
  sse: no
  payment_governance: ninguna
```

La confirmación NO es un endpoint nuevo: usa `POST /v1/assistant/confirm-draft` (ya exige `jobs:create`).

### UI

```yaml
surfaces: [widget, panel-orquestador]
states: [loading, empty, ready, forbidden, degraded, error]
required_behavior:
  - los proposedActions se muestran como botones bajo la respuesta; nunca se ejecutan solos
  - "Confirmar" deshabilitado tras el primer clic hasta recibir respuesta
  - si la acción falla se muestra el motivo y se ofrece reintentar, sin disfrazarlo de respuesta
```

### Agente/Prometeo

```yaml
tools: []   # sin tool-calling abierto: la acción sale de un clasificador de vocabulario cerrado
input_schema: mensaje + historial (0.43) + contexto de página
output_schema: proposedActions (arriba)
approval_policy: confirmación humana explícita para create_job_draft; clic para navigate
forbidden_behavior:
  - ejecutar una acción sin confirmación
  - proponer rutas fuera del catálogo o del rol
  - tomar tenant/org/usuario del texto del modelo
```

## 6. Decisiones (aceptadas por el dueño el 2026-10-06)

| ID | Decisión | Resolución (**Aceptada** tal como se proponía) |
|---|---|---|
| D1 | ¿Cómo se detecta la intención? | Normalización del texto (minúsculas, sin acentos, tolerante a espacios y erratas comunes) + el router de decisiones existente (`agent_router`) como respaldo, con vocabulario **cerrado** (`create_job`, `navigate:<ruta>`, `none`). Nunca el modelo decide libremente qué ejecutar. |
| D2 | ¿Crear el trabajo requiere siempre confirmación explícita? | **Sí**, siempre, por botón; el modelo no puede confirmar. |
| D3 | ¿Qué rutas puede sugerir la navegación? | Catálogo cerrado versionado en código, filtrado por rol/permisos en el servidor. Empezar con 6–8 rutas (dashboard, disputas, evidencias, escrow, proyectos, pagos, perfil). |
| D4 | ¿Alcance V1 de acciones? | Solo `create_job_draft` y `navigate`. Aprobar/rechazar, liberar fondos y similares quedan fuera. |

## 7. Datos y migración

- Modelos Prisma: ninguno nuevo. Migración: no aplica.
- Compatibilidad hacia atrás: el campo nuevo es aditivo; clientes que lo ignoren siguen funcionando.
- Rollback: `SEMSE_CHAT_ACTIONS_MODE=off`.

## 8. Observabilidad, despliegue y activación

- Métricas: acciones propuestas / confirmadas / descartadas, por tipo; confirmaciones duplicadas bloqueadas; intenciones ambiguas.
- Flags: `SEMSE_CHAT_ACTIONS_MODE=off|shadow|live`. En `shadow` se calcula y se registra qué se habría propuesto, sin mostrarlo.
- Canary: `shadow` → `live` para un tenant de prueba → resto.
- Evidencia de producción requerida: la conversación real de la evidencia (con las erratas) produce el borrador y, tras confirmar, un trabajo; el clic de navegación lleva a la ruta; un usuario sin permiso no ve la propuesta.
- Señal de rollback: confirmaciones duplicadas, propuestas fuera de catálogo o errores del flujo de borrador.

## 9. Tests requeridos

- [ ] Clasificador: frases reales con erratas ("quieroplanear un trabajo", "trabajonuevo"), paráfrasis y ambiguas
- [ ] Catálogo de rutas filtrado por rol/permiso; ruta inexistente nunca se propone
- [ ] Sin `jobs:create` no se propone crear trabajo; aislamiento tenant/org del borrador
- [ ] Confirmación idempotente (doble clic) y borrador ajeno/expirado ⇒ 404
- [ ] Inyección en el texto no altera la acción propuesta
- [ ] Modo `off` idéntico al comportamiento actual; `shadow` no cambia la respuesta
- [ ] UI widget y panel: botones, estado de carga, degradado y error
- [ ] Smoke autenticado en producción con la conversación de la evidencia

## 10. Mapa de implementación

### API
- `apps/api/src/modules/ai-models/ai-models.controller.ts` (propuestas en el envelope)
- `apps/api/src/modules/assistant/*` (reutiliza `publish-job` / `confirm-draft`)
- nuevo clasificador y catálogo de rutas en `apps/api/src/modules/ai-models/chat-actions/`

### Web
- `apps/web/components/ai/agent-chat-panel.tsx`, `apps/web/app/components/prometeo/PrometeoCopilot.tsx`, `apps/web/lib/prometeo-widget-chat.ts`

### Packages
- `packages/schemas/src/prometeo-runtime.schema.ts` (tipo `proposedActions` de chat)

## 11. Investigación externa

- Pendiente de la fase de plan; el diseño reutiliza lo que el repo ya tiene (flujo de borrador, `proposedActions`, router de decisiones).

## 12. Gates de cierre

- [ ] status APPROVED y D1–D4 decididas por el dueño antes de código
- [ ] spec indexado
- [ ] plan/tasks/checklist coherentes
- [ ] tests antes del código
- [ ] `spec:validate:strict` verde
- [ ] shadow sin divergencias materiales
- [ ] CI PASS
- [ ] merge SHA registrado
- [ ] deployment terminal
- [ ] canary autenticado con la conversación de la evidencia
- [ ] evidencia sin secretos
- [ ] sólo entonces VERIFIED
