# SEMSE Integration Runtime y continuidad de datos — blueprint de implementación

**Estado:** PROPUESTA DE DISEÑO / DOCUMENTACIÓN — **NO IMPLEMENTADO NI APROBADO PARA PRODUCCIÓN**  
**Fecha:** 2026-10-18  
**Documento padre autoritativo:** [ADR-042 Universal Connector Trust Boundary](ADR-042-universal-connector-trust-boundary.md)  
**Spec autoritativa:** [Universal Connector Trust Contract v1](../specs/platform/universal-connector-trust.spec.md)  
**Conformidad y fases existentes:** [Plan](../specs/platform/universal-connector-trust.plan.md) · [Checklist](../specs/platform/universal-connector-trust.checklist.md)

> Este documento es una interpretación técnica complementaria del diagrama entregado por el owner, «Arquitectura de Integración y Continuidad de Datos en Semse». **No** crea un segundo trust boundary, un segundo Business Kernel, nuevos permisos ni un estado de producción. Cualquier contradicción debe resolverse contra ADR-042, Policy, Approval, el catálogo de dominios y la spec aprobada. No declarar completado nada a partir del diseño visual.

## 1. Objetivo y topología

Permitir conectar fuentes externas —CRM, ERP/contabilidad, field-service, APIs propias y archivos CSV/Excel— a los dominios canónicos de SEMSE **sin forzar una migración inicial**, sin perder historial, sin confiar en datos entrantes como autoridad y sin exponer secretos a Prometeo.

```text
Fuentes externas (CRM / ERP / Field Service / API / archivos)
  -> Adaptadores provider-specific (auth, client, webhook/poll, mapping)
  -> Universal Connector Trust Boundary de SEMSE (ADR-042)
  -> Connector SDK / capability manifest / canonical envelope
  -> Sync Orchestrator (checkpoints, idempotencia, reconciliation, DLQ)
       |-> Raw Vault: originales cifrados, versionados y verificables
       |-> Transformación/canonical mapping versionado
       |-> Projection / business application services autorizados
       |-> Índice semántico derivado y autorizado (Prometeo)
  -> Intake / Estimate / BuildOps / Milestones / Evidence / Approval / Payment

Omniverse: consola observacional separada, lectura autorizada y revocable.
```

**Frontera de control:** SEMSE core es el dueño de las decisiones de negocio y de la fuente canónica de los registros adoptados; los adaptadores no pueden escribir directo a tablas de negocio, liberar pagos, cambiar aprobaciones, firmar, alterar Policy o conceder scopes. La UI/servicios de Omniverse no se convierten en fuente de verdad del runtime ni en un atajo hacia la DB de SEMSE.

**Contrato existente, no propuesta nueva:** `packages/shared/src/universal-connector/{contracts,enforcement,idempotency,runtime-trust,webhook-trust}.ts` define actor, conexión, scope, capability, delegación, estado `ACTIVE`, trust, límites de riesgo, Approval/Policy, envelopes e idempotencia. Se reutiliza y versiona; no se duplica.

## 2. Correspondencia exacta entre el diagrama y la implementación

