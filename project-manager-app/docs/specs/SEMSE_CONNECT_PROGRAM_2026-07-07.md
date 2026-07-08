# SEMSE Connect — Programa SDD 2026-07-07

**Estado:** ACTIVO
**Rama base de trabajo:** `feat/semse-connect-sdd` (worktree `/home/yoni/semse-worktrees/semse-connect-sdd`)
**Decisión rectora:** OKComputer NO evoluciona como producto independiente. Se renombra **SEMSE Connect** y se convierte en la capa de conexión del ecosistema (marketplace, contratación, agenda, mensajería, evidencias, coordinación). El código existente del monorepo ya cubre ~80% de esa capa; este programa es de **naming, navegación y empaquetado**, no de reconstrucción.

> Este documento es la fuente de verdad del programa Y el archivo de estado del loop de ejecución.
> Cada iteración del loop lee este documento, ejecuta la siguiente tarea sin marcar, y actualiza el checklist en el mismo commit.

---

## Specs que gobiernan este programa

| Fase | Spec | Estado |
|------|------|--------|
| F1 | (este documento, sección F1) | APPROVED |
| F2 | `docs/specs/ui/semse-hub.spec.md` | APPROVED |
| F3 | `docs/specs/ui/landing-personas.spec.md` | APPROVED |
| F4 | `docs/specs/ui/demo-sandbox.spec.md` | APPROVED |
| F5 | (este documento, sección F5 — auditoría, no build) | APPROVED |

---

## Principios (heredan de `docs/SDD_GOVERNANCE.md` y la Constitución SEMSE)

1. **Nada de rename big-bang en código.** Los módulos internos (`jobs`, `matching`, `escrow`, `evidence`, `communications`, etc.) conservan sus nombres. "SEMSE Connect" vive en la capa de producto: rutas, navegación, textos, docs.
2. **Los agentes Connect (Match, Scheduler, Escrow, Evidence, Negotiation, Support) se mapean sobre los agentic loops existentes** (SPEC-AGT-001 / SPEC-AUT-001). No se crea infraestructura de agentes nueva en este programa.
3. **El admin no es el punto de entrada del producto.** Cada vertical debe ser accesible desde el ecosistema sin pasar por `/admin`.
4. Cada tarea termina con validación ejecutable (`pnpm spec:validate` + tests/typecheck del área tocada) antes de commit.
5. El flujo monetizable existente (intake→job→escrow→evidence→rating) no se toca; este programa solo agrega capas de descubrimiento encima.

---

## F1 — Taxonomía y naming (docs only)

**Objetivo:** dejar por escrito el mapa de módulos del ecosistema y qué código existente pertenece a cada uno, para que todo trabajo posterior (humano o agente) use el mismo lenguaje.

Taxonomía acordada:

| Módulo | Responsabilidad | Código existente que lo compone |
|--------|-----------------|--------------------------------|
| SEMSE Core | identidad, usuarios, organizaciones, permisos | `auth`, `users`, RBAC, web-session |
| SEMSE Connect | marketplace, contratación, agenda, mensajería, evidencias, coordinación | `jobs`, `matching`, `reservations`, `field-ops`, `communications`, `evidence` (flujo), smart-intake |
| SEMSE Payments | pagos, escrow, billeteras, facturación | `payments`, `escrow`, Stripe |
| SEMSE Trust | reputación, verificaciones, cumplimiento, auditoría | reputation, TrustPassport, `governance`, audit logs |
| SEMSE AI | agentes y orquestación (Prometeo orquestador) | `ai-models`, agentic loops, consciousness, vision |
| SEMSE Agro | vertical agrícola | `agro` |
| SEMSE BuildOps | vertical construcción/field services | `buildops`, milestones, ProTools |
| SEMSE Knowledge | docs, RAG, trade library | knowledge, RAG, embeddings |
| SEMSE Integrations | hub de servicios externos | Stripe, WhatsApp/Meta, Railway, Ollama/OpenAI/Anthropic |

