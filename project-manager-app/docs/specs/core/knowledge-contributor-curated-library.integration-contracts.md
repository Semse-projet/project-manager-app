---
type: integration-contract
feature: "knowledge-contributor-curated-library"
spec: "docs/specs/core/knowledge-contributor-curated-library.spec.md"
version: "0.1"
status: "DRAFT"
date: "2026-10-19"
---

# Contratos de integración: Prometeo Knowledge ↔ SEMSE OS

> **DRAFT, SIN CÓDIGO, SIN PUBLICACIÓN.** Anexo técnico del PR #1008 y del issue #992, independiente del PR de seguridad #987 y de la mitigación de agentes #1009 / issue #1007. La ratificación del propietario sólo fija `ORG_PRIVATE` por defecto y un futuro `TENANT_CURATED` opt-in; no reemplaza consentimiento del aportante/titular, aprobación jurídica, técnica, seguridad o staging. Las API/tipos siguientes son **contratos propuestos, no endpoints existentes**.

## 1. Invariantes y arquitectura sin duplicación

- **Sistema de origen:** Evidence, Contributor Program y cada dominio propietario mantienen documentos, fotografías, contratos, IDs de cliente y derechos en sus almacenes **privados**. `ContributorProgramService.setObservationPromotion` y `PROMOTED` son revisión editorial de observación, jamás consentimiento de publicación. `public_training` histórico no acredita licencia.
- **Sistema canónico nuevo:** tablas de biblioteca curada `CuratedKnowledgeEntry`, `CuratedKnowledgeVersion`, `CuratedPublicationConsent`, `CuratedKnowledgeReview`, `CuratedAccessGrant`, más outbox y auditoría; el derivado depurado es físicamente independiente del original. Sus enlaces privados de procedencia sólo los ven auditores autorizados.
- **Índice recuperable:** PostgreSQL FTS sobre versión derivada publicada, local-only para procesamiento privado; embeddings locales opcionales si benchmark demuestra utilidad. No segundo índice global, base de datos paralela ni memoria de agentes con originales. `ConstructionLibraryItem` de Vision queda como catálogo de objetos de plataforma sin relación de ACL heredada.
- **Gobernanza en tiempo de consulta:** `tenantId`, membresía vigente, organización participante, `versionId`, consentimiento, derechos, estado, revisión, audiencias y revocación se verifican **en el mismo SQL** que devuelve texto, fragmentos, títulos, conteos y citas. No preseleccionar IDs autorizados y reutilizarlos después. Caché/índice nunca sustituyen autorización SQL.
- **Sin atajos administrativos:** el contexto del lector viene de sesión firmada o principal de servicio expresamente acreditado, no de cabeceras arbitrarias, evento, modelo, cliente web ni `tenantId` libre; `scope:null` sólo cuando un contrato existente permita admin verificado y nunca por defecto.
- **Capacidad educativa ≠ certificación:** una ficha o cuestionario no verifica destreza real, licencia, inspección, aptitud para trabajos peligrosos ni autorización de pagos. La fuente lleva versión, fecha, especialidad, edición normativa, jurisdicción y advertencia de límites.
- **No publicación, entrenamiento ni pagos por implicación:** ni `PROMOTED`, ni foto, ni evidencia aprobada, ni búsqueda, ni citación, ni `skill review` activan `TENANT_CURATED`, fine-tuning, Marketplace ranking, Change Order, release, rewards o escrow.

## 2. Política de lectura propuesta

| Contenido | Quién lee | Requisitos adicionales |
|---|---|---|
| Fuente original `ORG_PRIVATE` | Titular/roles autorizados en módulo de origen | Política original del proyecto, job, evidence, consentimiento y auditoría propias |
| Derivado `DRAFT` | Aportante + revisores con permiso específico | Original jamás incluido en la respuesta del lector general |
| `TENANT_CURATED/PUBLISHED` | Miembro vivo de organización participante **del mismo tenant** con `knowledge:read-curated` | Consentimiento vigente por versión y audiencia, titularidad vigente, privacidad y oficio aprobados, no suspendido/revocado/caducado |
| Retirado, suspendido, `NEEDS_REVIEW` | Sólo panel autorizado, sin texto a consumidores | Se conservan audit logs mínimos; chunks y cachés dejan de servirse para consultas nuevas |
| Cross-tenant, público anónimo o licencia incierta | Nadie | Otro contrato + aprobación; **F1 prohíbe** |

No confundir permiso de **crear/editar ficha** con el de **consumir contenido compartido**. En todas las consultas retornar 404 neutral al descubrir recurso fuera de ámbito; no exponer diferencia entre ID existente e inaccesible.