| Caja del diagrama | Responsabilidad única | Contrato/componente SEMSE | Evidencia y trabajo pendiente |
|---|---|---|---|
| Sistemas Externos | Fuente externa de IDs, datos y eventos | Conectores por proveedor | Inventario de proveedores, permisos, API y licencias por tenant |
| Conectores (Adapters) | Autenticación, API, webhook/polling, transformación superficial y errores | Adapters detrás de ADR-042; `SecretReference` | Conformance provider-specific, secretos opacos, rate limits |
| Connector SDK | Manifest, capability, esquemas/compatibilidad, field mapping versionado | `CapabilityManifest`, `CanonicalDataEnvelope` | Mapas versionados y contratos por dominio todavía requieren evidencia |
| Motor de sincronización | Bulk snapshot, incremental, dedupe, retries, DLQ, conflicto, auditoría | Servicio/worker dentro del data plane SEMSE, bajo trust boundary | **No acreditar motor de sincronización persistente implementado** sin pruebas |
| Raw Vault | Bytes originales, adjuntos, identificador externo, checksum, procedencia | Almacenamiento privado duradero + manifiesto/lineage | **Diseño pendiente de implementación/retención/restore verificado** |
| Procesamiento/normalización | Parse, antivirus/validación, normalización, mapeos de valores | Pipeline versionado tras almacenar original | No reinterpretar identidad ni permisos del provider |
| Modelo Canónico SEMSE | Relaciones adoptadas y autoridad por campo/dominio | Servicios de negocio canónicos de SEMSE | Definir tabla source↔canonical + reglas por campo/tenant/org |
| Índice semántico de Prometeo | Búsqueda contextual **derivada y revocable** | Prometeo RAG / tool registry / Policy | Índices tenant/org-aware, redacción, citas y revocación |
| Aplicaciones SEMSE | Consumen datos validados por sus servicios | Intake → Estimate → BuildOps → Milestones → Evidence → Approval → Payment | Reglas de aprobación y económicas no delegables al conector |
| Omniverse | Salud de conexiones, métricas, alertas, auditoría **read-only** | Adapter de telemetría/autorización de SEMSE | No otorgar identidad ni escritura implícitas |

## 3. Tres estrategias de datos existentes, sin semántica ambigua

Los modos del diagrama se mapean al contrato de **cuatro estados** ya aprobado en ADR-042:

1. **Contexto sin migración → `READ_ONLY`.** El externo sigue como fuente de verdad; SEMSE consulta con TTL, scopes y autorización. No se crean records canónicos ficticios ni se permite `sync` mutante. La indexación para Prometeo requiere consentimiento y clasificación de datos.
2. **Híbrido recomendado → `HYBRID`.** SEMSE es fuente de verdad **solo para las entidades/campos adoptados y declarados explícitamente**; el histórico permanece en el externo y/o Raw Vault. Sincronización reversible, checkpoints y resolución de conflictos. El modo por sí solo **no** concede derecho de escribir ni de transferir autoridad.
3. **Migración administrada → `MANAGED_MIGRATION`.** Fase de backfill/copia completa, shadow compare, reconciliación y aceptación por el owner. Define qué objetos y campos pasan a autoridad SEMSE y cuándo; sin cutover automático.
4. **Migración completa → `FULL_CUTOVER`.** Solo después de aceptación, hashes, diff, backups, replay/recovery y plan de reversión. Se conserva la copia original en Raw Vault según política de retención; no borrar el externo por defecto.

La recomendación de `HYBRID` del gráfico es un **default de planificación**, no una selección automática. El consentimiento/capacidades/contrato con el proveedor y los riesgos de cada tenant determinan qué estrategia se puede activar.

## 4. Capabilities del conector

**Obligatorio por conector:** identidad y consentimiento del tenant, estado de confianza, auth con secretos opacos, `CapabilityManifest`, lectura/health, clasificación y redacción, paginación/rate limits, errores estructurados, idempotencia para writes, trazabilidad y revocación.

**Por capacidad; nunca por permiso global de conector:** `contacts.read`, `opportunities.read`, `projects.read`, `estimates.read`, `invoices.read`, `attachments.read`, `events.read`, etc. Se debe traducir cada campo al permiso real registrado en SEMSE; estos nombres son **ejemplos, no scopes ya concedidos**.

**Declaración opcional:** actividades, cotizaciones, facturas/pagos, usuarios, productos, inventario, órdenes de trabajo, cuadrillas, costos, campos personalizados e historial de objetos eliminados. La ausencia de una capability es `UNSUPPORTED`, jamás éxito vacío.

**Riesgo económico:** una factura externa es un documento/claim, **no** autoriza `Payment.release`, escrow, `Approval` o `ChangeOrder.apply`; siempre se revalida contra los servicios y aprobaciones canónicas de SEMSE.

## 5. Raw Vault y linaje

**Contrato propuesto de manifiesto**, todavía sin esquema ni almacenamiento prod certificados:
- `tenantId`, `orgId` cuando aplique, `connectionId`, `provider`, `externalObjectType`, `externalId`, `sourceVersion`, `objectVersion`.
- `rawObjectRef` privado, `sha256`, `contentType`, `byteLength`, `receivedAt`, `schemaVersion`, `mappingVersion`, `classification`, `retentionPolicyId`, `legalHold`.
- `consentRef`, `purpose`, `lineageRef`, `correlationId`, `auditRef`, `externalDeletedAt` (tombstone), `projectionStatus`.

