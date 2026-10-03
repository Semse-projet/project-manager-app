---
id: "prometeo.conversation-intelligence"
title: "Conversation Intelligence Foundation"
domain: "prometeo"
sdd_version: "2.0"
version: "1.0"
status: "REVIEW"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: ["SEMSE_CONVERSATION_INTELLIGENCE_MODE", "SEMSE_CONVERSATION_INTELLIGENCE_CANARY_TENANT_IDS"]
production_evidence: []
related_files: ["packages/db/prisma/schema.prisma", "apps/api/src/modules/assistant/assistant.service.ts", "apps/api/src/modules/communications/communications.repository.ts", "apps/api/src/modules/communications/communications.service.ts", "apps/api/src/modules/prometeo/prometeo-tool-registry.ts", "apps/api/src/modules/prometeo/prometeo.module.ts", "apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts"]
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
last_verified: "2026-10-02"
---

# Spec: Conversation Intelligence Foundation

## 1. Problema y resultado

Prioridad 1 del circuito SEMSE:
`Conversation -> Memory -> Decision -> Policy -> Approval -> Action -> Evidence -> Outcome -> Learning`.

Hoy el Conversational Project Builder conserva historial en `ConversationSession.messages` como JSON. Eso sirve al flujo actual, pero no permite enumerar, buscar, reconstruir, citar ni auditar conversaciones completas de forma canónica. SEMSE ya consolidó comunicaciones en `CommunicationThread` / `Communication`; no se crea otra familia de mensajes.

Resultado: Prometeo puede contar, buscar, recuperar, reconstruir, comparar y auditar conversaciones autorizadas con provenance hasta el mensaje original. El mensaje crudo es fuente de verdad; memoria, grafo, decisiones y hallazgos son derivados.

## 2. Alcance

### Incluido
- Converger assistant/web chat hacia `CommunicationThread` / `Communication`.
- Mantener `ConversationSession` temporalmente para compatibilidad.
- Dual-write temporal y backfill idempotente.
- Orden explícito de mensajes del assistant.
- Búsqueda PostgreSQL determinista V1: literal + full-text lexical.
- Tools Prometeo: `conversations.count`, `search`, `get`, `context`, `audit`, `compare`.
- Provenance a `Communication.id` y `CommunicationThread.id`.
- Tenant/resource isolation.
- Rollout `off -> shadow -> canary -> live`.

### Fuera de alcance
- Nueva tabla genérica `ConversationMessage`.
- Operational Memory Graph.
- Decision Ledger.
- Auto-escritura de memoria/decisiones/evidencia desde findings.
- Cross-tenant retrieval.
- Inferir orgId, timestamps o actor legacy no demostrados.
- Sustituir Graphify.

## 3. Seguridad y límites

- tenantId obligatorio en toda consulta/escritura.
- orgId legacy sólo se llena con relación inequívoca; si no, queda null.
- Reutilizar ResourceScopeResolver/policy canónica; no crear autorizador paralelo.
- V1 es read/audit; no ejecuta acciones críticas.
- No registrar bodies completos en logs.
- Prometeo hereda el scope del actor y no puede elevarlo.

## 4. Criterios de aceptación

### Enumerar
DADO actor autorizado, CUANDO `conversations.count`, ENTONCES devuelve sólo el conteo de su scope.

### Buscar
DADO mensajes canónicos, CUANDO `conversations.search`, ENTONCES devuelve matches con `threadId`, `messageId`, snippet y provenance.

### Recuperar
DADO un thread autorizado, CUANDO `conversations.get`, ENTONCES devuelve todos los mensajes en orden estable sin inventar timestamps faltantes.

### Auditar/Comparar
DADO conversaciones autorizadas, CUANDO `audit` o `compare`, ENTONCES devuelve findings estructurados con `sourceMessageIds` y no modifica datos.

### Aislamiento
Un actor de tenant A nunca puede leer contenido de tenant B.

