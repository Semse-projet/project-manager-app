---
type: plan
feature: "conversation-intelligence-foundation"
domain: "prometeo"
spec: "docs/specs/prometeo/conversation-intelligence-foundation.spec.md"
version: "1.0"
status: "REVIEW"
branch: "feat/conversation-intelligence-foundation"
date: "2026-10-02"
---

# Plan técnico: Conversation Intelligence Foundation

## 1. Objetivo
Convertir conversaciones de assistant/web chat en una fuente canónica, recuperable y auditable sobre `CommunicationThread` / `Communication`, manteniendo compatibilidad temporal con `ConversationSession.messages`.

La entrega prepara provenance, `SourceRef` y `correlationId` para un futuro Decision Intelligence Engine, sin implementar todavía Decision Ledger, aprobaciones ni ejecución.

## 2. Principios
- Reutilizar comunicaciones canónicas; no crear otra tabla genérica de mensajes.
- Expand/contract y flags OFF por defecto.
- Tenant isolation en cada lectura y escritura.
- Raw source primero; memoria, findings y decisiones son derivados.
- Hecho != finding != propuesta != decisión != acción != outcome.
- Ningún finding autoriza acciones.
- Rollback por flag; datos canónicos escritos se preservan y se corrigen hacia adelante.

## 3. Waves

### Wave 0 — contratos y pruebas primero
1. Confirmar schema actual de `ConversationSession`, `CommunicationThread` y `Communication`.
2. Definir `SourceRef`, `IntelligenceFinding` y propagación de `correlationId`.
3. Añadir tests fallando para mapping, orden estable, idempotencia, tenant isolation y fact/finding separation.
4. Confirmar policy/resource scope reutilizable por Prometeo.

### Wave 1 — persistencia aditiva
1. Añadir `sequence`, `occurredAt` y `contentHash` nullable a `Communication`.
2. Crear migración versionada e índices requeridos.
3. Implementar mapping idempotente Session -> Thread/Communication.
4. Implementar dual-write detrás de `SEMSE_CONVERSATION_INTELLIGENCE_MODE`.

### Wave 2 — backfill y equivalencia
1. Backfill por tenant y lotes.
2. Reintentos seguros usando external IDs/contentHash.
3. Comparar legacy vs canónico en shadow.
4. Emitir métricas de processed/mismatch/failure sin bodies completos.

### Wave 3 — retrieval V1
1. Filtros exactos de scope.
2. Literal/subcadena case-insensitive.
3. PostgreSQL FTS con configuración `simple`.
4. Ranking y desempate deterministas.
5. Sin embeddings obligatorios ni pg_trgm en V1.

### Wave 4 — Prometeo tools
Registrar con governance existente:
- `conversations.count`
- `conversations.search`
- `conversations.get`
- `conversations.context`
- `conversations.audit`
- `conversations.compare`

Todos heredan scope del actor y retornan provenance.

### Wave 5 — rollout
1. `off`: comportamiento legacy.
2. `shadow`: dual-write + comparación sin cambiar respuesta.
3. `canary`: reads canónicos solo para tenants configurados.
4. `live`: lectura canónica general.
5. Retiro del JSON legacy queda para slice posterior.

## 4. Integraciones previstas
DB:
- `packages/db/prisma/schema.prisma`
- migración versionada aditiva

API:
- `apps/api/src/modules/assistant/assistant.service.ts`
- `apps/api/src/modules/communications/communications.repository.ts`
- `apps/api/src/modules/communications/communications.service.ts`

Prometeo:
- `apps/api/src/modules/prometeo/prometeo-tool-registry.ts`
- `apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts`
- `apps/api/src/modules/prometeo/prometeo.module.ts`

## 5. Validaciones
- unit/integration tests del mapping y retrieval
- backfill ejecutado dos veces sin duplicados
- cross-tenant/cross-org denied
- flag OFF mantiene compatibilidad
- `spec:validate:strict`
- typecheck/build/tests relevantes
- migración reproducible
- smoke autenticado en canary

## 6. Criterio de cierre
No marcar VERIFIED hasta tener CI verde, merge SHA, deployment terminal, canary autenticado y evidencia sin secretos. Esta prioridad puede quedar APPROVED/implemented independientemente de que Decision Intelligence aún no exista.