Almacenar originales con cifrado en tránsito/reposo, permisos por tenant/org, claves administradas, escrituras versionadas/append-only y verificaciones periódicas de checksum. No declarar «inmutable» un simple bucket sin controles de retención y bloqueo. La retención, exportación, solicitudes de borrado, PII y legal hold requieren políticas diferenciadas; no prometer preservación eterna. Mantener protección de adjuntos y URLs firmadas de corta vida.

El índice de Prometeo es reconstruible desde objetos y proyecciones autorizadas; debe eliminar/revocar su acceso al perder scopes, consentimiento o vínculo tenant/org. No indexar secretos ni importar instrucciones de contenido externo como autoridad.

## 6. Sync, CDC, conflictos y continuidad

```text
1. Conexión autorizada + capabilities -> estado ACTIVE validado (control plane)
2. Snapshot inicial por objeto/página -> bytes Raw Vault -> manifest SHA-256
3. Normalización determinista -> CanonicalDataEnvelope + source↔canonical ID map
4. Dry-run / shadow compare -> Policy / Approval si mutación
5. Aplicar proyección autorizada vía servicio SEMSE, idempotency key durable
6. Guardar checkpoint atómico + outcome y evidencia -> avanzar cursor
7. Webhook verificado o polling incremental -> dedupe -> steps 2..6
8. Error -> retry exponencial con jitter + DLQ, sin descartar original
9. Conflicto -> quarantine / manual resolution; no blind last-write-wins
10. Recovery -> replay desde checkpoint; reconciliar conteos, versiones, hashes
```

**No asumir exactly-once**: usar recepción at-least-once más idempotencia. La paginación debe tolerar cambios durante el bulk; registrar snapshot watermark/cursor por proveedor y política de reconciliación para cambios concurrentes. Cada evento externo incluye ID/version cuando existe; el provider timestamp no sustituye autenticación ni secuencia canónica.

**Regla de conflicto:** `fieldAuthority` define por registro/campo quién gobierna (`EXTERNAL`/`SEMSE`/`MANUAL`); cuando no está definido, bloquear el write y pedir resolución. No hacer merge silencioso de clientes, jobs, evidencias o estados financieros.

**Revocación y pausa:** `SUSPEND_CONNECTION`, `DISABLE_WRITES`, `DISABLE_AGENT_ACCESS`, `EMERGENCY_STOP` paran nuevas operaciones; preservar checkpoint y evidencia; no reanudar sin nueva validación de identidad, scopes, estado y Policy.

## 7. Seguridad y límites

- Actor + org/tenant + connection + runtime + capability + scope + delegation + trust/risk + Policy + Approval + evidencias; fail-closed conforme a ADR-042.
- Secretos del proveedor solo en gestor autorizado; nunca en payloads que ve Prometeo, SQL logs o Raw Vault sin clasificación/controles.
- Webhooks con HMAC/firma provider-specific, timestamp y replay nonce. SSRF/egress allowlist, DNS pinning/control de redirecciones para URLs salientes.
- Aislamiento de tenant en queries, índices, DLQ, checkpoints, Raw Vault, manifest, mapping y auditoría; mismo-tenant no equivale a autorización entre organizaciones.
- `404` de objetos cross-tenant si contrato de SEMSE lo exige; no enumerar IDs/metadata ocultos. Denegaciones trazables sin revelar contenido.
- Fuentes externas, datos del CSV, prompt injection y texto de webhook se validan como **datos sin autoridad**; no deciden permisos, sincronización, pagos, firmas ni aprobaciones.
- Omniverse consume resúmenes de estado de lectura desde un endpoint de identidad de servicio explícita, read-only, revocable y auditable; no comparte tokens de administración de bases de datos.

## 8. UX operativa y observabilidad

