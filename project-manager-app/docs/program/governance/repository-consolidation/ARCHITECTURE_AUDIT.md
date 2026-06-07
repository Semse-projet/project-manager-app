# SEMSE OS — Architecture Consolidation Audit
> Nota histórica: este documento describe un estado previo del repositorio. Varias rutas y decisiones fueron superadas por la consolidación posterior de `project-manager-app/`, `constitution/`, `repository-rules/` y el reordenamiento de `labsemse`.
**Fecha:** Marzo 22, 2026
**Autor:** Arquitecto Principal de Consolidación
**Versión:** 1.0

> **Premisa:** Todo lo que existe en `labsemse` es una expresión histórica, experimental o funcional de un solo producto: **SEMSEproject**. Este documento mapea esas expresiones, clasifica su valor y propone cómo consolidarlas en una plataforma única, viva y gobernable.

---

## A. MAPA GLOBAL DEL REPOSITORIO

```
/home/yoni/labsemse/
│
├── src/                          ★ CANÓNICO (UI temporal)
│   ├── pages/                    Marketplace UI completa (13 páginas)
│   ├── components/               59 componentes + sistema Radix UI
│   ├── hooks/                    Hooks Supabase/TanStack
│   ├── types/index.ts            Modelos de dominio (506 líneas)
│   └── context/                  Auth, UI context
│
├── app semse/                    ESPACIO DE TRABAJO MULTI-APP
│   ├── project-manager-app/      ★★ CANÓNICO PRINCIPAL (monorepo producción)
│   │   ├── apps/api/             NestJS — 84 archivos TS
│   │   ├── apps/web/             Next.js 15.5 — 65 archivos TS
│   │   ├── apps/worker/          Background jobs
│   │   ├── packages/db/          Prisma + PostgreSQL + 6 migraciones
│   │   ├── packages/schemas/     Zod — 12 archivos, ~60KB validaciones
│   │   ├── packages/agents/      16 agentes nombrados + 8 especializados
│   │   ├── packages/ui/          Librería de componentes compartida
│   │   ├── packages/auth/        Abstracción de autenticación
│   │   └── docs/                 50+ documentos de arquitectura
│   │
│   ├── Agent_Semse App Maximizada/  ★ LABORATORIO AVANZADO (→ extraer)
│   │   ├── apps/ (api, web, prometeo, admin)
│   │   ├── services/ (7 agentes como microservicios)
│   │   ├── k8s/base/             Kubernetes manifests
│   │   └── docker-compose.yml
│   │
│   ├── semse-control-mvp/        ✦ REFERENCIA SECUNDARIA (→ congelar)
│   │   └── Next.js 14 + SQLite + Prisma (MVP autónomo)
│   │
│   ├── Agent_Matriz de agentes/  ◈ LABORATORIO UI (→ archivar)
│   │   └── Prototype visual de matrix de agentes
│   │
│   ├── Agent_Chat semántico sobre PDFs/  ◈ LABORATORIO (→ archivar)
│   │   └── Prototype chat sobre documentos PDF
│   │
│   └── app/                      ◻ PLANTILLA / BOILERPLATE (→ ignorar)
│
├── program/                      ★ CANÓNICO (documentación de ejecución)
│   ├── MASTERPLAN.md
│   ├── ARCHITECTURE_TARGET.md
│   ├── ROADMAP_12_MESES.md
│   ├── architecture/ (8 docs)
│   ├── execution/ (4 docs)
│   ├── strategy/ (2 docs)
│   └── governance/ (1 doc)
│
├── vision/                       ★ CANÓNICO (documentación de visión)
│   └── 14 archivos Markdown (VISION_EXECUTIVE_SUMMARY, PILLARS, etc.)
│
├── supabase/                     ✦ REFERENCIA SECUNDARIA
│   └── Configuración Supabase (base de datos actual del src Vite)
│
├── supabase_schema.sql           ✦ LEGACY ÚTIL (→ migraciones Prisma)
└── src/types/index.ts            ✦ REFERENCIA SECUNDARIA (→ absorber en @semse/schemas)
```

### Estado por zona

