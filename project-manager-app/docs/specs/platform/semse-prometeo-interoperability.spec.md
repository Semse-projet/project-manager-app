---
id: "platform.semse-prometeo-interoperability"
title: "SEMSE Project + Prometeo + Universal Connector: programa rector de interoperabilidad"
domain: "platform"
sdd_version: "2.0"
version: "0.1"
status: "REVIEW"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files: []
related_tests: []
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "NOT_VERIFIED"
---

# SDD rector: SEMSE Project, Prometeo Copilot e interoperabilidad universal

**Corte de análisis:** 2026-10-15. **Tipo:** spec paraguas de programa, sin ejecución de negocio propia. **Estado:** REVIEW; no se autoriza implementación de features hasta aprobar los child specs y reconciliar ADRs. No se infiere CI, merge, deploy ni activación de este documento.

## 1. Problema y resultado

**Usuarios:** clientes, contratistas, empresas multi-org, integradores autorizados, operadores y usuarios de Prometeo.

**Problema:** SEMSE ya posee backend y dominios, varias rutas Copilot/Orchestration, Tool Registry, contratos Universal Connector y configuración de integraciones. Un nuevo gateway creado de forma aislada duplicaría permisos, registros, orquestación, autoridad de datos o interfaces, y podría exponer información entre tenants/organizaciones.

**Resultado:** una arquitectura verificable y extensible en la que SEMSE es el ecosistema y dueño del negocio; Prometeo es su copiloto/planeador sujeto a autorización; Universal Connector gobierna la confianza hacia proveedores externos; el Tool Registry gobierna acciones disponibles; los adaptadores MCP permiten publicar y consumir capacidades; MCP Apps es presentación opcional compatible con cada host. La lógica de dominios no vive en adaptadores MCP.

### Principios invariables

- Ecosistema: SEMSE Project, nunca «Prometeo OS» como plataforma/BD paralela.
- Copiloto: Prometeo contextualiza, propone, planifica y llama tools autorizadas, sin autoelevar privilegios ni suplantar consentimiento.
- Autoridad: API NestJS / módulos de dominio, Policy/Approval, ownership, FSM, Evidence y Payment Governance son canónicos.
- Interoperabilidad: Universal Connector es trust boundary provider-agnostic y reutiliza infraestructura existente; MCP es protocolo/adaptador, no un segundo policy engine o negocio.
- UX: Workspace/Settings → Integraciones reutiliza vistas y rutas existentes; MCP Apps usa recursos ui:// en hosts que lo soporten, con salida textual cuando no.
- Independencia: no acoplar semántica de negocio a ChatGPT, Claude, OpenAI, Anthropic ni un proveedor.
- No confianza: salida de agente, CRM/ERP externo, webhook, UI y modelo son datos no confiables; nunca autoridad de acceso.

## 2. Evidencia, fuentes canónicas y reconciliación

Fuentes vinculantes: .specify/memory/constitution.md; docs/SDD_GOVERNANCE.md; docs/SOURCE_OF_TRUTH.md; docs/SPEC_INDEX.md; docs/CANONICAL_STATE_REGISTRY.md; docs/foundation/{DOMAIN_INVARIANTS,STATE_MACHINES,EVENT_CATALOG}.md y ADRs aprobados.