## 3. Contrato de lectura único: Knowledge Gateway (futuro)

**Única puerta interna** para Copilot, BuildOps, ProTools, Sense Vision, Learning y API BFF. Los consumidores **no** llaman directamente a `PrometeoRepository` para originales ni leen las tablas nuevas saltándose políticas. Propuesta TypeScript orientativa:

```ts
type VerifiedKnowledgeCaller = {
  principal: { kind: "SIGNED_USER" | "AUTHORIZED_SERVICE"; id: string };
  tenantId: string;              // resolved by backend
  orgId: string;                 // verified active participant organization
  policyVersion: string;         // resolved server-side, never client supplied
  purpose: "COPILOT" | "BUILDOPS_GUIDANCE" | "PROTOOLS_REFERENCE" |
           "VISION_LEARN" | "LEARNING" | "EVIDENCE_GUIDANCE";
  projectId?: string;            // authenticated/project-validated where relevant
};
type CuratedSearch = {
  q: string;
  trade?: string;
  jurisdiction?: string;
  constructionItemId?: string;  // canonical Vision item ID (not uploaded frame)
  limit?: number;               // server bounded, e.g. 1..10
};
type CuratedCitation = {
  entryId: string;
  versionId: string;
  citationRef: string;          // opaque public-to-audience ref, not sourcePrivateRef
  title: string;
  summary: string;              // sanitized approved text only
  language: "es" | "en";
  trade: string;
  jurisdiction?: string;
  reviewedAt: string;
  validUntil?: string;
  sourceClass: "CURATED_VERIFIED";
  warnings: string[];
};
type CuratedSearchResult = {
  results: CuratedCitation[];
  insufficientContext: boolean;
  retrievedAt: string;
};
```

`searchCurated(caller, query)`: primero valida principal firmado y roles/tenant/org actuales; luego aplica audiencia+consentimientos+revisores+vigencia por SQL al mismo tiempo que recupera versiones. Un servicio que no pueda demostrar autoridad recibe `RAG_SCOPE_UNAVAILABLE` y **cero citas**. La respuesta sólo contiene campos saneados anteriores, sin URL de original, IDs de evidencia/cliente, EXIF, firma de consentimiento ni texto sin validar. Query `limit`, ranking y trazabilidad son acotados por política. Las fichas recuperadas son datos no confiables: nunca instrucciones para tool registry, pagos o publicación.

**Versionado/cita:** `citationRef` identifica la versión; en retirada, resolver cita devuelve `WITHDRAWN` sin texto. Un historial de chat ya entregado no se puede borrar retroactivamente: mostrar aviso y no volver a consultar contenido retirado. Cambiar cuerpo, jurisdicción, audiencia o consentimiento exige una nueva versión y nueva revisión.

## 4. Matriz de consumidores y fronteras

| Consumidor existente | Integración segura propuesta | Prohibición + condición de habilitación |
|---|---|---|
| Contributor Program / Knowledge Registry | Sólo crea candidato o borrador derivado de Observation; curadores comparan fuente privada sin publicarla | `PROMOTED`, demo mission, términos generales y rewards NO equivalen a permiso; aprobación individual + titular |
| Prometeo Copilot / #1007 | `searchCurated` read-only con actor verificado y scope del proyecto cuando aplique; respuestas con citas por versión y advertencias | Bus payload falsificado y RAG sin actor `RAG_SCOPE_UNAVAILABLE`; jamás `scope:null` libre ni SQL directo |
| BuildOps / operational intelligence | Tool de sugerencias/checklist por oficio/jurisdicción; conservar señales basadas en reglas cuando RAG no esté disponible | IA no cambia milestone, permisos, estado de Evidence, riskLevel, firma, ni release |
| Evidence / Milestones | Mostrar qué evidencia conviene capturar según oficio, sin copiar evidencia original al índice | Documentos del cliente sólo por política privada; ninguna ficha valida automáticamente la evidencia |
| ProTools / Estimates | Referencias de materiales, compatibilidades y metodología como explicación anexa a un estimate | Nunca usar anécdotas como tarifa/precio, productividad de trabajo o cálculo contractual automático |
| Change Orders | Contexto técnico de por qué solicitar revisión de alcance/riesgo y fuente de recomendación | No generar ni aplicar Change Orders sin aprobación del actor de negocio |
| Sense Vision / Construction Library | `ConstructionLibraryItem.id` referencia 0..N versiones curadas pertinentes por oficio; Frame temporal se descarta | No convertir el catálogo GLOBAL ni reconocimiento de objetos en privilegio a datos de tenant; no almacenar el frame como aporte |
| Mi Diccionario (Vision) | Vincular lecciones/citas a palabra guardada usando ID de objeto y `userId/tenantId` | Las notas personales no pasan a biblioteca ni se muestran a otros |
| Skills BO-12 / Learning | Ficha → lección → práctica/quiz con contenido verificado y advertencias; experiencia supervisada BO-12 es prueba DISTINTA | Sin nivel/insignia/licencia/puntuación profesional automática, sin inferir competencia por lecciones vistas |
| Marketplace / Trust | En fase futura, mostrar contribuciones validadas con consentimiento específico, separadas de ratings de obra | Nunca aumentar o reducir reputación de ejecución por aporte no solicitado, rechazo editorial o uso de capacitación |
| Mission Control | Sólo metadatos operativos minimizados: fichas vencidas, revisiones pendientes, fallos de DLQ/revocación/no-egress, health | Sin sourcePrivateRef, texto original, publicación automática ni permisos de moderación heredados |
| Payment Governance / Escrow | **Sin integración de decisión**, sólo posibles enlaces informativos para actor autorizado | `canRelease` y pagos permanecen gobernados por Evidence/Approval/Payment, no por ficha técnica |