| Zona | Estado | Rol |
|------|--------|-----|
| `src/` (Vite App) | Activo | Canónico UI (temporal) |
| `project-manager-app/` | Activo | **Canónico principal** |
| `Agent_Semse App Maximizada/` | Activo | Laboratorio avanzado |
| `semse-control-mvp/` | Pausado | Referencia congelada |
| `Agent_Matriz de agentes/` | Inactivo | Laboratorio de UX |
| `Agent_Chat semántico PDFs/` | Inactivo | Laboratorio de IA |
| `program/` | Activo | Canónico de estrategia |
| `vision/` | Activo | Canónico de visión |
| `supabase/` | Activo | Infraestructura transitoria |

---

## B. INVENTARIO DE APLICACIONES Y MÓDULOS

### B1. labsemse root — Vite App (`/src`)

| Atributo | Detalle |
|----------|---------|
| **Nombre** | SEMSE Marketplace UI |
| **Ruta** | `/labsemse/src/` |
| **Propósito** | Interfaz principal de marketplace: clientes, profesionales, escrow, agentes, evidencia |
| **Stack** | React 19 + Vite + TypeScript + Tailwind + Radix UI + Supabase + OpenAI |
| **Estado** | Activo — build corregido, TypeScript limpio |
| **Relación con SEMSEproject** | Es la expresión más avanzada de la UX actual; alimenta directamente la experiencia cliente/profesional |
| **Valor reutilizable** | Alto: Dashboard.tsx, PanelProfesional.tsx, Escrow.tsx, Evidencias.tsx, AgentChat, sistema de tipos |
| **Riesgo paralelo** | Medio: tiene su propio sistema de tipos y conexión Supabase separada de Prisma |

### B2. project-manager-app (`/app semse/project-manager-app`)

| Atributo | Detalle |
|----------|---------|
| **Nombre** | SEMSE Core Platform (monorepo) |
| **Ruta** | `/app semse/project-manager-app/` |
| **Propósito** | Backend de producción con NestJS + API completa de marketplace, escrow, disputas, agentes |
| **Stack** | Turborepo + NestJS 11 + Next.js 15.5 + Prisma 6.4 + PostgreSQL + Zod + TypeScript |
| **Estado** | Activo — 6 migraciones aplicadas, CI/CD configurado, smoke tests activos |
| **Relación con SEMSEproject** | **Es el núcleo canónico de la plataforma** |
| **Valor reutilizable** | Máximo: toda la arquitectura, esquemas, agentes, módulos API |
| **Riesgo paralelo** | Bajo — es la referencia maestra |

### B3. Agent_Semse App Maximizada (`/app semse/Agent_Semse App Maximizada`)

| Atributo | Detalle |
|----------|---------|
| **Nombre** | SEMSE Maximized — Full Microservices |
| **Ruta** | `/app semse/Agent_Semse App Maximizada/` |
| **Propósito** | Arquitectura de producción K8s con 7 agentes como microservicios independientes + Prometheus |
| **Stack** | Turbo + NestJS + K8s + Docker + Prometheus + Playwright E2E |
| **Estado** | Activo experimental — arquitectura más madura técnicamente (4.4/5) |
| **Relación con SEMSEproject** | Es el camino evolutivo del project-manager-app; muestra cómo debe quedar la infra |
| **Valor reutilizable** | Muy alto: manifests K8s, Dockerfiles por agente, diseño de microservicios de agentes, Prometheus config |
| **Riesgo paralelo** | Medio-alto: si se desarrolla en paralelo con project-manager-app puede crear bifurcación peligrosa |

### B4. semse-control-mvp (`/app semse/semse-control-mvp`)

| Atributo | Detalle |
|----------|---------|
| **Nombre** | SEMSE Control Panel MVP |
| **Ruta** | `/app semse/semse-control-mvp/` |
| **Propósito** | Panel de control simplificado con SQLite local — fue el primer MVP funcional de operaciones |
| **Stack** | Next.js 14 + Prisma 5 + SQLite + TypeScript |
| **Estado** | Pausado — desarrollo detuvo tras 3 días (Mar 7-9) |
| **Relación con SEMSEproject** | Fue un sprint de validación; sus flujos de UI de control son referencia de UX |
| **Valor reutilizable** | Medio: los flujos de UI y los primeros esquemas Prisma son buenos como referencia |
| **Riesgo paralelo** | Bajo (pausado) — riesgo solo si alguien lo reactiva sin saber que project-manager-app es el canónico |

