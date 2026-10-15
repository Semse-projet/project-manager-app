---
id: "platform.semse-mcp-project-read"
title: "S1 — SEMSE MCP Server: lectura autorizada de proyecto"
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
related_files:
  - apps/api/src/modules/projects/projects.controller.ts
  - apps/api/src/modules/projects/projects.service.ts
  - apps/api/src/modules/projects/projects.repository.ts
  - apps/api/src/modules/projects/projects.policy.ts
  - apps/api/src/common/request-context.ts
  - apps/api/src/common/resource-scope.ts
  - docs/architecture/ADR-045-semse-mcp-inbound-authorization.md
related_tests: []
related_endpoints:
  - GET /v1/projects/:projectId
related_events: []
related_agents:
  - prometeo
last_verified: "NOT_VERIFIED"
---

# Spec S1 — SEMSE MCP Server: lectura de proyecto sin mutaciones

> **Estado REVIEW.** Child spec del programa `platform.semse-prometeo-interoperability`. La lectura de proyecto existente **NO demuestra** que ya exista un servidor MCP. No implementar hasta APPROVED, ADR/seguridad revisadas e índice/CI coherentes.

## 1. Problema y resultado

**Actores:** propietario o profesional con acceso efectivo al Project dentro de una organización SEMSE y cliente MCP autorizado.

**Problema:** herramientas externas no pueden consultar una vista segura de proyecto SEMSE mediante MCP sin potencialmente duplicar negocio, suplantar identidad, filtrar otro tenant/organización o exponer información financiera.

**Resultado observable:** un cliente MCP autenticado invoca **una** tool read-only; la tool resuelve un proyecto existente vía servicio canónico, devuelve una proyección mínima, registra correlación sin secretos y rechaza identidades, recursos o conexiones inválidas. Sin gateway de negocio paralelo.

## 2. Inventario AS-IS, fuentes y límites

- Existe `GET /v1/projects/:projectId` en `ProjectsController.detail` con `@RequirePermissions("projects:read")`.
- `ProjectsService.detail` delega en `ProjectsRepository.findById`. Este aplica `tenantId` y `job.deletedAt: null`; `assertProjectReadable` usa ownership por `job.clientOrgId` o `assignedProOrgId`, y OPS_ADMIN solo dentro de tenant.
- `ProjectRecord` en `ProjectsRepository.toRecord` devuelve `id, tenantId, jobId, assignedProOrgId, status`: **no devuelve** `title`, `name`, `summary`, `timestamps`.
- **AS-IS comprobado:** `AuthGuard` rellena `req.authContext` mediante `AuthService.authenticateRequest`; éste valida bearer de sesión SEMSE, `sid` y tipo access, y consulta en cada petición el estado de sesión y roles `Membership.status=ACTIVE` mediante `AuthRepository.findActiveSessionAuthorization`, con plazo máximo de 1 segundo/fail-closed. `resolveRequestContext` usa ese contexto. **S1 debe reutilizar esa seguridad y resolver el puente OAuth de audience externo → sesión/identidad SEMSE**, sin sobreescribir `authContext` desde tool args o token de proveedor.
- `ActorContextService.ensureActorContext` hace `upsert` de tenant/org/user dentro de la lectura canónica. P0: impedir que una credencial MCP externa no validada llegue a ese bootstrap; evaluar efectos secundarios de GET y confirmar que permisos/membresía ya se verificaron a través de AuthService, sin introducir otro membership lookup redundante.
- Evidencia en `docs/reportes/planning/2026-10-15-interoperability-s0-source-audit.md`. Ninguna comprobación aquí acredita Railway.

