# AGENTS.md — SEMSE OS

> Este archivo es leído automáticamente por Claude Code y otros agentes IA al inicio de cada sesión.
> Establece el contrato de colaboración entre el agente y el proyecto.
> Spec Kit integration: https://github.com/github/spec-kit

---

## Identidad del Proyecto

**Proyecto:** SEMSEproject — Sistema Operativo de Servicios Especializados
**Dominio:** Ecosistema modular para servicios, construcción, Agro y operación con IA
**Stack:** NestJS · Next.js · Prisma · PostgreSQL · BullMQ · Railway · Ollama
**Repositorio:** `Semse-projet/project-manager-app`
**Raíz canónica de desarrollo:** `project-manager-app/`
**Deploy activo:** Railway (API + Web + Worker)

---

## Lectura Obligatoria al Inicio de Sesión

En orden de prioridad:

1. `.specify/memory/constitution.md` — Principios que gobiernan TODO
2. `docs/SPEC_INDEX.md` — Qué specs existen, cuál es su estado, qué falta
3. `docs/SOURCE_OF_TRUTH.md` — Dónde vive cada capa del sistema
4. `docs/foundation/DOMAIN_INVARIANTS.md` — Reglas que no se violan

Si la sesión es de feature coding, también leer:
5. `docs/architecture/SEMSE_API_SURFACE_V1.md` — Endpoints existentes
6. `docs/foundation/STATE_MACHINES.md` — FSMs del dominio
7. `docs/foundation/EVENT_CATALOG.md` — Eventos disponibles

---

## Flujo SDD Disponible

Usar la secuencia completa. No saltear pasos. Spec Kit puede aparecer como
slash commands, skills o no estar instalado en la superficie actual. Si el
comando no existe, producir el mismo artefacto desde las plantillas SEMSE.

| Etapa | Acción | Output |
|---------|--------|--------|
| constitution | Leer/actualizar constitución | `.specify/memory/constitution.md` |
| specify + clarify | Crear y cerrar ambigüedades | `docs/specs/[dominio]/[feature].spec.md` |
| plan | Generar plan técnico | `docs/specs/[dominio]/[feature].plan.md` |
| tasks | Convertir plan en tareas | `docs/specs/[dominio]/[feature].tasks.md` |
| analyze | Verificar consistencia spec↔plan↔tasks↔constitución | Reporte de gaps |
| checklist | Verificar calidad y delivery gates | `docs/specs/[dominio]/[feature].checklist.md` |
| implement | Implementar sólo desde spec aprobado | Código en `apps/` o `packages/` |
| validate + deliver | Tests, CI, merge, deploy, canary y evidencia | Metadata SDD 2.0 + reporte |

Templates SEMSE: `.specify/templates/overrides/`
- `semse-spec.md` — Template de spec con campos SEMSE obligatorios
- `semse-plan.md` — Template de plan técnico
- `semse-tasks.md` — Template de tareas por fases
- `semse-checklist.md` — Gates de seguridad, datos y producción

---

## Flujo Obligatorio para Features Nuevos

```
NO HACER:  "Implementa el endpoint de pagos"
SÍ HACER:
  1. specify → crear docs/specs/api/payments.spec.md
  2. Revisar spec contra STATE_MACHINES.md y DOMAIN_INVARIANTS.md
  3. plan    → crear docs/specs/api/payments.plan.md
  4. tasks   → crear docs/specs/api/payments.tasks.md
  5. Escribir tests (T-002 antes de código)
  6. implement → generar código
  7. Correr tests + pnpm spec:validate:strict
  8. checklist → verificar completitud
  9. Separar CI, merge, deploy y activación en metadata SDD 2.0
  10. Crear reporte en docs/reportes/
```

---

## Reglas de Comportamiento del Agente

### SIEMPRE
- Leer el spec del dominio antes de generar código
- Verificar que los endpoints existan en `SEMSE_API_SURFACE_V1.md`
- Respetar `DOMAIN_INVARIANTS.md` — no inventar transiciones de estado
- Emitir eventos de audit para cambios materiales (ver `EVENT_CATALOG.md`)
- Crear reporte al final de sesiones de implementación
- Preguntar antes de acciones destructivas

### NUNCA
- Generar código sin spec aprobado para el dominio
- Usar `git add .` o commits masivos sin revisión de estado
- Exponer o copiar valores de `.env`
- Ejecutar `--force`, `reset --hard`, `drop table` sin confirmación explícita
- Instalar dependencias globales sin autorización
- Modificar `packages/db/prisma/schema.prisma` sin migración planificada
- Inventar nombres de eventos fuera de `EVENT_CATALOG.md`
- Tocar lógica de Railway, CI/CD o variables de entorno de producción

---

## Estructura del Monorepo

```
project-manager-app/
├── .specify/                    ← Spec Kit governance
│   ├── memory/constitution.md   ← Constitución del sistema
│   └── templates/overrides/     ← Templates SEMSE personalizados
├── apps/
│   ├── api/                     ← NestJS backend
│   ├── web/                     ← Next.js frontend
│   └── worker/                  ← BullMQ worker
├── packages/
│   ├── db/                      ← Prisma schema (fuente de verdad de datos)
│   ├── schemas/                 ← Zod schemas (contratos de API)
│   ├── agents/                  ← Sistema de agentes
│   ├── auth/                    ← Autenticación
│   ├── knowledge/               ← RAG / Knowledge base
│   └── ui/                      ← Componentes compartidos
├── docs/
│   ├── SPEC_INDEX.md            ← Índice de todos los specs ← LEER PRIMERO
│   ├── SOURCE_OF_TRUTH.md       ← Fuentes canónicas por capa
│   ├── specs/                   ← Specs activos por dominio
│   ├── foundation/              ← Dominio, FSM, invariantes, eventos
│   ├── architecture/            ← API surface, blueprint
│   ├── vision/                  ← Visión y principios
│   ├── constitution/            ← Constitución detallada
│   └── reportes/                ← Historial de sesiones
├── AGENTS.md                    ← Este archivo
└── SPEC_INDEX.md (link)         → docs/SPEC_INDEX.md
```

---

## Spec Kit — Integración SEMSE

**Framework:** GitHub Spec Kit (https://github.com/github/spec-kit)
**Modo:** Brownfield — integración documental sin CLI (Fase 0)
**CLI:** `specify` — instalar solo cuando el equipo lo decida (`pip install specify`)
**Preset:** SEMSE — templates en `.specify/templates/overrides/`

**Campos adicionales obligatorios en specs SEMSE** (vs template estándar de Spec Kit):
- `privacyCritical` — routing a Ollama local
- `auditLog` — evento audit requerido
- `sse` — emisión SSE real-time
- `fsmTransicion` — transición de estado machine
- `paymentGovernance` — impacto en escrow/pagos

---

## Dominios Activos y Sus Specs

Los estados no se duplican en este archivo porque cambian con cada ciclo SDD.
La unica matriz vigente es `docs/SPEC_INDEX.md`, regenerada con
`pnpm spec:index`. Antes de implementar:

1. localizar el spec del bounded context en ese indice;
2. confirmar que su estado autoriza implementacion;
3. revisar contratos, tests, delivery metadata y `last_verified`;
4. detenerse y completar el flujo SDD si el spec está `DRAFT` o `REVIEW`;
5. no inferir activación desde código, merge, deploy o healthcheck.