Hallazgos verificados en GitHub (no verifican producción):
- PR #797, fusionado 2026-10-06, introdujo el Universal Connector Trust Contract v1 y código compartido en packages/shared/src/universal-connector/**. La metadata actual de la spec aún marca merge UNMERGED, CI FAIL, deploy NOT_DEPLOYED, código IN_PROGRESS y activación INACTIVE: **conflicto a reconciliar con SHA y ejecución real**.
- PR #859, fusionado 2026-10-11, fue exclusivamente documentación de Workspace/conectores/3D/4D; no demuestra integración desplegada.
- ADR-025 (MCP External Tool Gateway) registró el 2026-10-11 opción C: **no implementar MCP externo por ahora**. La necesidad concreta actual propone reevaluarlo, pero NO lo revoca automáticamente.
- Colisión de numeración: docs/architecture/ADR-042-universal-connector-trust-boundary.md y ADR-042-operational-intelligence-graph.md son decisiones distintas con mismo número. Corregir identificadores y referencias sin borrar historia.
- ADR-038 identifica rutas Copilot/Orchestration API+BFF existentes sin consumidor UI observado. Investigar antes de crear otro orquestador.
- docs/program/semse-4d-field-memory/WORKSPACE_REUSE_AND_CONNECTORS.md identifica Settings → Integraciones existente a nivel tenant, pero el cambio a administración por Org todavía necesita controles de ámbito.
- Tool Registry F2 tiene spec aprobada: confirmar enforcement, aprobación, auditoría y wiring contra HEAD actual, no suponer por documentación histórica.

**No afirmar** integración MCP activa, UI en producción, PR documentacional como feature implementada o capacidad de ChatGPT universal. Guardar evidencia independiente para código, tests, CI, merge, Railway, activación y journeys autenticados.

## 3. Alcance del programa y exclusiones

### Incluido
1. Auditoría AS-IS de Prometeo, Connector, Workspace, APIs, Tool Registry, Policy/Approval, adapters CRM/ERP y límites de autoridad.
2. Mapa TO-BE, matriz de ownership y reconciliación de ADRs/metadata, con decisiones registradas antes de codificar.
3. Slice de MCP Server SEMSE **read-only** para consultar un proyecto autorizado por medio del API y Tool Registry existentes; no consultar base de datos desde el gateway.
4. Slice separado de MCP Client Prometeo para consumir tools externas aprobadas, con control de conexión, identidad, scopes, egreso y revocación. Requiere revisión ADR-025.
5. Slice MCP Apps con UI de presupuesto o proyecto en modo lectura, sandbox/CSP y fallback textual; soporte del host probado individualmente.
6. Reutilización de Settings → Integraciones y Workspace por organización solamente después de corregir ámbito de permisos.
7. Futuras escrituras por capacidad con consentimiento, Policy, Approval, idempotencia, auditoría y rollback.
8. Paquete de conformidad, observabilidad, flags por tenant/conexión, runbook y verificaciones en Railway antes de activar.

### Excluido
- Reescribir el Business Kernel, reemplazar PostgreSQL/Prisma/FSM, duplicar motor de agentes, crear un nuevo CRM/ERP o integraciones bidireccionales automáticas.
- Acceso de agentes a secretos, lectura directa de Postgres, sincronización masiva o migración/cutover de datos legados en el primer slice.
- Liberaciones escrow/pagos, firmas legales o aprobaciones de Evidence por IA a través de MCP sin child specs críticos independientes.
- Prometer compatibilidad UI en todo cliente MCP, o que OAuth/SSO por sí mismo conceda acceso a recursos.
- Crear features de producción en este PR documental.

## 4. Arquitectura y ownership TO-BE

Usuario/host compatible → MCP Server Adapter / SEMSE Connector → API canónica SEMSE → identidad + tenant/org/ownership → Tool Registry / Policy / Approval → servicio de dominio → Audit/Evidence → resultado filtrado → host.

Prometeo → Tool Registry → MCP Client Adapter → Universal Connector Trust → OAuth/binding/egreso permitido → proveedor externo; resultados vuelven como datos no confiables y no desencadenan writes automáticamente.

MCP Apps UI → host compatible y sandbox separado → llamadas a tools bajo mismo backend/authz; renderizado/UI no transmite autoridad.