## 5. Seguridad, auditoría y eventos

Flujo: `PRIVATE_SOURCE → DRAFT_DERIVATIVE → PRIVACY_REVIEW → TECHNICAL_REVIEW → READY → PUBLISHED → SUSPENDED / WITHDRAWN / SUPERSEDED`. Publicar comprueba consentimiento activo de aportante y titular legítimo, hashes de versión, audiencia permitida y **dos revisiones humanas independientes** en la transacción serializable; audita + outbox atómicos. Revisiones se invalidan si cambia el cuerpo o el alcance. Material crítico con norma obsoleta pasa a `NEEDS_REVIEW` fuera de búsqueda verificable.

**Evento propuesto (aún no registrado en EVENT_CATALOG):**
```json
{
  "event": "curated_knowledge.version_withdrawn",
  "tenantId": "<verified>",
  "entryId": "<opaque>",
  "versionId": "<opaque>",
  "policyVersion": "<server-owned>",
  "sequence": 5,
  "requestId": "<opaque>",
  "occurredAt": "<UTC>"
}
```
Sin texto, nombre, PII o prueba de consentimiento en el envelope. Outbox transactional, consumer idempotente, DLQ recuperable. Retirar afecta la misma transacción de DB; un proceso de indexación reintentado debe comprobar versión+estado presente antes de guardar y no resucitar una ficha suspendida.

**Métricas propuestas para Mission Control:** `curated_published_total`, `curated_active_consents` (agregadas por tenant permitido), `curated_review_backlog`, `curated_withdrawal_access_denied_total`, `curated_purge_lag_seconds`, `curated_stale_versions`, `curated_local_model_egress_denied`, `curated_search_no_answer_rate`. Sin registrar q literal, chunk, nombre de cliente o secreto en logs.

## 6. Tratamiento del conocimiento por riesgo

- **General:** vocabulario, material y herramientas; revisión editorial + técnica según peligro.
- **Alto riesgo:** electricidad, trabajo energizado, gas, estructuras, altura, seguridad contra incendios: revisión técnica acreditada + referencia normativa `authority/edition/jurisdiction/effectiveDate`; documentar restricciones/criterios de detenerse y escalamiento. No autocompletar recomendaciones de obra con información sin jurisdicción o que requiera licencia.
- **Desactualizado:** cambios normativos, reportes de errores o conflicto entre fuentes invalidan marca `VERIFIED`. Citas siguen históricas sin convertirse en procedimiento vigente.
- **Capacitación:** quiz y ruta educativa referencian `versionId` verificable, nunca inferir destreza práctica ni emitir licencias.

## 7. Plan de ejecución por fases y dependencias

| Fase | Contrato mínimo | Gate imprescindible |
|---|---|---|
| F0 — diseño | SDD + este anexo + ADR privacidad y derechos; aprobación de audiencias | #992, consentimiento/retención/titular y revisores designados |
| F1 — custodia privada | API/UI sólo borrador, versiones y consentimiento; flag de publicación OFF | Tests SQL/roles/ownership y migración reversible |
| F2 — revisión | Doble revisión, cambio de versiones y auditoría/outbox, revalidación de hashes | Casos negativos, no self-approval, revocación |
| F3 — lectura curada | Knowledge Gateway, FTS PostgreSQL, citas con versión y scope SQL | #974/#987 aprobados, staging aislado/no-egress, org A/B y tenant C |
| F4 — integraciones | Sense Vision, Copilot, BuildOps/ProTools, Learning; consumers READ-ONLY | Contract tests por consumer y ausencia de side effects |
| F5 — piloto | Electricidad: mínimo 10 escenarios sintéticos con fuentes normativas y 2 organizaciones participantes dentro del mismo tenant | Revisor de seguridad independiente, costos y staging aprobados, planes de rollback y medición reales |