### Tareas F1

- [x] F1.1 — Crear `docs/SEMSE_CONNECT_TAXONOMY.md` con la tabla anterior expandida: por módulo, listar directorios de código reales (`apps/api/src/modules/*`, rutas web) y endpoints principales. Es un mapeo de lo que EXISTE, no aspiracional.
- [x] F1.2 — Actualizar `docs/specs/README.md`: agregar dominio `connect` a la descripción de estructura y referenciar la taxonomía.
- [x] F1.3 — Buscar referencias a "OKComputer" en el monorepo (`grep -ri okcomputer`) y documentar en la taxonomía la decisión de absorción (no renombrar código si aparece; solo documentar). **Hallazgo:** el código fuente de OKComputer vive en `apps/assistant-portal/` — objetivo directo para la auditoría F5.
- [x] F1.4 — `pnpm spec:validate` + `pnpm spec:index` verdes (0 errores nuevos vs baseline de 17 preexistentes). Commit + push + **PR de F1** (docs only, merge fácil).

---

## F2 — SEMSE Hub (portal de módulos, sacar verticales de /admin)

**Spec:** `docs/specs/ui/semse-hub.spec.md`

### Tareas F2

- [ ] F2.1 — Auditar rutas actuales: qué verticales solo son alcanzables vía `/admin` (agro, tools, buildops, knowledge, communications) y qué existe ya en `(public)/modules/[id]` y `ecosystem-modules.tsx`. Dejar hallazgos en el spec (sección Implementation Map).
- [ ] F2.2 — Crear ruta `/hub` en `apps/web/app/(public)/hub/page.tsx`: grid de módulos del ecosistema alimentado desde un catálogo tipado único (extender `landing-routes.ts` / `ecosystemModules`), con estado por módulo (live / demo próximamente) y CTA por rol.
- [ ] F2.3 — Página de detalle de módulo: extender `(public)/modules/[id]` para cubrir los 9 módulos de la taxonomía con capacidades reales (no lorem), enlaces a login con `?from=` correcto por rol.
- [ ] F2.4 — Navegación: enlazar Hub desde landing nav y footer; los verticales dejan de estar escondidos en `/admin` (los accesos admin permanecen, pero dejan de ser la única puerta).
- [ ] F2.5 — Tests e2e mínimos (patrón `tests/e2e-semse/public-landing.spec.ts`): `/hub` renderiza los 9 módulos, cada detalle responde 200, CTAs apuntan al login correcto. Subir spec a IMPLEMENTED con related_tests.
- [ ] F2.6 — `pnpm check` verde en lo tocado. Commit + push + **PR de F2**.

---

## F3 — Landing dinámica por persona

**Spec:** `docs/specs/ui/landing-personas.spec.md`

### Tareas F3

- [ ] F3.1 — Sección "¿Qué quieres hacer hoy?" en la landing: selector de persona (Agricultor / Contratista / Cliente / Empresa) que re-renderiza tarjetas de capacidades sin recargar, alimentado del mismo catálogo del Hub. Sin login.
- [ ] F3.2 — Cada tarjeta enlaza a detalle de módulo del Hub o al intake wizard según el caso (no duplicar el flujo de intake existente — spec `public-landing-operational-entry` sigue vigente).
- [ ] F3.3 — Persistir persona elegida (localStorage) para que el Hub resalte lo relevante en visitas siguientes.
- [ ] F3.4 — Tests e2e: cambio de persona cambia tarjetas; deep links funcionan. Spec a IMPLEMENTED.
- [ ] F3.5 — `pnpm check` verde. Commit + push + **PR de F3**.

---

## F4 — Modo demo/sandbox sin registro (Agro primero)

**Spec:** `docs/specs/ui/demo-sandbox.spec.md`
**Advertencia:** es la fase de mayor esfuerzo técnico. Requiere decisión explícita de diseño de aislamiento antes de codificar (ver spec §Aislamiento). Si al llegar aquí el diseño de aislamiento genera dudas de producto (costo, TTL, límites), PAUSAR el loop y reportar al usuario en vez de asumir.