**Matriz de dueños**
| Área | Dueño canónico | Rol del nuevo adaptador |
|---|---|---|
| Datos, proyectos, estimaciones, jobs, Evidence, Payments | Servicios de dominio API/Prisma/FSM | Delegar, filtrar y presentar, jamás duplicar |
| Autenticación, RBAC, tenant/org/recurso | Auth/Policy + dominio | Verificar en cada petición y rechazar falla cerrada |
| Decisiones y aprobaciones | Policy + Approval canónicos | Consumir decisiones, nunca emitir concesiones |
| Catálogo de tools/agentes | Prometeo Tool Registry y runtime | Registrar wrappers gobernados con riesgos y schemas |
| Conexiones externas | Universal Connector boundary y adapters de proveedor | Evaluar scopes, estado y confianza, revocar |
| UX | apps/web y Workspace existentes | Reusar controles; render MCP Apps sólo si host soporta |
| Registro operativo | AuditLog/Evidence y trazabilidad existente | Enlazar intent, actor, decisión, herramienta, resultado |

## 5. Actores, permisos y amenazas

| Actor | Permiso / ámbito | Puede | Prohibido |
|---|---|---|---|
| Usuario autenticado | Permiso API + ownership explícito del proyecto/job + org | Leer recursos propios | Datos otra org o tenant |
| Admin de organización | Concesión por org + capability/consent | Administrar conexión de su org después de un child spec | Administrar otras org por rol tenant-wide |
| Operador plataforma | Permisos OPS limitados y auditados | Suspender/revocar/pasar a read-only | Leer arbitrariamente datos cliente |
| Prometeo / agente | Delegación acotada a actor, tenant, org, recurso, capability, expiry y propósito | Invocar herramienta autorizada | Autoaprobar, escalar scopes, recibir tokens |
| Proveedor MCP externo | Conexión ACTIVE y manifest verificado | Responder a tool habilitada | Introducir política desde prompt/webhook |

P0: aislamiento cross-tenant y entre orgs del mismo tenant; IDs ajenos ocultos con 404 homogéneo donde corresponda; no confiar en orgId enviado por UI; consentimiento con expiración y revocación inmediata; no tokens en prompts/logs; sin SSRF/destinos privados/cambios DNS redirect; TLS, allowlist y límites de egress; nonces de webhook y firmas verificadas; protección confused-deputy, prompt injection y replay.

Las operaciones read/write/delete/sync/execute se autorizan individualmente. READ_ONLY bloquea mutaciones incluso si el tool intenta ejecutarlas. Solo conexiones ACTIVE pueden invocarse, sujeto a evaluación adicional de scopes/trust/Policy/Approval. Fail closed al faltar contexto o si runtime está DEGRADED/REVOKED/SUSPENDED.

## 6. Escenarios P1 y aceptación

**P1-01, consulta real:** DADO usuario autenticado del tenant A y org X, CUANDO solicita mediante cliente MCP un proyecto propio, ENTONCES el API resuelve ownership, la respuesta omite datos no autorizados y existe correlation/auditRef. Cero acceso a proyecto de org Y/tenant B.

**P1-02, denegación:** DADO usuario con token válido sin permiso para proyecto, CUANDO invoca tool read, ENTONCES el backend deniega antes del dominio/adapter y no filtra existencia, payload ni secretos.

**P1-03, revocación:** DADO conexión ACTIVE, CUANDO admin autorizado la revoca, ENTONCES nueva invocación falla cerrada aun cuando el host retiene un token válido. Registrar evento de revocación.

**P1-04, cliente no compatible:** DADO cliente sin soporte MCP Apps, CUANDO ejecuta la consulta, ENTONCES recibe datos/texto seguro, sin romper el flujo; nunca se interpreta ausencia de UI como autorización para otro endpoint.

**P1-05, escritura futura:** DADO acción sensible, CUANDO falta aprobación específica, ENTONCES no se ejecuta ni en reintento; el usuario recibe propuesta pendiente con actor, ámbito y efectos.

**P1-06, egreso:** DADO proveedor desconocido o redirección a IP privada, CUANDO Prometeo solicita tool externa, ENTONCES el cliente/adaptador deniega conexión y deja registro sanitizado.