### B5. Agent_Matriz de agentes (`/app semse/Agent_Matriz de agentes`)

| Atributo | Detalle |
|----------|---------|
| **Nombre** | Agent Matrix Prototype |
| **Ruta** | `/app semse/Agent_Matriz de agentes/` |
| **Propósito** | Prototipo visual para explorar la distribución y roles de los agentes de IA |
| **Stack** | Vite + React |
| **Estado** | Inactivo — prototipo de concepto |
| **Relación con SEMSEproject** | Precursor conceptual del sistema de agentes en `@semse/agents` |
| **Valor reutilizable** | Bajo: la idea fue absorbida por el catálogo de agentes en `packages/agents` |
| **Riesgo paralelo** | Mínimo — inactivo |

### B6. Agent_Chat semántico sobre PDFs (`/app semse/Agent_Chat semántico sobre PDFs`)

| Atributo | Detalle |
|----------|---------|
| **Nombre** | PDF Semantic Chat Agent |
| **Ruta** | `/app semse/Agent_Chat semántico sobre PDFs/` |
| **Propósito** | Prototipo de chat RAG sobre documentos PDF — exploración de capacidad de IA |
| **Stack** | Vite + React |
| **Estado** | Inactivo |
| **Relación con SEMSEproject** | Capacidad explorada; relevante para módulo de knowledge engine futuro |
| **Valor reutilizable** | Bajo-medio: el concepto de chat sobre documentos podría reaparecer como `KnowledgeAgent` |
| **Riesgo paralelo** | Mínimo — inactivo |

### B7. program/ y vision/

| Atributo | Detalle |
|----------|---------|
| **Nombre** | Strategic Knowledge Base |
| **Propósito** | Documentación canónica de visión, estrategia, arquitectura, roadmap y gobernanza |
| **Estado** | Activo — actualizado Mar 19-20 |
| **Valor reutilizable** | Máximo — define la dirección única del producto |
| **Riesgo paralelo** | Medio: existe documentación espejo en `project-manager-app/docs/vision/` — riesgo de divergencia |

---

## C. MATRIZ DE CONSOLIDACIÓN

| Ruta / App | Rol actual | Valor principal | Solapa con | Riesgo | Acción | Destino sugerido |
|---|---|---|---|---|---|---|
| `src/` (Vite App) | UI canónica temporal | Dashboard, Escrow, Evidencias, AgentChat UX | `apps/web` | Medio: tipos y DB propios | **Extract → Merge** | Migrar componentes valiosos a `apps/web` y `packages/ui` |
| `project-manager-app/` | Core de plataforma | API completa, esquemas, agentes, DB migrations | Todo | Bajo | **Canonical** | Fuente de verdad permanente |
| `Agent_Semse Maximizada/` | Laboratorio avanzado | K8s, microservicios, Prometheus, CI/CD | `project-manager-app/` | Medio-alto | **Extract** | Extraer: K8s manifests → `infra/k8s/`, Dockerfiles → `infra/docker/`, Prometheus → `infra/observability/` |
| `semse-control-mvp/` | MVP de control | UX flows de control panel, esquema Prisma temprano | `project-manager-app/` | Bajo | **Freeze → Archive** | Congelar como referencia histórica en `archive/semse-control-mvp/` |
| `Agent_Matriz de agentes/` | Prototipo UX | Concepto visual del sistema de agentes | `packages/agents` | Mínimo | **Archive** | `archive/experiments/agent-matrix/` |
| `Agent_Chat semántico PDFs/` | Laboratorio IA | Concepto RAG sobre documentos | Ninguno activo | Mínimo | **Reference** | Mantener como referencia para Knowledge Engine futuro |
| `program/` | Estrategia ejecutiva | MASTERPLAN, ROADMAP, arquitectura | `project-manager-app/docs/` | Medio | **Canonical** | Fuente de verdad de estrategia |
| `vision/` | Visión de producto | 14 documentos de visión bloqueada | `project-manager-app/docs/vision/` | Medio | **Canonical** | Fuente de verdad de visión |
| `supabase_schema.sql` | Legacy DB | Esquema original del Vite App | `packages/db/prisma/schema.prisma` | Bajo | **Reference** | Mantener como historial, no como fuente activa |
| `app semse/app/` | Boilerplate | Nada relevante | N/A | Mínimo | **Discard** | Eliminar o ignorar |