### Tareas F4

- [ ] F4.1 — Diseño de aislamiento: organización sandbox `demo` con seed determinista, flag `isDemo` a nivel org, exclusión de matching/reputación/consciousness/analytics. Documentar en el spec y validar contra el schema Prisma real.
- [ ] F4.2 — Endpoint de sesión demo (`POST /v1/demo/session` o equivalente): crea contexto efímero read-mostly sobre datos seed, TTL corto, rate-limited, sin PII.
- [ ] F4.3 — UI: `/hub` → "Probar SEMSE Agro" → vista Agro en modo demo (banner persistente "datos de demostración", CTA a registro que conserva intención).
- [ ] F4.4 — Reset/expiración de datos demo (job de worker o TTL en query).
- [ ] F4.5 — Tests: sesión demo no aparece en matching ni métricas; TTL expira; rate limit. Spec a IMPLEMENTED.
- [ ] F4.6 — `pnpm check` verde. Commit + push + **PR de F4**.

---

## F5 — Auditoría OKComputer (extraer gaps, no migrar)

**Objetivo:** auditoría, no build (mismo patrón que SAT-004/graphify).

### Tareas F5

- [ ] F5.1 — Localizar el código de OKComputer en el filesystem (`~/nuevo proyecto`, `~/app prototipos`, u otro) y inventariar sus features: marketplace, escrow, jobs, agenda, evidencias.
- [ ] F5.2 — Matriz feature-por-feature contra SEMSEproject: EXISTS / PARTIAL / GAP. Hipótesis principal de gap: agenda inteligente (reprogramación, sincronización calendarios externos, optimización de rutas).
- [ ] F5.3 — Informe `docs/specs/SEMSE_CONNECT_OKCOMPUTER_AUDIT.md` con recomendación por gap: extraer / reimplementar / descartar. NO se migra código en esta fase.
- [ ] F5.4 — Commit + push + **PR de F5** (docs only). Marcar programa COMPLETADO y detener el loop.

---

## Protocolo del loop (cada iteración)

1. `cd /home/yoni/semse-worktrees/semse-connect-sdd/project-manager-app && git fetch origin`
2. Leer este documento. Tomar la **primera tarea sin marcar** en orden F1→F5.
3. Ejecutarla según el spec que gobierna su fase. Releer el spec de la fase al entrar en ella.
4. Validar: `pnpm spec:validate` siempre — criterio: **cero errores NUEVOS respecto al baseline de main** (main ya trae 17 errores preexistentes en satellites/rbac/readiness/tools que NO son de este programa); typecheck/tests del área tocada según la tarea.
5. Commit atómico en `feat/semse-connect-sdd` (o rama de fase, ver regla 7) marcando `[x]` la tarea en este documento **en el mismo commit**.
6. Si la tarea cierra una fase: push + `gh pr create` hacia `main` con el resumen de la fase.
7. Ramas: F1 va en `feat/semse-connect-sdd`. Cada fase siguiente: si la PR anterior ya se mergeó, rama nueva off `origin/main`; si no, continuar apilando sobre la rama anterior y anotar la dependencia en el cuerpo de la PR.
8. **Condiciones de parada del loop:** (a) todas las tareas `[x]`; (b) bloqueo que requiere decisión del usuario (p.ej. F4.1); (c) 3 fallos consecutivos en la misma tarea. En cualquier caso: reportar estado y detener.
9. Nunca commitear en `main` ni tocar el checkout principal (`/home/yoni/project-manager-app`, que puede tener otra terminal activa).

## Registro de iteraciones

| # | Fecha | Tarea | Resultado |
|---|-------|-------|-----------|
| 1 | 2026-07-07 | F1.1–F1.4 | Fase F1 completa: taxonomía creada, README enlazado, OKComputer localizado en `apps/assistant-portal/`, PR abierta |
