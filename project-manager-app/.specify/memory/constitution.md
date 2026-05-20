---
version: "1.0"
project: "SEMSE OS"
ratified: "2026-05-20"
amended: "2026-05-20"
authority: "Arquitecto Principal"
spec_index: "docs/SPEC_INDEX.md"
source_of_truth: "docs/SOURCE_OF_TRUTH.md"
---

# SEMSE OS — Constitución del Sistema

> Este archivo es la fuente de verdad para cualquier agente IA que trabaje en SEMSE OS.
> Leer completo antes de generar código, specs o planes.
> Referencia completa: `docs/constitution/` y `docs/vision/`

---

## Principio 1 — Spec Antes que Código

**Ningún feature existe si no tiene spec aprobado.**

- El flujo es: `constitution → specify → plan → tasks → implement`
- El chat produce el spec. El spec produce el código.
- No se genera código sin leer el spec del dominio en `docs/SPEC_INDEX.md`
- No se agrega un endpoint sin que exista en `docs/architecture/SEMSE_API_SURFACE_V1.md`
- No se modifica una entidad sin verificar `docs/foundation/DOMAIN_INVARIANTS.md`

Referencia: `docs/vision/VISION_DECISIONS_LOCKED.md`

---

## Principio 2 — Evidencia Primero, Pago Después

**Ningún pago se libera sin evidencia validada.**

- El flujo monetizable canónico es: `job → bid → contract → escrow → milestone → evidencia → aprobación → pago`
- Un milestone en estado `PENDING_REVIEW` requiere evidencia antes de que el cliente pueda aprobar
- El escrow solo se libera cuando: `milestone.status = APPROVED AND evidence.status = ACCEPTED`
- Payment Governance es obligatorio: ningún agente libera fondos sin pasar por el harness de pagos
- Los estados de Milestone, Escrow y Payment están gobernados por `docs/foundation/STATE_MACHINES.md`

Referencia: `docs/foundation/ESCROW_PAYMENTS_EVIDENCE_BOUNDARIES.md`

---

## Principio 3 — Audit Log para Todo Cambio Material

**Todo cambio de estado sensible produce un evento auditado.**

- Formato de evento: `aggregate.action` (ejemplo: `milestone.approved`, `payment.released`)
- Payload mínimo obligatorio: `eventId`, `eventType`, `aggregateId`, `actorType`, `actorId`, `timestamp`, `requestId`
- Los eventos viven en `docs/foundation/EVENT_CATALOG.md` — no inventar eventos fuera del catálogo
- SSE (Server-Sent Events) es el canal de notificación real-time para estado operativo
- Si una acción no produce evento ni audit log, está incompleta

Referencia: `docs/foundation/EVENT_CATALOG.md`

---

## Principio 4 — Privacidad Local por Defecto

**Los datos sensibles de construcción se procesan localmente.**

- Ollama es el LLM por defecto para rutas marcadas `privacyCritical: true`
- Las rutas que contienen PII, documentos de contrato, datos financieros o evidencia de obra se marcan `privacyCritical`
- Cloud LLMs (OpenAI, Anthropic) se usan para: RAG público, asistencia general, resúmenes no sensibles
- No se envía contenido de contratos ni datos de pago a APIs externas sin consentimiento explícito
- El routing de LLM está documentado en `docs/ai-orchestration.md`

Referencia: `docs/vision/VISION_DECISIONS_LOCKED.md` — decisión "Local LLM para datos sensibles"

---

## Principio 5 — Tests Derivados del Spec

**El test es el spec ejecutable. No hay código sin test.**

- Cada spec de API genera un archivo de test antes de implementar
- El test cubre: happy path, error paths (400/403/404/409), efectos secundarios (eventos, audit)
- Los tests de FSM cubren: cada transición, cada guard, cada estado terminal
- No se considera un feature completo hasta que sus tests pasen en CI
- La cobertura mínima de rama es 80% para módulos nuevos

Referencia: `docs/foundation/DOMAIN_MODEL_MVP.md`

---

## Restricciones Técnicas (No Negociables)

### Stack canónico
- **Backend:** NestJS · TypeScript · Prisma · PostgreSQL · BullMQ
- **Frontend:** Next.js · TypeScript · Tailwind · Radix UI
- **Deploy:** Railway (API, Web, Worker) · Docker
- **LLM local:** Ollama (privacyCritical) · OpenAI/Anthropic (público)
- **Monorepo:** pnpm workspaces (`apps/*`, `packages/*`)

### Fuentes de verdad por capa
| Capa | Fuente canónica |
|------|----------------|
| Schema de datos | `packages/db/prisma/schema.prisma` |
| Tipos y contratos | `packages/schemas/src/` |
| API REST | `apps/api/src/modules/` |
| Frontend | `apps/web/` |
| Componentes UI | `packages/ui/` |
| Auth | `packages/auth/` |

### Reglas de arquitectura
- No duplicar lógica entre módulos
- No crear módulos sin spec aprobado
- No exponer secretos en código ni commits
- No usar `git add .` en commits masivos
- No instalar dependencias globales sin decisión de equipo
- No crear endpoints sin declararlos en `SEMSE_API_SURFACE_V1.md`
- No cambiar estados de dominio sin respetar `STATE_MACHINES.md`

---

## Contratos de Agente IA

Todo agente IA (Claude, Codex, Copilot, etc.) que trabaje en SEMSE debe:

1. **Leer primero:** `docs/SPEC_INDEX.md` → `docs/SOURCE_OF_TRUTH.md` → spec del dominio
2. **Verificar:** ¿Existe spec para este feature? Si no → crear spec antes de código
3. **Respetar:** `docs/foundation/DOMAIN_INVARIANTS.md` — invariantes no se violan
4. **Consultar:** `docs/foundation/STATE_MACHINES.md` antes de cualquier cambio de estado
5. **Registrar:** Todo endpoint nuevo en `docs/architecture/SEMSE_API_SURFACE_V1.md`
6. **No ejecutar:** Comandos destructivos (`--force`, `reset --hard`, `drop`) sin confirmación
7. **Reportar:** Crear reporte en `docs/reportes/` después de sesiones de implementación

---

## Flujo SDD Operativo

```
1. /speckit.constitution   → Este archivo. Leer al inicio de cada sesión.
2. /speckit.specify        → Crear spec en docs/specs/<dominio>/<feature>.spec.md
3. /speckit.plan           → Crear plan técnico en docs/specs/<dominio>/<feature>.plan.md
4. /speckit.tasks          → Crear tareas en docs/specs/<dominio>/<feature>.tasks.md
5. /speckit.analyze        → Verificar consistencia spec ↔ plan ↔ código existente
6. /speckit.implement      → Solo entonces: generar/modificar código
7. /speckit.checklist      → Verificar completitud antes de merge
```

Templates para cada comando: `.specify/templates/overrides/`

---

## Gobernanza de esta Constitución

- **Versión:** 1.0
- **Ratificada:** 2026-05-20
- **Enmiendas:** Requieren actualizar `version` y `amended` en el frontmatter
- **Autoridad:** Arquitecto Principal del proyecto
- **Propuestas de cambio:** Documentar en `docs/vision/VISION_CHANGE_PROTOCOL.md`
- **Decisiones inamovibles:** Ver `docs/vision/VISION_DECISIONS_LOCKED.md`