---

## D. DETECCIÓN DE DUPLICIDAD Y DIVERGENCIA

### D1. Tipos e interfaces duplicados

**Duplicación conflictiva:**
- `src/types/index.ts` (506 líneas, modelos dominio Vite App) ↔ `packages/schemas/src/` (modelos Zod production)
  - Ambos definen `Job`, `User`, `Escrow`, `Milestone`, `Evidence`, `Proposal`
  - Los nombres de campos divergen: Vite usa `camelCase` con Supabase, Prisma usa snake_case internamente pero expone camelCase en DTOs
  - **Acción:** `src/types/index.ts` debe extinguirse. Los tipos del Vite App deben importar de `@semse/schemas` cuando se complete la migración.

**Duplicación aceptable (temporal):**
- `EscrowAccount` (Vite `src/types`) ↔ `EscrowView` (`packages/schemas/escrow-view.types.ts`)
  - Coexisten intencionalmente durante migración. Ya resuelto con aliases de tipos en `escrow-timeline.tsx`.

### D2. Páginas duplicadas

| Concepto | Vite App (`src/pages`) | project-manager-app (`apps/web`) |
|----------|----------------------|----------------------------------|
| Dashboard | `Dashboard.tsx` (21KB) | `(app)/client/dashboard/page.tsx` + `worker/dashboard/page.tsx` |
| Escrow | `Escrow.tsx` (18KB) | `escrow/` pages (en construcción) |
| Evidencias | `Evidencias.tsx` (23KB) | `evidence/` module |
| Panel profesional | `PanelProfesional.tsx` (33KB) | `worker/` pages |
| Login/Register | `Login.tsx`, `Register.tsx` | `login/page.tsx` |

**Tipo:** Duplicación operativa temporal — el Vite App tiene páginas más maduras en UX; Next.js tiene mejor arquitectura. Deben converger.

### D3. Componentes duplicados

- **Navbar/Navigation:** 4 implementaciones distintas (Vite App, project-manager-app, Agent_Matriz, PDF Chat)
  - **Acción:** Una sola en `packages/ui`, exportada a todos.
- **Dashboard:** 2 versiones (Vite, Agent_Matriz)
- **StatCard:** Existe en Vite App y en `apps/web/components/semse/StatCard.tsx`
  - La versión de `apps/web` es la canónica (ya en monorepo)
- **StatusBadge:** En `apps/web/components/semse/StatusBadge.tsx` — canónica

### D4. Sistemas de base de datos paralelos

| Sistema | Dónde | Estado |
|---------|-------|--------|
| Supabase (PostgreSQL con RLS) | Root Vite App | Operativo — base del Vite App actual |
| Prisma + PostgreSQL | project-manager-app | Canónico — 6 migraciones aplicadas |
| Prisma + SQLite | semse-control-mvp | Congelado — abandonado |

**Divergencia peligrosa:** Los schemas tienen diferencias en nombres de tablas y columnas. `supabase_schema.sql` usa `profiles`, `jobs`, `escrows`; Prisma usa `User`, `Job`, `Escrow` con campos adicionales. Requiere plan de migración explícito.

### D5. Documentación duplicada

**Duplicación conflictiva potencial:**
- `/vision/` (14 docs) ↔ `/app semse/project-manager-app/docs/vision/` (15 docs espejo)
  - Si se actualizan en un lugar y no en el otro, divergen
  - **Acción:** `project-manager-app/docs/vision/` debe marcarse como espejo de solo lectura; la fuente es `/vision/`

**Duplicación aceptable:**
- `/program/architecture/` ↔ `project-manager-app/docs/architecture/`
  - Diferentes niveles de abstracción — `program/` es estratégico, `docs/` es implementación

### D6. Sistemas de agentes paralelos

- `@semse/agents` (packages/agents) — catálogo de agentes consolidado ✓
- `Agent_Semse App Maximizada/services/` — agentes como microservicios independientes
- `AgentChat.tsx` en Vite App — cliente UI de agentes
- `agent-chat-panel.tsx` en apps/web — nuevo cliente UI

No son contradictorios — representan capas diferentes (catálogo → microservicio → UI). Pero deben estar explícitamente conectados.