Casos borde:
- retry dual-write no duplica;
- backfill repetido es idempotente;
- legacy sin orgId conserva null;
- legacy sin timestamp individual conserva occurredAt null;
- búsqueda vacía no inventa fallback;
- shadow compara legacy vs canónico sin cambiar respuesta del usuario.

## 5. Contrato de persistencia

Assistant/web chat:
- `CommunicationThread.channel = WEB_CHAT`
- `source = "assistant"`
- `externalThreadId = "assistant:&lt;ConversationSession.id&gt;"`
- `contactUserId = ConversationSession.userId`
- `orgId` sólo si es verificable.

Extender `Communication` aditivamente:
```ts
sequence: number | null
occurredAt: Date | null
contentHash: string | null
```

Backfill:
- `externalMessageId = "assistant:&lt;sessionId&gt;:&lt;sequence&gt;"`
- `sequence` conserva índice original.
- `occurredAt = null` si la fuente no tiene tiempo por mensaje.
- metadata legacy mínima va en `rawPayloadJson`, sin duplicar body.

## 6. Retrieval V1

1. filtros exactos tenant/thread/user/project/job;
2. frase/subcadena case-insensitive;
3. PostgreSQL Full Text Search con configuración `simple` para corpus bilingüe;
4. ranking lexical determinista y desempate estable.

`pg_trgm` queda backlog para typo-tolerance si métricas lo justifican.

## 7. Datos y migración

- No crear tabla paralela de mensajes.
- Migración aditiva y nullable.
- Índice `(tenantId, threadId, sequence)`.
- Índice lexical para body según SQL final.
- Expand/contract:
  1. expand schema/indexes;
  2. dual-write shadow;
  3. backfill por tenant/lotes;
  4. verificar equivalencia;
  5. canary reads canónicos;
  6. live;
  7. retirar dependencia JSON en slice posterior.
- Rollback: flag a off y lectura legacy.
- Datos canónicos ya escritos no se borran; forward-fix.
- Nunca `db push` en producción.

## 8. Observabilidad

Métricas:
- dual-write success/failure
- backfill processed
- canonical-vs-legacy mismatch
- search latency p50/p95
- audit latency
- denied cross-scope attempts

Flags:
- `SEMSE_CONVERSATION_INTELLIGENCE_MODE=off|shadow|canary|live`
- `SEMSE_CONVERSATION_INTELLIGENCE_CANARY_TENANT_IDS`

## 9. Tests requeridos

- mapping Session -> canonical
- stable sequence/contentHash
- deterministic search
- audit/compare sourceMessageIds
- dual-write idempotente
- backfill dos veces sin duplicados
- cross-tenant/cross-org
- flag off/shadow compatibility
- migration backward-compatible
- Prometeo ResourceScope
- canary smoke autenticado

## 10. Implementación

API:
- `apps/api/src/modules/assistant/assistant.service.ts`
- `apps/api/src/modules/communications/communications.repository.ts`
- `apps/api/src/modules/communications/communications.service.ts`

Prometeo:
- `apps/api/src/modules/prometeo/prometeo-tool-registry.ts`
- `apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts`
- `apps/api/src/modules/prometeo/prometeo.module.ts`

DB:
- `packages/db/prisma/schema.prisma`
- migración versionada aditiva.

## 11. Investigación externa

1. Graphiti Adding Episodes — https://help.getzep.com/graphiti/core-concepts/adding-episodes
2. Graphiti Overview — https://help.getzep.com/graphiti/getting-started/overview
3. PostgreSQL Text Search — https://www.postgresql.org/docs/current/functions-textsearch.html
4. PostgreSQL pg_trgm — https://www.postgresql.org/docs/17/pgtrgm.html

Aplicado ahora:
- raw message first -> derived knowledge later;
- provenance a la fuente;
- lexical retrieval determinista antes de semantic/graph retrieval.

