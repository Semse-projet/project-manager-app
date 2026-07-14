# SEMSE — Taxonomía de módulos del ecosistema

**Fecha:** 2026-07-07
**Estado:** APROBADO
**Programa:** `docs/specs/SEMSE_CONNECT_PROGRAM_2026-07-07.md`

> Mapa de qué código EXISTENTE pertenece a cada módulo del ecosistema.
> Es un mapeo de lo que existe hoy, no aspiracional. Los nombres de módulos son
> **naming de producto**: los directorios de código conservan sus nombres actuales
> (regla: nada de rename big-bang).

---

## Decisión de absorción: OKComputer → SEMSE Connect

**OKComputer no evoluciona como producto independiente.** Su dominio (marketplace,
escrow, jobs, agenda, evidencias) ya está cubierto en ~80% por SEMSEproject.
"SEMSE Connect" es el nombre de producto de esa capa.

- Código fuente de OKComputer en el monorepo: `apps/assistant-portal/`
  (con material de referencia en `apps/assistant-portal/docs/okcomputer_source/`
  y `docs/gdrive_documentos/OKComputer_summary.md`).
- **No se renombra ni migra código de assistant-portal en este programa.**
  La fase F5 del programa lo audita feature-por-feature para extraer solo gaps
  (hipótesis principal: agenda inteligente). Referencias históricas a "OKComputer"
  en docs se conservan como archivo.

---

## Los 9 módulos

### 1. SEMSE Core — identidad, usuarios, organizaciones, permisos

| Capa | Código |
|------|--------|
| API | `apps/api/src/modules/auth`, `users`, `organizations`, `admin`, `compliance`, `did`, `worker-verification` |
| Web | `/login`, `/register`, web-session BFF, RBAC guards |
| Contratos | `docs/specs/api/rbac-explicit-boundary.spec.md` (deny-by-default) |

### 2. SEMSE Connect — marketplace, contratación, agenda, mensajería, evidencias, coordinación

La capa de conexión: cualquier vertical le solicita servicios (Agro pide un
veterinario, BuildOps pide un electricista) sin salir del ecosistema.

| Capa | Código |
|------|--------|
| API | `jobs`, `marketplace`, `matching`, `reservations`, `bids`, `smart-intake`, `intake-operations-bridge`, `field-ops`, `labor-engine`, `communications`, `notifications`, `evidence` (flujo de trabajo), `contracts`, `change-orders`, `disputes`, `tasks`, `contractor`, `travel`, `weather` |
| Web | landing intake, `/intake/*`, `/worker/*`, `/client/*`, jobs, tracker, `/communications` |
| Agentes | Match/Scheduler/Evidence/Negotiation/Support Connect Agents = mapeo de producto sobre los agentic loops existentes (SPEC-AGT-001 / SPEC-AUT-001). No hay infraestructura de agentes propia de Connect. |

### 3. SEMSE Payments — pagos, escrow, billeteras, facturación

| Capa | Código |
|------|--------|
| API | `payments`, `escrow`, `payment-governance`, `finance`, `liens`, `milestones` (readiness de pago) |
| Integraciones | Stripe 22.x (todos los roles), webhooks vía serviceConnect |

### 4. SEMSE Trust — reputación, verificaciones, cumplimiento, auditoría

| Capa | Código |
|------|--------|
| API | `ratings`, `trust`, `governance` (quadratic voting, MCA, credits), `compliance`, audit logs, `worker-verification` |
| Web | TrustPassportCard, reputation UI, `/admin` governance, perfil ciudadano |

### 5. SEMSE AI — agentes y orquestación (Prometeo orquestador)

| Capa | Código |
|------|--------|
| API | `ai-models` (Prometeo + Ollama provider), `agents`, `semse-agents`, `autonomy`, `assistant`, `prometeo`, `intelligence`, `operational-intelligence`, `browser-agent`, `vision`, consciousness (`ops`) |
| Servicios | `apps/vision-service` (FastAPI), `apps/autonomy-server`, worker loops |
| Contratos | `docs/specs/agents/*`, `docs/specs/autonomy/permanent-loops.spec.md` |

### 6. SEMSE Agro — vertical agrícola/ganadero

| Capa | Código |
|------|--------|
| API | `agro` (animales, cultivos, inventario, tareas FSM, costos) |
| Web | `apps/web/app/agro` |
| Contratos | `docs/specs/agro/*` |

### 7. SEMSE BuildOps — vertical construcción/field services

| Capa | Código |
|------|--------|
| API | `buildops`, `milestones`, `projects`, `pricing`, `materials`, `incidents`, `portfolio`, `tools` (ProTools 27/27) |
| Web | `/buildops`, `/tools`, `/pro`, admin hubs |
| Contratos | `docs/specs/tools/*`, `docs/specs/fsm/*` |

### 8. SEMSE Knowledge — docs, RAG, trade library

| Capa | Código |
|------|--------|
| API | `knowledge`, `repo-knowledge`, `runtime-knowledge`, `graphify`, `skills`, embeddings + hybrid retrieval |
| Web | `/knowledge`, trade guide |

### 9. SEMSE Integrations — hub de servicios externos

| Capa | Código |
|------|--------|
| API | `evidence-gateway`, `communications` (WhatsApp/Meta webhook HMAC), `satellites`, `developer-runtime`, `domain-events` |
| Externos | Stripe, Meta/WhatsApp, Railway, Ollama/OpenAI/Anthropic, Alexa (SAT-002), graphify (SAT-004) |
| Contratos | `docs/specs/satellites/*` |

---

## Módulos API sin asignar (soporte transversal)

`health`, `reporting`, `analytics`, `anatomy`, `domain-events`, `ops` — infraestructura
transversal; sirven a todos los módulos y no pertenecen a un vertical de producto.

## Reglas de uso

1. En UI pública, docs de producto y specs nuevos: usar los nombres de módulo de esta taxonomía.
2. En código: conservar nombres de directorios existentes; módulos nuevos pueden usar el naming de producto si nacen dentro de un dominio claro.
3. El catálogo tipado de módulos para Hub/landing (`apps/web/components/landing/landing-routes.ts`) deriva de esta tabla y es su única representación en código.