### Incluido
- Exponer nombre tentativo de tool versionada `semse.project.get_summary.v1`, exclusivamente `read`.
- Transporte MCP remoto compatible con al menos un cliente de pruebas independiente, tras decisión documentada de autenticación (OAuth, client identity, token audience), sin utilizar secretos de usuario en UI/chat.
- Reusar API / dominio existente y `projects:read`, ownership, membership, Policy, rechazo fail-closed.
- Proyección allowlist `projectId, jobId, status, sourceRef, correlationId, auditRef` (campos de auditoría realmente respaldados, no cadenas ficticias).
- Auditoría/telemetría de acceso, límites por usuario y herramienta, revocación, kill switch, feature flag OFF por defecto.
- Matriz P0 autenticada 2 tenants / 2 org del mismo tenant + roles cambiantes.

### Excluido
- Escribir/archivar/restaurar Proyectos/Jobs, sincronizar CRM, liberar pagos, obtener evidencia privada, consultar finanzas, cambiar estados o crear proyectos.
- Exponer raw `ProjectRecord`, `tenantId`, `assignedProOrgId`, nombres privados, emails o secretos en la respuesta por defecto.
- Crear un modelo alternativo de Project, RPC SQL directo desde MCP, roles en payload o permitir acceso por `x-org-id` proporcionado por el cliente.
- MCP Client **saliente** de Prometeo (ADR-025 sigue bloqueando ese slice), MCP Apps/UI y conexiones de terceros.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Permitido | Prohibido |
|---|---|---|---|---|
| Usuario SEMSE con sesión activa | `projects:read` y ownership de Project | tenant + org + project | leer proyección mínima | leer proyecto ajeno |
| Org cliente/PRO asignada | permiso individual + membership válida | recurso que controla o tiene asignado | leer detalle mínimo | inferir finanzas u otras orgs |
| OPS_ADMIN | permiso y alcance operacionales efectivos | dentro de un tenant | leer por operación auditada si política lo autoriza | cruzar tenant |
| Cliente MCP | token delegado con audience/scope, no suplantación | solo actor/recursos acordados | invocar tool permitida | cambiar roles o tenant/org |
| Prometeo | no consumidor en S1 | N/A | ninguno por esta spec | autoaprobar o ampliar scope |

**Autenticación:** token validado en servidor, con `issuer/audience/expiry`, sesión y membership activa. Decisión de OAuth/PKCE/metadata para host remoto se registra antes de APPROVED. No confiar en `Authorization` reenviado sin verificar audience/subject ni en claims de organización no corroborados. Un token de servicio no debe convertirlo en superusuario invisible.

**Errores de recurso:** API canónica puede generar 403 para org no dueña y 404 para proyecto fuera de tenant/borrado; la tool estandarizará respuesta no enumerativa segura, sin incluir projectId ajeno o stack traces. No alterar semántica API existente sin spec separada.

**Policy/Approval:** S1 solo lectura; Policy y resource ownership previos a ejecución. Approval de escritura no existe porque las escrituras son inalcanzables; `READ_ONLY` se valida en manifest/runtime.

## 4. Escenarios P0/P1

`MCP-READ-01`: actor válido org A, proyecto propio, token vigente -> respuesta exacta allowlist, correlación y trazabilidad.

`MCP-READ-02`: mismo tenant, org B no propietaria -> rechazo sin existencia, sin datos y sin lectura por token de servicio compartido.

`MCP-READ-03`: tenant B -> rechazo antes del adapter, sin filtrar Project ni tenant.

`MCP-READ-04`: user con membership revocada o rol reducido, token aún vigente -> se reevalúa contra fuente válida, rechazo.

`MCP-READ-05`: OAuth/session/token inválido, expirado, audiencia ajena o `authContext` sin procedencia confiable -> rechazo y ningún aprovisionamiento de tenant/org/user.

`MCP-READ-06`: Project archivado según políticas o Job soft-deleted -> inexistente, aunque el ID sea conocido.

`MCP-READ-07`: caller intenta mutación con method/tool alternativo, input `tenantId/orgId/roles` adicional o prompt injection -> sin mutación ni nueva autoridad.

`MCP-READ-08`: flag OFF, conexión suspendida/revocada, rate-limit alcanzado o backend degradado -> denegación previsible y fail-closed.