---

## E. PROPUESTA DE ARQUITECTURA OBJETIVO

```
SEMSEproject — Plataforma única
│
├── apps/
│   ├── web/              Next.js 15+ (canónico UI — absorbe src Vite)
│   ├── api/              NestJS (canónico backend)
│   ├── worker/           Background jobs (BullMQ + Redis)
│   └── admin/            Panel de operaciones (absorber de Ag.Maximizada)
│
├── packages/
│   ├── db/               Prisma + PostgreSQL (ÚNICA fuente de esquema)
│   ├── schemas/          Zod (contratos compartidos API ↔ UI ↔ workers)
│   ├── agents/           Catálogo de agentes (tipos + personalidades + schemas IO)
│   ├── ui/               Componentes compartidos (absorber de Vite App + Ag.Maximizada)
│   ├── auth/             Autenticación unificada (OIDC / DID futuro)
│   └── shared/           Utils, constants, logger
│
├── services/             (Fase 4+ — microservicios de agentes)
│   ├── pricing-agent/
│   ├── trust-match-agent/
│   ├── evidence-coach-agent/
│   ├── orchestrator/
│   ├── dispute-agent/
│   ├── job-planner-agent/
│   └── ecv-service/
│
├── infra/
│   ├── docker/           Dockerfiles unificados
│   ├── k8s/              Manifests K8s (absorber de Ag.Maximizada)
│   ├── observability/    Prometheus + Grafana (absorber de Ag.Maximizada)
│   └── compose/          Docker Compose (dev, staging, prod)
│
├── docs/                 Documentación canónica unificada
│   ├── vision/           → espejo read-only de /vision/
│   ├── architecture/
│   ├── domain/
│   ├── runbooks/
│   └── adr/              Architecture Decision Records
│
├── program/              ★ CANÓNICO — estrategia y planificación
├── vision/               ★ CANÓNICO — visión y principios
└── archive/              Proyectos congelados (semse-control-mvp, Agent_Matriz, etc.)
```

### Capas y reglas de precedencia

| Capa | Fuente de verdad | Regla |
|------|-----------------|-------|
| Esquema de datos | `packages/db/prisma/schema.prisma` | Ningún otro archivo define modelos de datos |
| Contratos API | `packages/schemas/src/` | Todo DTO/tipo compartido vive aquí |
| Agentes | `packages/agents/src/index.ts` | Definición central — microservicios la implementan |
| UI components | `packages/ui/` | Un solo componente; no duplicar en apps |
| Visión de producto | `/vision/` | Read-only espejo en cualquier otra parte |
| Estrategia/ejecución | `/program/` | Los planes de sprint viven aquí, no en docs/ de apps |
| Infraestructura | `infra/k8s/` + `infra/docker/` | Manifests unificados de Ag.Maximizada |

---

## F. DOCUMENTO DE CANONICIDAD

Ver `repository-rules/CANONICITY.md` (archivo separado generado junto a este).

---

## G. PLAN DE MIGRACIÓN POR FASES

### Fase 1 — Auditoría y clasificación (HOY — completada)
- ✅ Mapear todas las carpetas
- ✅ Clasificar por rol (canónico, laboratorio, legacy, archivo)
- ✅ Detectar duplicidades y divergencias
- ✅ Producir este documento

### Fase 2 — Declaración de canonicidad (Mar 22-24)
- [ ] Crear `repository-rules/CANONICITY.md` en raíz del repo
- [ ] Añadir header `# LEGACY — DO NOT USE AS SOURCE` a semse-control-mvp README
- [ ] Añadir header a Agent_Matriz y Agent_Chat PDFs
- [ ] Poner aviso en `src/types/index.ts`: "Migrating to @semse/schemas"
- [ ] Documentar en `project-manager-app/docs/` que `/vision/` y `/program/` son la fuente de estrategia

### Fase 3 — Extracción de módulos reutilizables (Mar 24 - Apr 5)
- [ ] Extraer K8s manifests de Ag.Maximizada → `infra/k8s/`
- [ ] Extraer Dockerfiles de Ag.Maximizada → `infra/docker/`
- [ ] Extraer configuración Prometheus → `infra/observability/`
- [ ] Identificar y mover los 3-5 componentes UI más maduros del Vite App a `packages/ui`
  - Candidatos: `AgentChat.tsx`, `EscrowTimeline.tsx`, `EvidenceValidationReport.tsx`, `StatCard.tsx`
