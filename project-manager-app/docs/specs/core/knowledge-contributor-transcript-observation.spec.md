---
id: "core.knowledge-contributor-transcript-observation"
title: "Field Knowledge Contributor Program — Transcript + Observation (PR-5)"
domain: "core"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "medium"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "apps/api/src/modules/contributor-program/contributor-program.service.ts"
  - "apps/api/src/modules/contributor-program/contributor-program.repository.ts"
  - "packages/db/prisma/schema.prisma"
related_tests:
  - "apps/api/test/contributor-program.service.test.ts"
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-09-17"
---

# Spec: Field Knowledge Contributor Program — Transcript + Observation (PR-5)

> Contrato ejecutable SDD 2.0. Completar todas las secciones aplicables y
> cambiar `status` a `APPROVED` antes de implementar. Código, CI, merge,
> deploy y activación se registran por separado; un deploy no demuestra
> activación ni verificación funcional.

**Aprobación:** el dueño del producto (repo owner, vía instrucción explícita
en sesión, 2026-09-17: "Completa entonces crea lo que hace falta, aborda por
completo todo lo que hace falta") autorizó proceder con el modelo de datos,
la API de lectura/corrección y el worker (en su forma honesta descrita en
§2/§11) sin esperar una ronda de revisión por PR separada — la aprobación es
la propia instrucción del dueño, registrada acá para trazabilidad. Esto NO
resuelve la pregunta de §11 (proveedor de ASR): esa sigue siendo una decisión
de privacidad/costo explícitamente fuera de este alcance, y el worker
implementado en este slice se comporta exactamente como el spec ya
especificaba para el caso sin proveedor — `PENDING → PROCESSING → FAILED`
con razón `ASR_PROVIDER_NOT_CONFIGURED`, nunca un transcript fabricado.

**Nota de origen:** este es el primer spec formal de este programa. El slice
anterior (F1: misiones, consentimiento, entrega multi-clip, revisión, reward —
PR #627, PR-2, PR-3, PR-4) se implementó por el camino ad-hoc de
`docs/reportes/` en vez del flujo `specify → plan → tasks` completo de
`AGENTS.md`, precedente que este documento no repite. Un comentario existente
en `contributor-program.service.ts` (`submitSubmission`, línea ~462) cita
`docs/specs/core/knowledge-contributor-program` como spec de referencia para
la decisión de no fabricar datos de extracción — ese archivo nunca existió.
Este spec es, hasta donde se pudo confirmar por ZOOM en esta sesión, la
primera vez que esa referencia queda satisfecha (para el slice de
transcript/observation específicamente; el resto del programa sigue sin spec
formal).

## 0. ZOOM — estado real encontrado antes de escribir este spec

Cadena completa rastreada (no solo "el modelo existe"):

| Capa | Estado | Evidencia |
|---|---|---|
| Prisma model `KnowledgeExtraction` | EXISTING | `packages/db/prisma/schema.prisma`, migración `20260916021251_knowledge_contributor_program` |
| Creación de fila al enviar (`submitSubmission`) | EXISTING (parcial) | Por cada asset VIDEO/AUDIO, crea una fila `kind: TRANSCRIPTION, status: PENDING` — `contributor-program.service.ts:463-476` |
| Procesamiento real (ASR, NER, segmentación) | ABSENT | Ningún job de worker, ningún adapter de IA; el propio comentario del código lo dice explícitamente: "No video/audio ML model is wired up yet" |
| Lectura de extracciones vía API | ABSENT | `createExtraction` no tiene contraparte `list`/`find` en el repository; no hay `extraction` en `contributor-program.schema.ts`; ningún controller expone estos datos — son de solo escritura hoy |
| UI de revisión mostrando transcript/observación | ABSENT | `admin/contributors/submissions` (verificado en PR-2) no referencia extracciones |
| Modelo `TranscriptSegment` (timestamps, texto) | ABSENT | No existe como concepto separado — `KnowledgeExtractionKind.SEGMENTATION` es un valor de enum sin ninguna fila que lo use nunca |
| Modelo `Observation` (OBJECTIVE→CONDITION→DECISION→REASON→METHOD→ACTION→RESULT) | ABSENT | No existe ningún modelo, tipo o campo con este concepto en el repo |
| Distinción TRANSCRIPT vs OBSERVATION vs HYPOTHESIS vs VERIFIED FACT | DESIGNED_ONLY | Only as prose in the uploaded program report; no code enforces or even represents this taxonomy today |

**Clasificación de la capacidad completa "Transcript + Observation": ABSENT**,
con un único punto real de EXISTING (la fila `PENDING` al enviar, que hoy no
lleva a ningún lado observable).

## 1. Problema y resultado

**Para quién:** revisor humano (`contributor-program:manage`) que aprueba/
rechaza entregas; en última instancia, Prometeo/RAG (PR-8) que necesita
conocimiento citable con procedencia.

**Problema:** un contribuidor envía clips de video/audio explicando cómo hizo
un trabajo, pero SEMSE no produce ningún texto, segmento con marca de tiempo
ni observación estructurada a partir de ellos. El revisor humano debe mirar
el video crudo sin ayuda; no hay forma de citar "a los 2:14 el contribuidor
explica por qué cambió de método" sin volver a ver todo el clip. La fila
`KnowledgeExtraction` que se crea hoy no tiene ningún efecto observable.

**Resultado esperado:** un asset VIDEO/AUDIO enviado obtiene, cuando el
pipeline de extracción corre, segmentos de transcript con marca de tiempo y,
a partir de ellos, observaciones estructuradas — visibles al revisor humano
en `admin/contributors/submissions`, cada una con su nivel de verificación
explícito (nunca silenciosamente promovida de "transcript" a "hecho
verificado").

## 2. Alcance

### Incluido

- Modelo `TranscriptSegment`: texto + rango de tiempo + `assetId`/
  `extractionId`, ligado por `submissionId` para provenance.
- Modelo `Observation`: estructura
  OBJECTIVE→CONDITION→DECISION→REASON→METHOD→ACTION→RESULT, cada campo
  opcional (no todo clip tiene los siete), ligada a uno o más
  `TranscriptSegment` de origen.
- Estado `PROCESSING` agregado a `KnowledgeExtractionStatus` (hoy solo
  `PENDING`/`COMPLETED`/`FAILED` — no hay forma de representar "un worker lo
  está corriendo ahora").
- Endpoints de solo lectura para que el revisor vea transcript/observations
  de una entrega (`contributor-program:manage`).
- Endpoint de corrección humana sobre una `Observation` generada (el revisor
  puede corregir/rechazar un campo, nunca al revés — una corrección humana no
  se sobreescribe automáticamente).
- Un worker job (o proceso manual documentado, ver §11) que consuma filas
  `KnowledgeExtraction` en `PENDING` para `kind: TRANSCRIPTION` y las mueva a
  `PROCESSING`/`COMPLETED`/`FAILED`.

### Fuera de alcance

- **La integración real de ASR (speech-to-text)** — qué proveedor, local vs.
  hosted, costo, privacidad. Ver §11; esto es una decisión humana explícita,
  no una implementación de este spec. Sin ella, el worker de este spec puede
  existir y correr, pero cada extracción terminará en `FAILED` o quedará en
  `PENDING` indefinidamente — comportamiento honesto, no un bloqueo del resto
  del alcance.
- Generación automática de `Observation` vía LLM — depende de que exista un
  transcript real primero.
- Ingesta a Prometeo/RAG (PR-8).
- Grabación nativa móvil, cola offline (PR-3/PR-4 — bloqueados por hardware,
  ver sus reportes).
- Cualquier cambio a `KnowledgeAsset`, `KnowledgeSubmission` o el flujo de
  misión/consentimiento/reward ya entregado.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` (revisor) | `contributor-program:manage` (ya existe en `rbac.ts`) | tenant-scoped, vía `submissionId` | leer transcript/observations de cualquier entrega del tenant; corregir una `Observation` | generar una `Observation` sin un `TranscriptSegment` de origen citado |
| `WORKER`/`PRO` (contribuidor) | `contributor-program:participate` | solo sus propias entregas | leer el transcript/observations de su propia entrega enviada (transparencia) | leer las de otro contribuidor; editar una `Observation` |
| Worker job (`platform`) | interno, sin JWT de usuario (mismo patrón que `driveFromWebhook` en live-sessions) | tenant del `KnowledgeExtraction` que procesa | mover `PENDING → PROCESSING → COMPLETED/FAILED`; crear `TranscriptSegment`/`Observation` en estado `PENDING`/no verificado | marcar una `Observation` como corregida por humano |

- Tenant boundary: toda consulta/mutación exige `tenantId` explícito derivado
  del `submissionId`/`assetId`, igual que el resto del módulo — nunca inferir.
- Ownership/resource policy: mismo patrón que `loadOwnedSubmission` ya
  existente en el servicio.
- Step-up o aprobación humana: la corrección de una `Observation` por un
  revisor es la única escritura humana; nunca automática.
- Datos `privacyCritical`: el contenido de video/audio del contribuidor es
  potencialmente sensible (rostros, voces, ubicaciones de obra). El transcript
  derivado hereda esa sensibilidad — ver §11 sobre routing de IA restringida.
- Requisitos de auditoría: `AuditService.append` en cada transición de
  extracción y cada corrección humana, mismo patrón que el resto del módulo.

## 4. Escenarios y criterios de aceptación

### P1 — El revisor ve un transcript ya procesado

```gherkin
DADO un asset VIDEO con una extracción KnowledgeExtraction en estado COMPLETED
CUANDO un OPS_ADMIN abre la vista de revisión de esa entrega
ENTONCES ve los TranscriptSegment ordenados por tiempo, con su rango
Y ve las Observation derivadas, cada una etiquetada con su nivel
  (observación cruda vs. corregida por humano)
Y un AuditEvent registra la lectura no es necesario, pero cualquier
  corrección sí queda auditada
```

### P2 — El revisor ve un asset aún sin procesar (estado honesto)

```gherkin
DADO un asset VIDEO cuya extracción sigue en PENDING o PROCESSING
CUANDO un OPS_ADMIN abre la vista de revisión
ENTONCES ve un estado explícito ("transcripción pendiente" / "procesando"),
  nunca un transcript vacío sin explicación ni un dato inventado
```

### P3 — Falla del pipeline de extracción

```gherkin
DADO un asset cuya extracción pasó a FAILED (proveedor caído, formato no
  soportado, contenido vacío)
CUANDO el revisor abre la entrega
ENTONCES ve el estado FAILED con la razón, y puede seguir revisando el resto
  de la entrega igual (un fallo de transcript nunca bloquea la revisión
  completa de la entrega)
```

Casos borde:

- [ ] Reintento del worker sobre la misma fila `PENDING` — debe ser
      idempotente (no crear una segunda fila de extracción para el mismo
      asset/kind).
- [ ] Fuente vacía (clip de 0 bytes, ya bloqueado en PR-4) — el worker nunca
      debería recibir esa fila porque el asset nunca se registra vacío, pero
      si la extracción falla por contenido no procesable, cae a `FAILED`, no
      a un reintento infinito.
- [ ] Aislamiento cross-tenant/cross-submission — un `TranscriptSegment`/
      `Observation` de una entrega nunca aparece en la vista de otra, ni
      siquiera del mismo contribuidor.

## 5. Contratos

### API — `GET /v1/contributor-program/admin/submissions/:submissionId/extractions`

```yaml
auth: required
permissions: [contributor-program:manage]
input_schema: { submissionId: string }
output_schema: "KnowledgeExtractionView[] (incluye status, transcriptSegments[], observations[])"
errors:
  400: submissionId inválido
  403: falta contributor-program:manage
  404: entrega no existe o no pertenece al tenant
effects:
  audit_log: no (solo lectura)
  domain_event: none
  sse: none
  payment_governance: n/a
```

### API — `POST /v1/contributor-program/admin/observations/:observationId/correct`

```yaml
auth: required
permissions: [contributor-program:manage]
input_schema: { correctedFields: Record<string, string>, reason: string }
output_schema: "ObservationView (con correctedByUserId/correctedAt poblados)"
errors:
  400: reason vacío (mismo patrón que review de submission, razón obligatoria)
  403: falta contributor-program:manage
  404: observación no existe
  409: observación ya corregida (una corrección no se sobreescribe con otra sin resolver el conflicto explícitamente)
effects:
  audit_log: contributor_program.observation.corrected
  domain_event: none (mismo patrón que el resto del módulo — no usa el outbox)
  sse: opcional, canal contributor:<userId> si se decide notificar al contribuidor
  payment_governance: n/a
```

### UI

```yaml
surfaces: ["apps/web/app/(app)/admin/contributors/submissions"]
states:
  - loading
  - empty (extracción no existe todavía para ningún asset)
  - ready (transcript + observations visibles)
  - forbidden
  - degraded (extracción en PENDING/PROCESSING — ver P2)
  - error (extracción en FAILED — ver P3)
required_behavior:
  - nunca mostrar un transcript vacío sin distinguir "no hay" de "está procesando"
  - la corrección humana de una Observation queda visualmente distinta del dato original
```

### Agente/Prometeo

```yaml
tools: []
input_schema: n/a — fuera de alcance (PR-8 consumirá esto más adelante)
output_schema: n/a
source_citations_required: true
approval_policy: n/a
forbidden_behavior:
  - Prometeo/RAG nunca debe citar una Observation no corregida/aprobada como
    hecho verificado — enforced en PR-8, documentado acá como invariante que
    este spec no debe violar aguas arriba
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: `KnowledgeExtractionStatus` — agregar `PROCESSING`
  entre `PENDING` y `COMPLETED`/`FAILED`. Transición
  `PENDING → PROCESSING → {COMPLETED, FAILED}`, sin retroceso.
- Invariantes: ninguna transición puede saltarse `PROCESSING`; una extracción
  `FAILED` puede reintentarse creando una nueva fila (nunca reescribiendo la
  fallida — mantiene el historial, mismo principio que `ContributorReward`'s
  idempotencia).
- Eventos declarados: **ninguno nuevo en `EVENT_CATALOG.md` todavía** — el
  resto del módulo usa `AuditService`/`SseEventBusService` en vez del
  outbox (ver `semse-domain-events`); este spec sigue ese mismo patrón por
  consistencia, no introduce el primer evento de dominio real del módulo.
- Productor + outbox atómico: n/a (no se usa outbox aquí, ver arriba).
- Consumidores + idempotencia: el worker que consume `PENDING` debe usar
  `SELECT ... FOR UPDATE SKIP LOCKED` o equivalente si corre en más de una
  instancia — **por definir en plan**, no en este spec.
- Replay/rebuild: reintentar una extracción `FAILED` es crear una fila nueva,
  no reproces la vieja.
- DLQ/compensación: extracciones que fallan repetidamente quedan visibles al
  revisor como `FAILED` — no hay cola de reintento automática en este alcance.

## 7. Datos y migración

- Modelos Prisma nuevos: `TranscriptSegment`, `Observation`.
- Modelo modificado: `KnowledgeExtractionStatus` (agregar `PROCESSING`).
- Migración: aditiva únicamente — `CREATE TYPE`/`CREATE TABLE`/`ALTER TYPE
  ... ADD VALUE`, ninguna tabla existente se toca (mismo patrón que
  `20260916021251_knowledge_contributor_program`).
- Estrategia expand/contract: n/a, es expansión pura.
- Backfill: ninguno — las filas `KnowledgeExtraction` `PENDING` existentes
  simplemente no tienen segmentos/observaciones todavía, lo cual es su
  estado real y correcto.
- Compatibilidad hacia atrás: total — no se toca el contrato de
  `contributor-program.schema.ts` existente.
- Verificación de drift: `pnpm verify:prisma-contract:db` (ver
  `semse-ci-pr-workflow`).
- Rollback de código: revertir el PR.
- Rollback/forward-fix de datos: `DROP TABLE` en migración de reversa si
  nunca se activó en producción; si ya corrió el worker, forward-fix
  (marcar extracciones huérfanas como `FAILED`, no borrar el historial).

> Nunca usar `prisma db push` para producción. Una migración aplicada no se
> edita: se restaura el archivo exacto o se reconcilia con el flujo oficial.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: **ninguna definida todavía** — hallazgo real de esta
  sesión: el módulo completo de contributor-program no tiene métricas
  propias hoy (confirmado por ZOOM, no solo asumido). Este spec debería
  definir al menos: extracciones `PENDING` más viejas que N horas,
  tasa de `FAILED`.
- Logs/traces/correlation: reusar `requestId`/`correlationId` ya presentes
  en el resto del módulo.
- Health/readiness: n/a hasta que exista un worker real.
- Feature flags/allowlists: recomendado — un flag que controle si el worker
  de extracción corre en absoluto, para poder desplegar el modelo/API sin
  activar procesamiento real hasta que la decisión de §11 esté resuelta.
- Plan de canary: procesar primero solo las entregas del tenant demo (mismo
  patrón que `isDemo` en missions).
- Evidencia de producción requerida: al menos una extracción real
  `COMPLETED` con transcript legible, verificada a mano por un humano.
- Señal de rollback: tasa de `FAILED` sostenida, o el flag de arriba en off.
- Owner operativo: por asignar.

## 9. Tests requeridos

- [ ] Unitarios del dominio/proyección (transición de estado de extracción)
- [ ] Contrato API/BFF (endpoints de lectura y corrección)
- [ ] Permiso denegado y aislamiento tenant/org (repetir el patrón ya
      probado en `contributor-program-policy.test.ts`)
- [ ] Validación y conflicto de estado (corregir una observación ya
      corregida → 409)
- [ ] Idempotencia/reintento/concurrencia (dos workers no procesan la misma
      fila dos veces)
- [ ] Migración y compatibilidad
- [ ] UI loading/empty/forbidden/degraded/error (los 5 estados de §5)
- [ ] Canary o smoke autenticado en producción

## 10. Mapa de implementación

### API

- `apps/api/src/modules/contributor-program/contributor-program.repository.ts`
  (agregar `listExtractionsForSubmission`, `createTranscriptSegment`,
  `createObservation`, `correctObservation`)
- `apps/api/src/modules/contributor-program/contributor-program.service.ts`
  (endpoints de lectura + corrección)
- `apps/api/src/modules/contributor-program/contributor-program.controller.ts`

### Web

- `apps/web/app/(app)/admin/contributors/submissions/**` (mostrar
  transcript/observations)
- `apps/web/app/api/semse/contributors/**` (BFF, patrón existente)
- `apps/web/app/semse-api.ts`

### Worker/Packages/DB

- `apps/worker/src/main.mjs` (nuevo job, mismo patrón que
  `sweepExpiredLiveSessions`/kill switch)
- `packages/db/prisma/schema.prisma`
- `packages/schemas/src/contributor-program.schema.ts`

### Tests

- `apps/api/test/contributor-program.service.test.ts` (extender)
- Nuevo `apps/api/test/contributor-program-extraction.test.ts` si crece
  demasiado el archivo existente

## 11. Investigación externa

**Pregunta abierta, bloqueante para implementar el worker real (no para el
modelo de datos ni la API de lectura/corrección, que pueden construirse
antes):** ¿qué proveedor de ASR (speech-to-text) usa este pipeline?

- **Ollama local** — es el principio declarado del proyecto ("AI via Ollama
  locally") y preserva privacidad total, pero Ollama en este repo hoy se usa
  para el modelo de texto `qwen2.5:3b` (`dev:api:local-llm`), no para audio;
  un modelo de ASR local (ej. Whisper) es una pieza nueva de infraestructura
  (pesos del modelo, `ffmpeg`, cómputo) no confirmada como disponible en
  Railway hoy.
- **Proveedor hosted (OpenAI Whisper API u otro)** — `OPENAI_API_KEY` está
  configurado en `semse-API` de producción (confirmado solo lectura vía
  Railway en la sesión de PR-3), pero usarlo para audio de campo
  potencialmente sensible (voces, ubicaciones de obra) es una decisión de
  privacidad que contradice el principio declarado del proyecto salvo que un
  humano la autorice explícitamente, y tiene costo real por minuto de audio.

**Reporte con tres búsquedas primarias:** no realizado en esta sesión — es
la primera acción de la fase `plan` una vez que este spec pase a `APPROVED`
y la decisión de proveedor esté tomada, no antes.

- Aplicado ahora: ninguno.
- Backlog: evaluar Whisper local vs. proveedor hosted una vez que el dueño
  del producto decida la postura de privacidad/costo.
- Descartado: nada todavía.

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