Para cada conexión: proveedor, cuenta/scope, estado de confianza, modo de adopción, datasets, última extracción completa, último checkpoint, latency/lag, errores y retries, DLQ, conflictos pendientes, registros adoptados, checksums de restore/replay y próximos pasos. Estados de UI: `unconfigured`, `authorizing`, `syncing`, `healthy`, `degraded`, `paused`, `revoked`, `error` y `unsupported`.

**No confundir:** «conexión saludable» != «datos completos», «sync exitosa» != «cliente aprobado» y «índice generado» != «Prometeo autorizado a usarlo».

## 9. Plan vertical y criterios de aceptación verificables

| Fase | Slice mínimo | Evidencia requerida | Gate |
|---|---|---|---|
| D0 Inventario | Seleccionar proveedor y dataset no financiero, titular/consentimiento, schema, capability/field map | Spec + threat model + owner approval | No activar |
| D1 Lectura | Adapter read-only real de un CRM, estado ACTIVE + scopes, tenant/org | 401/403/404, field redaction, secrets scan, real HTTP/API fixture | Test CI |
| D2 Preservación | Raw Vault + manifiesto SHA-256 + canonical envelope + restauración de muestra | hash original/restored igual, retención y ACL probadas | Conformance + staging |
| D3 Bulk | Snapshot paginado con watermark, cursor y dedupe durable | backfill reconciliado, no pérdidas frente a cambios concurrentes | Replay x10 + recovery |
| D4 Incremental | Webhook firmado o polling con DLQ y métricas | bad-signature/replay deny, reordenamiento, retries, checkpoint recovery | Canary read-only |
| D5 Híbrido | Adopción explícita de contactos/oportunidades; resolución de conflictos | field authority, consent, audit, tenant/org isolation | Approval por capability |
| D6 Negocio | Consumo por servicios Intake/Estimate/etc.; eventos reconciliados | ningún bypass de Evidence, Approval, Change Orders, Payment | E2E negocio |
| D7 Prometeo/Omniverse | Query RAG autorizado y panel solo-lectura | revocación instantánea, citations+lineage, no escalación de agente | Conformance + canary |
| D8 Cutover opcional | `MANAGED_MIGRATION` → `FULL_CUTOVER` | aceptación owner, rollback probado y hash/contabilidad reconciliados | Production release review |

Pruebas mínimas transversales: 2 tenants × 2 orgs, source/target no autorizado, credenciales revocadas, connector no-ACTIVE, límites de costo, discrepancia de schema, cambios concurrentes, payload malicioso, adjunto corrupto, retry 10x sin doble escritura, conflicto ambiguo, caída de red y reinicio del worker, índice semántico con acceso revocado y prueba de restauración de originales.

## 10. Estado de evidencia actual y no-objetivos

Comprobado en repositorio al redactar (referencia `main`, 2026-10-18): existen ADR-042, spec aprobada, shared SDK/trust contract y suite declarada; la spec registra `code_status: IN_PROGRESS`, `ci_status: FAIL`, `deploy_status: NOT_DEPLOYED` y `activation_status: INACTIVE`. Es metadata de documento, **no verificación en vivo de servicios productivos**.

**No hay evidencia aportada en esta revisión para afirmar** que Raw Vault, connector SDK completo por proveedor, sync bulk/incremental durable, real-adapter recovery, tenant canary o reconciliación de producción estén implementados y certificados. Lo que existe en contracts/tests no autoriza marcar fases D1–D8 como completadas.

No reemplazar los conectores específicos existentes, no reescribir el Business Kernel, no crear un segundo motor de Policy/Approval, no habilitar acciones operativas de Omniverse, no mover facturas ni saldos de escrow durante el primer canary y no activar migraciones automáticamente.

**Decisiones a cerrar antes de cualquier slice de código:** primer proveedor y permisos OAuth/API; primer dataset; política de retención/legality de Raw Vault; autoridad por entidad/campo; residency/egress; criterio de rollback; revisión security owner; alcance de Prometeo para indexación histórica.

**Regla de entrega:** ningún marcador «VERIFIED», «CERTIFIED» o «PRODUCTION READY» sin CI del commit exacto, pruebas de integración reales, tenant/org negative tests, artefactos de conformance y evidencia de despliegue/canary.
