# Auditoría OKComputer → SEMSE Connect (F5)

**Fecha:** 2026-07-08
**Programa:** `docs/specs/SEMSE_CONNECT_PROGRAM_2026-07-07.md` — fase F5
**Naturaleza:** auditoría, no build (patrón SAT-004). **No se migra código.**

---

## 1. Qué es OKComputer realmente (F5.1)

Existen DOS artefactos distintos bajo el nombre OKComputer dentro del monorepo:

### 1a. "Manual Semse Web App" (el OKComputer marketplace)
`apps/assistant-portal/docs/gdrive_documentos/OKComputer_summary.md` + `docs/okcomputer_source/`

**Es un prototipo HTML estático de 14 archivos** (index, login, register, dashboard,
publicar, agenda, modals + main.js), no una aplicación con backend. Sus features
declaradas: wizard de publicación 4 pasos, agenda con calendario y reservas,
escrow, evidencias con estados, calculadora de precios, panel de usuario.

### 1b. WebAssistant Portal (`apps/assistant-portal/`)
Aplicación real (Vite + tRPC + Drizzle, 12 tablas) pero de OTRO dominio:
**workbench de desarrollo** — proyectos/archivos, editor de código, docs con
versionado, kanban, AI code tools, RAG visualizer, billing/subscriptions.
Ya integró componentes de OKComputer (RAG Visualizer, Cache Simulator) según su todo.md.

---

## 2. Matriz feature-por-feature (F5.2)

### Prototipo marketplace (1a) vs SEMSEproject

| Feature OKComputer | Estado en SEMSE | Detalle |
|---|---|---|
| Publicación de trabajos (wizard) | **EXISTS — superior** | Smart Intake multi-categoría con IA + `/client/jobs/new` |
| Calculadora de precios | **EXISTS — superior** | ProTools 27/27 + pricing engine |
| Escrow | **EXISTS — superior** | Stripe live, hitos, liberaciones parciales, refunds (PR #80) |
| Evidencias con estados | **EXISTS — superior** | Evidence pipeline + visión artificial + admin review |
| Reservas (hold/accept/release) | **EXISTS** | `reservations` module, spec VERIFIED |
| Dashboard con estadísticas | **EXISTS** | Dashboards por rol + admin hubs |
| Panel de usuario | **EXISTS** | Perfiles + citizen profile |
| Páginas legales | **EXISTS** | /privacy, /terms, /data-deletion |
| **Agenda con calendario visual** | **GAP (parcial)** | Existen reservations y tracker, pero NO hay: vista calendario de disponibilidad, gestión de horarios del profesional, reprogramación, sincronización con calendarios externos (Google Calendar), ni optimización de rutas |

### WebAssistant Portal (1b) vs SEMSEproject

| Feature portal | Estado en SEMSE | Recomendación |
|---|---|---|
| Kanban de tareas | EXISTS (`tasks`, buildops tasks) | Descartar |
| Docs + versionado | PARTIAL (Knowledge) | Descartar — dominio dev-tools, no marketplace |
| AI code tools / editor | N/A (otro producto) | Fuera de alcance de Connect |
| RAG visualizer | PARTIAL (Observer/anatomy) | Considerar como inspiración UI, no migrar |
| Billing/subscriptions | PARTIAL (Payments es escrow, no suscripciones) | Anotar para SEMSE Payments v2 si se venden planes |

---

## 3. Recomendaciones por gap (F5.3)

1. **Agenda inteligente — ÚNICO gap real que vale inversión.** Recomendación:
   **reimplementar** (no extraer: el prototipo es HTML estático sin lógica reutilizable)
   como capacidad de SEMSE Connect sobre `reservations` + `field-ops`:
   - v1: vista calendario de trabajos/reservas del profesional + disponibilidad semanal
   - v2: reprogramación con detección de conflictos
   - v3: sync Google Calendar (vía SEMSE Integrations) + optimización de rutas
   Crear spec `docs/specs/ui/connect-agenda.spec.md` cuando se priorice.

2. **Suscripciones/planes** (del portal): anotado como candidato futuro de
   SEMSE Payments. No es gap de Connect.

3. **Todo lo demás: descartar.** El costo de extraer supera el valor; SEMSE ya
   tiene versiones de producción superiores de cada pieza del prototipo.

4. **`apps/assistant-portal/` queda como está** (archivo de referencia). No se
   integra al build del monorepo ni se le da mantenimiento. Si estorba en CI o
   en el peso del repo, moverlo a un repo de archivo — decisión del usuario.

## 4. Cierre

Con esta auditoría el programa SEMSE Connect F1–F5 queda **COMPLETADO**:
la absorción de OKComputer se resuelve con naming (taxonomía F1), descubrimiento
(Hub F2, personas F3), demo (F4) y un único gap real a futuro (agenda inteligente).