**P1-07, idempotencia:** DADA escritura aprobada en slice futuro, CUANDO se repite 10 veces misma key, ENTONCES ocurre un solo efecto; fingerprint distinto produce conflicto.

## 7. Contratos por slice (propuestas, NO endpoints existentes)

**MCP Server tool propuesta:** `semse.project.get_summary.v1` (nombre tentativo, READ_ONLY; no está registrada).
**Ruta de dominio existente verificada:** `GET /v1/projects/:projectId` → `ProjectsService.detail` → `ProjectsRepository.findById`; exige `projects:read` y validación de ownership por tenant y organización.
Input: `projectId` como cadena validada conforme al esquema de identificadores reales (NO asumir UUID), más identidad derivada de sesión/token confiable. Nunca aceptar `tenantId/orgId/roles` como autoridad por argumentos de la tool.
Output mínimo permitido en S1: `projectId, jobId, status, sourceRef, correlationId` y `auditRef` respaldado por telemetría/auditoría real. **El `ProjectRecord` actual no contiene `name/title/summary` ni timestamps.** No prometerlos ni fabricarlos; para agregar título debe aprobarse un resolver Job autorizado y sus pruebas.
Errores normalizados: UNAUTHENTICATED, FORBIDDEN/NOT_FOUND sin filtrar existencia según el contrato de seguridad por recurso, CONNECTOR_INACTIVE cuando aplique, POLICY_DENIED, RATE_LIMITED, SERVICE_UNAVAILABLE.
**P0 pendiente:** revisar `ActorContextService.ensureActorContext` (upsert de tenant/org/user desde context) y procedencia de `authContext`, `AUTH_SECRET` y membresía de usuario, para garantizar que una lectura MCP nunca cree identidad implícita ni confunda rol global con permiso por org. Véase `docs/reportes/planning/2026-10-15-interoperability-s0-source-audit.md`.

**MCP Client futura:** connectionId + capabilityId allowlisted, intención, delegated actor, resource scope, policyDecision y correlationId; payload externo etiquetado UNTRUSTED. Schemas exactos Zod y permisos se definirán en spec hija.

**UI futura:** vista states loading/empty/ready/forbidden/degraded/error, CSP restrictiva, origen aislado, sin tokens en DOM/localStorage, controles no habilitados si no hay permiso. Recurso ui:// y protocolo compatible sólo después de investigación host.

**APIs nuevas:** pendientes de child spec y revisión de endpoints preexistentes; no inventar rutas que parezcan desplegadas.

## 8. FSM, eventos, datos y recuperación

Ciclo Connector: REQUESTED → AUTHORIZED → VERIFIED → ACTIVE; suspensión/quarantine/revocación invalida ejecución. Reusar tipos reales Universal Connector; no generar nueva FSM sin reconciliación.

Cada cambio de conexión/autorización escribe auditoría con actor, tenant, org, recurso, capability, decisión, timestamp, correlation y reason sanitizado. Cuando sea evento de dominio, aplicar outbox atómico y consumidores idempotentes. Webhooks exigen firma + timestamp + nonce + Policy/Approval antes de acciones.

**Primer slice:** sin tablas/migraciones presumidas. Revisar si existen connectionId/orgId y storage persistente; si no, child spec y migración expand/contract compatible con rollback. Ninguna modificación destructive de migrations aplicadas; nunca prisma db push/reset en producción.

## 9. Plan de entrega y seguridad operacional