No activar `TENANT_CURATED` hasta que los requisitos de confidencialidad y seguridad se cumplan. Los agentes internos de #1009 siguen sin permiso de documentos privados mientras #1007 no tenga principal verificable. Se puede desarrollar diseño/F1 privado de forma independiente **sólo tras aprobación específica del SDD del slice**.

## 8. Matriz de aceptación cruzada

| Prueba | Tenant/Org | Salida esperada |
|---|---|---|
| Lectura de ficha válida desde org participante A | mismo tenant | Versión y cita curada autorizadas |
| Lectura org B no participante | mismo tenant | 404 neutro; cero título/contenido/conteo |
| Org B participante sin `knowledge:read-curated` | mismo tenant | 403/404; cero contenido |
| Org B participante + permiso, pero consentimiento revocado | mismo tenant | 404/retirado sin texto ni cita utilizable |
| Consulta tenant C | distinto tenant | 404 neutro sin inferir existencia |
| Usuario sin membresía, actor de evento falsificado, agente sin principal | cualquiera | No RAG y `RAG_SCOPE_UNAVAILABLE` |
| Documento `PROMOTED` legacy/`public_training` sin nuevo consentimiento | mismo tenant | Sigue privado, jamás en Knowledge Gateway |
| Consentimiento cambia de audiencia o versión | mismo tenant | Revisión invalidada hasta reaprobar, 409 al publicar con hash viejo |
| Publicación vs retiro concurrente | mismo tenant | Retiro gana en consultas nuevas; no replay que reabra |
| Sense Vision ve herramienta global | mismo tenant | Catálogo visible conforme a Vision, fichas curadas sólo con autorización |
| Skills sin revisión de supervisor | mismo tenant | Lección/quiz no crea experiencia confirmada ni licencia |
| ProTools / BuildOps / Evidence / Escrow | mismo tenant | Sólo guías/citas; cero mutaciones económicas u operativas |
| Caché warm + revocación + consulta inmediata | mismo tenant | Denegación SQL antes de servir cached snippet |
| Prompt injection en ficha de entrada | cualquiera | Texto no se ejecuta como instrucción ni herramienta |
| Falla proveedor/índice/vector | mismo tenant | `insufficientContext`/degraded, nunca original ni proveedor cloud |

## 9. Medición real (sin promesas de métricas inexistentes)

**Seguridad — condición de liberación:** 0 filtraciones en pruebas cross-org/cross-tenant; 100% fichas publicadas con consentimiento y doble revisión; 100% revocaciones impiden consultas nuevas; prueba de red no-egress. **Calidad:** 100% de fichas de riesgo alto con revisor identificable, jurisdicción, edición y advertencias; medir tasa de corrección, vigencia y respuesta sin fuentes. **Eficiencia:** p95 búsqueda con 10k fichas y benchmark Postgres EXPLAIN real; no presentar < 1 segundo como validado. **Utilidad:** tiempo hasta encontrar respuesta, búsquedas resueltas, ayudas de campo solicitadas y retroalimentación de supervisores vs línea base. No inferir ahorro de dinero sin ensayo controlado.

## 10. Traceabilidad y no-objetivos

Dependencias: #992 / SDD #1008 (este programa), #974 / #987 (ACL private RAG), #1007 / PR #1009 (diagnóstico y futuro scope verificado), `core.knowledge-contributor-registry`, `core.knowledge-contributor-rag-ingestion`, `vision.sense-vision-field-library`, `core.skills` BO-12, `operations.mission-control-2`, Change Orders y Payment Governance. Si el revisor detecta divergencia código-vs-spec, prevalece la implementación verificada sólo para describir el estado actual; modificar el SDD por proceso de gobierno antes de implementarlo. No crear servicio de Railway nuevo en F1 salvo necesidad técnica demostrada y aprobada con costos. Prohibido activar publicación, cruzar tenants, entrenar modelos con datos de usuarios, recompensar contribución sin contrato, adjudicar ranking, emitir licencias o desbloquear escrow automáticamente.