`MCP-READ-09`: output/tool error/log -> sin secretos, PII, org ajena o stack traces; `sourceRef/auditRef` referencian registros reales.

`MCP-READ-10`: cliente sin MCP Apps UI -> recibe salida MCP de texto/estructura autorizada.

## 5. Contratos

### MCP Tool `semse.project.get_summary.v1` (propuesta, NO EXISTENTE)

```yaml
mode: read
risk: low_per_invocation / critical_boundary
input:
  projectId: string # patrón y límite confirmados en contratos reales
trusted_context: derived_server_side # actorId, tenantId, orgId, roles, scopes
output_allowlist:
  projectId: string
  jobId: string
  status: string
  sourceRef: string # origen canónico comprobable
  correlationId: string
  auditRef: string # no fabricar sin persistencia/telemetría
never_expose: [tenantId, assignedProOrgId, tokens, financials, PII]
errors: [UNAUTHENTICATED, NOT_FOUND_OR_FORBIDDEN, CONNECTOR_INACTIVE, POLICY_DENIED, RATE_LIMITED, SERVICE_UNAVAILABLE]
```

No asumir que el cliente MCP soporte `ui://`. Registro en Tool Registry debe declarar `adapterPending` correctamente si no hay adapter.

### API existente — `GET /v1/projects/:projectId`

```yaml
auth: required
permissions: ["projects:read"]
resource_policy: ProjectReadable(actor, ownership)
side_effects: actor-context upsert exists in current implementation; investigate/mitigate
mcp_proxy: call canonical project service with verified actor, projectId
```

### UI

Sin UI en S1; clientes MCP muestran salida estructurada/texto. Estados: loading, ready, forbidden, unavailable. Nunca enviar token a recurso `ui://`.

### Prometeo

S1 no habilita tool externa en Prometeo ni realiza MCP Client. Su Tool Registry se reutiliza como contrato/registro si el análisis de wiring demuestra que esa integración es segura.

## 6. FSM, eventos y reconstrucción

- No cambiar Project/Job/Milestone/Evidence/Payment FSM.
- La lectura no publica eventos de dominio ni modifica balances.
- Registrar eventos de seguridad relevantes para acceso/bloqueo, sin crear una fila AuditLog de lectura masiva por defecto; retención y metadata en child plan.
- Prohibido que `ensureActorContext` genere nuevas entidades por una petición MCP con claims no comprobados.
- Connection lifecycle y revocación: reusar Universal Connector donde aplique, no inventar FSM.

## 7. Datos, migración y compatibilidad

- Ninguna migración presumida; si token binding, grants o revocación requieren persistencia, cambiar `migration_status` a PENDING y escribir child plan de DB/rollback antes de code.
- No editar migraciones previas; tolerancia a múltiples versiones de clientes; API existente no se altera.
- Fallo del MCP adapter no interrumpe acceso web/móvil a Projects.

## 8. Observabilidad, flag y release

- Correlation actor/tenant/org/project/connection/tool/outcome redacted; log sin token ni contenido privado.
- Límite de invocaciones y latencia definidos tras baseline, no inventar SLO.
- Flags OFF por defecto y allowlist a usuarios/tenants de prueba, canary en Railway, rollback `DISABLE_AGENT_ACCESS` o desactivar MCP entrypoint sin afectar API.
- Registrar commit SHA, CI, merge SHA, deployment terminal, health, smoke autenticado 2 tenants/2 orgs, redaction y revocation.
- No marcar VERIFIED sin esa evidencia.

## 9. Tests obligatorios antes de código

- [ ] Unit manifest/schema/read-only.
- [ ] API authz actor+tenant+org+membership y resource ownership.
- [ ] BFF/MCP contract real transport + token audience/expiry.
- [ ] Agent/service confused-deputy y `authContext` spoofing.
- [ ] No side-effects de auto-provision en la lectura MCP.
- [ ] Proyecto borrado, error 403/404, no enumeration.
- [ ] No PII/secret leak en salida y logs.
- [ ] Canary autenticado, revocación, rate limit, fail-closed.