S0 — Audit & Governance: inventario actual, resolver colisión ADR-042 y reevaluación ADR-025, registrar fuente de verdad/estado; sin código.
S1 — SEMSE MCP Server read-only: implementar adaptador delgado, tests negativos multi-tenant/org, auditoría y smoke autenticado en entorno aislado.
S2 — Prometeo MCP Client: permitidos sólo proveedores concretos, con egress/OAuth/rollback; un caso de uso medible.
S3 — MCP Apps UI: presupuesto/proyecto en lectura; validar host, CSP/sandbox y fallback.
S4 — Integraciones Workspace por Org: reusar Settings y corregir scopes; probar revocación de membresía.
S5 — Writes acotadas: aprobación humana, idempotencia duradera, métricas, canary; ningún pago/escritura sensible sin su child spec.
S6 — Integraciones de terceros: catálogo/contratos comerciales y onboarding; fuera de MVP.

**Release gate por slice:** spec APPROVED → tests rojos → implementación → tests/tsc/lint/build → pnpm spec:validate:strict + spec:index → PR/CI terminal → merge SHA → Railway deploy terminal → health → smoke autenticado en dos tenants y dos orgs mismo tenant → métricas/flag/canary → evidencia/rollback → VERIFIED solo al cerrar cadena.

Rollback inmediato: filtración tenant/org, bypass Policy/Approval, exposed credentials, mutación sin approval, SSRF, anomalías de volumen o audit gap. Flags apagados por defecto hasta certificación; no «degradar» a endpoint legacy inseguro.

## 10. Criterios medibles de programa

- 100% de capacidades publicadas mapeadas a dueño de dominio, permisos y riesgo.
- 0 revelaciones cross-tenant/org en matriz negativa; 0 secretos en logs/tool output.
- 100% de invocaciones de prueba con decisionId o auditRef/correlation.
- 100% de operaciones no-lectura rechazadas en S1.
- 100% de conexiones revocadas bloqueadas en prueba después de revocación.
- Tests P0 reproducibles contra SHA y environment reales, CI verde, docs reconciliados.
- Fallback textual funcional cuando MCP Apps no esté disponible.
- Nunca afirmar CERTIFIED por test unitario o PR fusionado solamente.

## 11. Investigación externa (fuentes primarias, 2026-10-15)

1. Protocolo e interfaz MCP Apps: https://github.com/modelcontextprotocol/ext-apps — UI declarada por recurso ui:// en host compatible.
2. Especificación seguridad MCP Apps: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx — sandbox y CSP.
3. Autorización de UI MCP Apps: https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/authorization.md — OAuth verificado por servidor.
4. ChatGPT app capability/eligibilidad cambiante: https://help.openai.com/en/articles/12584461-creating-custom-mcp-apps-in-chatgpt — la disponibilidad depende de plan/workspace.

**Aplicado ahora:** requisitos de portabilidad, UI opcional, aislamiento, autenticación. **Backlog:** prueba host ChatGPT/Claude concreta. **Descartado:** suponer host universal o crear UI no autorizada.

## 12. Dependencias, preguntas abiertas y gates de cierre

D1. Renumeración canónica ADR-042 con backlinks e historial.
D2. Formalizar reevaluación de ADR-025: reabrir solo para un caso MCP Server read-only y decidir separadamente MCP Client externo.
D3. Determinar ruta canónica de consultas de proyecto y permisos org/ownership por API; no inventar endpoint.
D4. Reconstruir merge/deploy/CI verificados del Universal Connector y corregir metadata sin inventar evidence.
D5. Resolver alcance real de Settings → Integraciones multi-org y guardar secretos fuera del agente.
D6. Seleccionar cliente de prueba independiente y host compatible para UI, según soporte real.
D7. Definir source of truth para connection runtime, OAuth y aislamiento por org.
D8. Definir flag, SLO, rollback y responsables por slice antes de producción.

**Definition of Done documental:** spec en índice; plan/tasks/analyze/receive/checklist; ADRs sin conflicto; decisiones explícitas cerradas y aprobadas. **Definition of Done técnico:** gates detallados en sección 9 y evidencia cada slice.

**Estado actual:** REVIEW; ninguna nueva capability de este programa está aprobada, desplegada o activada por este documento. No convertirlo a APPROVED ni modificar ADR-025 hasta decisión trazable del owner.