- [ ] Normalizar tipos del Vite App para que importen de `@semse/schemas`

### Fase 4 — Consolidación de frontend (Apr 5-20)
- [ ] Migrar páginas clave del Vite App a `apps/web`:
  - `Dashboard.tsx` → enriquecer `client/dashboard/page.tsx`
  - `PanelProfesional.tsx` → enriquecer `worker/dashboard/page.tsx`
  - `Escrow.tsx` → nueva ruta `escrow/page.tsx`
  - `Evidencias.tsx` → nueva ruta `evidence/page.tsx`
- [ ] Eliminar duplicaciones de Navbar/Navigation → un solo componente en `packages/ui`
- [ ] Desconectar Vite App de Supabase directo → apuntar a `apps/api`

### Fase 5 — Consolidación de documentación (Apr 5-10)
- [ ] Definir que `/vision/` es la única fuente de verdad de visión
- [ ] Marcar `project-manager-app/docs/vision/` como espejo — añadir script de sync o eliminar
- [ ] Unificar `program/` como única fuente de planificación
- [ ] Crear `docs/adr/` en project-manager-app para decisiones arquitectónicas

### Fase 6 — Archivo y freeze (Apr 10-15)
- [ ] Mover `semse-control-mvp/` → `archive/semse-control-mvp/`
- [ ] Mover `Agent_Matriz de agentes/` → `archive/experiments/`
- [ ] Mover `Agent_Chat semántico PDFs/` → `archive/experiments/`
- [ ] Mover `app semse/app/` → eliminar (boilerplate)
- [ ] Actualizar `.gitignore` y root README con nueva estructura

### Fase 7 — Estandarización del desarrollo futuro (Apr 15+)
- [ ] Todo nuevo módulo de backend → `apps/api/src/modules/[modulo]/`
- [ ] Todo nuevo tipo compartido → `packages/schemas/src/[dominio].schema.ts`
- [ ] Todo nuevo componente → `packages/ui/src/[componente].tsx`
- [ ] Todo nuevo agente → declarar en `packages/agents/src/index.ts` primero
- [ ] Infra nueva → `infra/` directory
- [ ] No más apps en `app semse/` — el monorepo ES el espacio de trabajo

---

## H. CRITERIO DE ADAPTACIÓN

### H1. Vite App (src/) → apps/web

**Qué conservar de UX:**
- Layout dashboard con StatCards — más rico que el actual de apps/web
- `PanelProfesional.tsx` — UI de worker más completa
- `Escrow.tsx` — flujo de escrow con timeline visual
- `Evidencias.tsx` — galería de evidencia + validación report
- `AgentChat.tsx` / `AgentBubble.tsx` — UI de chat de agentes

**Qué conservar de lógica:**
- `useEscrows.ts` hook — lógica de normalización válida
- `useDashboardStats.ts` — cálculos de stats
- Sistema de filtros en `Profesionales.tsx`

**Qué descartar:**
- Conexión directa Supabase (usar API NestJS en su lugar)
- `src/types/index.ts` — reemplazar con `@semse/schemas`
- Componentes Radix UI individuales — usar los de `packages/ui`

**Cómo convertirlo en módulo:**
1. Crear rama `feat/migrate-vite-pages`
2. Copiar página por página como Next.js Server/Client Components
3. Reemplazar `supabase.from('jobs')` → `fetch('/api/semse/jobs')`
4. Reemplazar tipos locales → importar de `@semse/schemas`
5. Mover hooks a `apps/web/hooks/`

### H2. Agent_Semse Maximizada → infra/ + services/

**Qué conservar:**
- Arquitectura de microservicios de agentes (cada agente = Docker container)
- `k8s/base/` manifests → `infra/k8s/`
- Configuración Prometheus + Grafana → `infra/observability/`
- Dockerfiles por servicio → `infra/docker/`
- Design del `orchestrator` service

**Qué descartar:**
- Apps duplicadas (api, web, admin) — ya existen en project-manager-app
- Prisma schema separado — usar el de `packages/db`