Backlog:
- hybrid semantic retrieval;
- pg_trgm si métricas lo justifican;
- Operational Memory Graph;
- bridge con Graphify.

Descartado V1:
- nuevo graph DB;
- embeddings obligatorios;
- nueva familia paralela de mensajes.

## 12. Gates

- [ ] statusAPPROVED antes de código
- [ ] spec indexado
- [ ] plan/tasks/checklist coherentes
- [ ] tests antes del código
- [ ] spec:validate:strict verde
- [ ] migración reproducible
- [ ] shadow sin divergencias materiales
- [ ] CI PASS
- [ ] merge SHA registrado
- [ ] deployment terminal
- [ ] canary autenticado
- [ ] evidencia sin secretos
- [ ] sólo entonces VERIFIED

## 13. Preparación para Decision Intelligence

Conversation Intelligence es la capa de observación y recuperación; no es la autoridad de decisión. Debe producir contexto verificable que pueda ser consumido por un futuro Decision Intelligence Engine sin acoplarse a su persistencia ni promover inferencias a decisiones.

Reglas:
- Todo hecho o hallazgo derivado debe conservar referencias a fuentes canónicas.
- Ningún finding se convierte automáticamente en decisión, aprobación, acción o evidencia.
- Una decisión futura debe poder reconstruir qué mensajes y hallazgos la precedieron.
- `correlationId` debe propagarse de punta a punta cuando exista contexto correlacionable; se reutiliza la convención canónica del sistema y no se crea un identificador paralelo.
- Ausencia de `projectId`, `jobId`, `actorId`, `orgId` o tiempo verificable se representa como `null`; nunca se infiere para completar trazabilidad.

Separación semántica obligatoria:
1. **Fact**: observación directamente sustentada por una fuente.
2. **Finding**: conclusión analítica derivada de uno o más facts/source refs.
3. **Proposal**: alternativa sugerida; no autorizada.
4. **Decision**: elección autorizada por la capa futura de Decision Intelligence o por humano competente.
5. **Action**: ejecución causada por una decisión autorizada.
6. **Outcome**: resultado observado después de la acción.

Conversation Intelligence V1 puede devolver facts/findings y comparaciones; no persiste Decision, Action ni Outcome.

## 14. Contrato común de provenance

```ts
type SourceRef = {
  tenantId: string;
  sourceType: "communication" | "thread";
  sourceId: string;
  threadId: string | null;
  messageId: string | null;
  actorId: string | null;
  projectId: string | null;
  jobId: string | null;
  occurredAt: string | null;
};

type IntelligenceFinding = {
  kind: "fact" | "finding";
  summary: string;
  sourceRefs: SourceRef[];
  correlationId: string | null;
  confidence: number | null;
};
```

Reglas del contrato:
- `sourceRefs` nunca queda vacío para findings derivados de conversaciones.
- `confidence` expresa incertidumbre analítica; no autoridad.
- `correlationId` sirve para encadenar conversación -> finding -> futura decisión -> acción -> outcome.
- El mensaje canónico sigue siendo la fuente de verdad; el derived object no duplica el body completo.
- IDs y timestamps deben provenir de datos existentes, no de inferencia.

## 15. Handoff hacia el futuro Decision Intelligence Engine

La prioridad 2 podrá consumir:
- `threadId` / `messageId`;
- `SourceRef[]`;
- `correlationId`;
- findings estructurados;
- contexto reconstruido con autorización ya aplicada.

No podrá asumir que un finding equivale a aprobación o decisión. Cualquier promoción a Proposal/Decision deberá pasar por contratos de autoridad, política, aprobación y audit trail propios de esa capa.

Criterios de preparación adicionales:
- [ ] SourceRef probado con tenant isolation.
- [ ] correlationId propagado sin inventar valores legacy.
- [ ] audit/compare distinguen fact vs finding.
- [ ] ningún tool de Conversation Intelligence escribe Decision/Action/Outcome.
- [ ] provenance permite reconstrucción hasta Communication original.