## 10. Mapa de implementación previsto

- API: reutilizar `apps/api/src/modules/projects/**` y auth guards; transporte MCP en módulo adaptador **a seleccionar** dentro de backend canónico.
- Paquetes: Zod `packages/schemas`, Prometeo Tool Registry si reusable; Universal Connector trust según decisión inbound/outbound.
- Tests: integración y conformidad nueva, rutas exactas a fijar en plan aprobado.
- Infra: Railway API existente con flag off, sin nuevo DB/servicio de negocio.

## 11. Investigación externa pendiente de validar contra versión

1. MCP 2026-07-28 tools + Streamable HTTP: https://modelcontextprotocol.io/specification/2026-07-28/server/tools y https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
2. MCP authorization vigente 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
3. MCP Apps UI opcional: https://github.com/modelcontextprotocol/ext-apps

Aplicado ahora: authz y contratos neutrales. Backlog: host específico/UI. Descartado: exponer ProjectRecord íntegro o declarar compatibilidad universal.

## 11A. Perfil MCP remoto y autorización propuestos (actualización 2026-10-15)

- **Normativa base:** MCP 2026-07-28 para servidor inbound, con transporte **Streamable HTTP stateless** y OAuth de recurso protegido. Esta propuesta aún no constituye aceptación ni implementación. Ver ADR-045 PROPOSED.
- Cada llamada POST a MCP debe llevar metadatos de protocolo y headers verificables (`MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` para tools) y rechazar inconsistencias entre body/headers. No asumir `initialize` ni `Mcp-Session-Id` de la revisión 2025.
- Recursos protegidos usan OAuth discovery (Protected Resource Metadata), audience/resource específico de servidor MCP, validación de issuer y tokens emitidos para SEMSE; `Authorization: Bearer` en **cada** petición, no token passthrough de otras aplicaciones. HTTP `401` con challenge ante credencial ausente/expirada y `403` con control de scopes; la capa de tool no debe permitir enumeración de proyectos.
- El host MCP y la versión TypeScript SDK se seleccionan en S1 D1 antes de aprobar. Compatibilidad 2025 solo si host/protocolo heredado la necesita y hay pruebas de conformance separadas.
- Revocación y pertenencia org efectiva siguen siendo responsabilidad de SEMSE aunque el transporte sea stateless; `x-org-id` o `authContext` sin origen confiable no deben habilitar lectura. Fijar idP, `iss`, `aud`, consentimiento, membership y session revocation en D2.
- Control de `Origin`/host/proxy, TLS, rate-limit, errores y logs sanitizados; READ_ONLY prohíbe writes aunque el host publique herramientas adicionales.
- Fuentes normativas: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization y https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http .

## 12. Decisiones abiertas, gates y estado

- D1: transporte/version MCP y host independiente concreto.
- D2: vínculo OAuth externo con bearer de recurso MCP, sesión SEMSE ya comprobada por AuthService/guard, audience y revocación inmediata sin duplicar consultas fuera del plazo de 1 segundo.
- D3: `sourceRef/auditRef` durable versus telemetría con referencia recuperable.
- D4: impedir/contener upsert implícito `ActorContextService` en GET remoto.
- D5: decidir si `jobId` es admisible en salida pública a la org asignada y si la primera versión evita exponer incluso esa relación.
- D6: clasificación de errores MCP no enumerativos conservando semántica del API.
- D7: propietario/controles del estado de conexión inbound; si no hay conexión instalada, no aplicar falsamente `ACTIVE`.

**Gate:** sólo tras resolver D1–D7, obtener aprobación, actualizar `SPEC_INDEX`, implementar tests/contratos y producir CI+smoke+evidencia se habilita una lectura real en Railway. Este archivo no es un permiso para construir.