**Cómo integrarlo:**
1. No importar código directamente — copiar manifests K8s
2. Adaptar Dockerfiles a la estructura de packages del monorepo
3. Los agentes como microservicio seguirán la interfaz definida en `packages/agents`

### H3. semse-control-mvp → Referencia de UX de Control Panel

**Qué conservar (como referencia):**
- Flujos de UI de panel operacional
- Estructura del schema Prisma temprano (referencia histórica de la evolución del modelo)

**Qué descartar:**
- SQLite — no es compatible con la arquitectura PostgreSQL objetivo
- Next.js 14 — versión inferior al 15.5 del monorepo

**Cómo convertirlo:**
- No migrar código directamente
- Usar como referencia visual al construir `apps/admin/`
- Archivar con documentación clara de qué contiene

---

## I. REPORTE EJECUTIVO FINAL

### La línea principal real del proyecto

**SEMSEproject es un marketplace de construcción y servicios profesionales** con capas de:
1. Operación (jobs, bids, contratos, milestones, evidencia)
2. Financiero (escrow, pagos, milestones, reputación)
3. Operativo (panel de ops, disputas, workers)
4. Inteligencia (16 agentes nombrados + 8 especializados)

**El núcleo canónico ya existe y está bien construido:** `project-manager-app` con NestJS + Prisma + Zod + Next.js.

### Los fragmentos de mayor valor

1. **`@semse/agents`** — 16 agentes nombrados con personalidades completas + 8 agentes especializados con schemas IO. Este catálogo es único y valioso; nada más en el repositorio tiene este nivel de completitud.

2. **`src/pages/` del Vite App** — UX más rica que la de apps/web en este momento. `PanelProfesional.tsx` (33KB), `Dashboard.tsx` (21KB), `Escrow.tsx` (18KB) son las páginas más completas funcionalmente.

3. **`program/` + `vision/`** — 139 documentos estratégicos con MASTERPLAN, ROADMAP, arquitectura target, visión bloqueada. Esta base documental es excepcional para un proyecto en esta etapa.

4. **Infraestructura K8s de Ag.Maximizada** — La arquitectura de 7 agentes como microservicios independientes + Prometheus es el camino de producción correcto. Sus manifests son el blueprint de infra futuro.

5. **`packages/schemas/`** — 12 archivos de validación Zod con ~60KB de contratos de datos. Es la capa de coherencia que hace que todo el sistema sea seguro.

### Las mayores fuentes de confusión

1. **Dual de bases de datos:** Supabase (Vite App) vs. Prisma/PostgreSQL (monorepo). El equipo puede no saber con claridad cuál es el sistema de datos real.

2. **Dos UIs activas:** El Vite App tiene páginas más maduras en UX pero el monorepo es la arquitectura correcta. Esto genera confusión sobre dónde trabajar.

3. **Documentación espejo:** `/vision/` y `project-manager-app/docs/vision/` son copias que pueden divergir. No hay un proceso claro de sync.

4. **Nomenclatura de apps:** "Agent_Semse App Maximizada", "semse-control-mvp", "project-manager-app" — los nombres no comunican claramente su rol (canónico vs. experimental).

### El camino oficial de SEMSEproject a partir de ahora

```
┌─────────────────────────────────────────────────────────────┐
│  REGLA 1: project-manager-app ES el producto.               │
│  Todo lo demás es laboratorio, archivo o documentación.     │
│                                                             │
│  REGLA 2: Supabase es transitorio.                          │
│  La base de datos final es PostgreSQL con Prisma.           │
│                                                             │
│  REGLA 3: El Vite App es una deuda de UX.                   │
│  Debe vaciarse hacia apps/web, no crecer más.               │
│                                                             │
│  REGLA 4: Ag.Maximizada es el futuro de infra.              │
│  Sus manifests K8s y microservicios de agentes              │
│  deben absorberse en infra/ del monorepo.                   │
│                                                             │
│  REGLA 5: /vision/ y /program/ no se editan en las apps.   │
│  Son la fuente de verdad; las apps la implementan.          │
└─────────────────────────────────────────────────────────────┘
```

**Siguiente acción inmediata:** Crear `repository-rules/CANONICITY.md` en la raíz del repo y ejecutar Fase 2 del plan de migración.

---

*Documento generado por arquitectura proactiva — SEMSE OS · Marzo 22, 2026*
