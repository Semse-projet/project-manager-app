---
id: "ADR-045"
title: "SEMSE MCP Server entrante: autenticación y límite de autoridad por recurso"
status: "PROPOSED"
date: "2026-10-15"
owners: ["semse-core", "security", "prometeo"]
---

# ADR-045 — SEMSE MCP Server entrante: autenticación y límite de autoridad

> **PROPUESTA, NO APROBADA.** Programa padre `platform.semse-prometeo-interoperability`; child spec S1 `platform.semse-mcp-project-read` en REVIEW. Esta ADR no revoca ADR-025, que mantiene aplazado **Prometeo como cliente de herramientas MCP externas**. La publicación inbound de tools SEMSE es otra dirección de flujo y requiere aceptación separada.

## Contexto verificado en SEMSE

- `GET /v1/projects/:projectId` ya existe, con `@RequirePermissions("projects:read")` y control de ownership por dominio.
- `ProjectsRepository.findById` resuelve tenant, `Job.deletedAt` y scope cliente/PRO; `toRecord` no proporciona `name/title/summary`.
- **Confirmado en código actual:** `AuthGuard.canActivate` establece `request.authContext` mediante `AuthService.authenticateRequest`; ese servicio verifica el bearer SEMSE de tipo access con `sid`, lee `AuthSession` y roles de `Membership.status=ACTIVE` a través de `AuthRepository.findActiveSessionAuthorization` **en cada petición**, y limita esa lectura a 1 segundo (falla cerrado si no responde). `resolveRequestContext` reutiliza `authContext` ya verificado. La brecha MCP es **adaptar la identidad OAuth del host a esta cadena SEMSE**, sin inventar roles/tenant ni confiar en tokens de otra audience.
- Después de la autorización canónica, `ProjectsRepository.findById` llama a `ActorContextService.ensureActorContext`, que puede hacer upsert de tenant/org/user. En el camino MCP, impedir que una credencial externa no vinculada a sesión SEMSE llegue a este bootstrap; evaluar el impacto de writes en GET. **No afirmar que el sistema actual omite revisión de Membership**; esa revisión existe en `AuthService`.
- `Universal Connector` controla estado/conexión/tenant y policies, pero su `ConnectorExecutionContext` no demuestra ownership por Org. Tool Registry F2 evalúa permisos/approval pero no sustituye el domain guard.
- `AdminIntegrationsService` conserva estados por tenant que **no equivalen** a consentimiento ni conexión ACTIVE por empresa.

## Propuesta de decisión

**Opción A (recomendada para S1):** MCP Server remoto **read-only**, alojado detrás del backend/API canónico SEMSE y su autenticación, sin Business Kernel ni Policy Engine nuevos. Adaptador fino, scope de acceso mínimo y verificación de resource ownership **cada llamada**. Versionar el protocolo y comprobar compatibilidad con el host elegido.

**Opción B:** crear un nuevo servicio de negocio/MCP con roles y persistencia propios. Rechazada como recomendación por duplicación de autoridad, superficie de filtración y carga operativa.

**Opción C:** mantener solo API REST; no publicar MCP inbound. Válida si no se puede demostrar identidad delegada/host compatible, evita una exposición sin controles.

Ninguna opción se declara ACCEPTED hasta revisión de owner/seguridad. **ADR-025 Opción C sigue vigente para MCP Client saliente** incluso si se acepta la opción A inbound.

## Perfil de protocolo propuesto

- Referencia técnica actual: MCP **2026-07-28** (core stateless y Streamable HTTP), con `POST` a un endpoint MCP; cada request carga metadatos de protocolo y headers `MCP-Protocol-Version`, `Mcp-Method` y `Mcp-Name` donde corresponda.
- No modelar una sesión MCP persistente ni depender de `initialize`/`Mcp-Session-Id` para esta versión. **La sesión SEMSE/OAuth sí permanece sujeta a identidad y revocación.**
- Rechazar versión/header/body incompatibles. Si se necesita compatibilidad con 2025-11-25, validarla con SDK/cliente elegido y pruebas de downgrade explícitas; no conceder permisos por negociación de versión.
- `Origin` obligatorio de validar cuando está presente; control `Host`, HTTPS, proxy confiable, rate limit por actor y resource; responder fail-closed a orígenes no autorizados.
- `tools/list` puede exponer metadatos limitados; `tools/call` se autoriza en HTTP y dominio; list cache/manifest no confiere permiso de invocación.

## OAuth / Resource Server: requerimientos para aceptar A

1. Servidor MCP es recurso protegido OAuth; acceso autenticado para **todas** las tools S1. Discovery `/.well-known/oauth-protected-resource` y metadata del authorization server documentada.
2. Usar `Authorization: Bearer` en cada petición, nunca tokens en query, prompt, respuesta, `ui://` ni logs.
3. Validar `iss`, `aud/resource` específico del MCP server (RFC 8707), firma/JWKS o introspección autorizada, `exp/nbf`, scopes y revocación/sesión cuando aplique. **Prohibir token passthrough:** tokens de GitHub, ChatGPT, Claude, Railway o un proveedor externo no se aceptan como tokens de SEMSE MCP.
4. Flujo de autorización del host con OAuth 2.1/PKCE y Client ID Metadata Documents si disponible; Dynamic Client Registration es compatibilidad heredada, no base nueva. Estado de consent por cliente, org, actor, resource, scopes y expiración.
5. Exponer HTTP `401` + `WWW-Authenticate`/metadata ante token ausente/inválido; `403` cuando hay token válido sin scopes. Recurso ajeno se responde mediante política de no enumeración en el plano de tool sin exponer datos.
6. Resolver membresía vigente desde autoridad SEMSE **en cada llamada o desde sesión revocable con invalidación efectiva**; `orgId` del usuario no puede ser sustituido por argumento del tool, cookies del host ni cabeceras reenviadas sin verificar.
7. `authContext` debe provenir únicamente de `AuthGuard` / `AuthService` confiables o de un puente OAuth equivalente revisado; no permitir rutas públicas que acepten `x-tenant-id`, `x-org-id` o roles arbitrarios como identidad. Reutilizar la consulta activa de Membership/Session y su deadline fail-closed de 1 segundo como baseline, sin añadir otra lectura de DB redundante no acotada. Auditar el posible upsert de `ActorContextService` en GET.
8. Revocar consent/conexión o membresía bloquea siguiente `tools/call` aunque token no haya caducado (si requiere introspección, sesión o denylist, definir almacenamiento y migración aditiva).
9. Separar autenticación HTTP, autorización `projects:read`, ownership por Job/Project y proyección de datos; ninguna etapa puede sustituir la siguiente.

## Contrato de S1 y límites

Tool tentativa `semse.project.get_status.v1` (nombre solo de producto): input `projectId` cadena bajo schema validado; output mínimo `projectId,jobId,status` y referencias de origen/traza existentes. No suponer UUID ni devolver `tenantId,assignedProOrgId`, datos financieros, evidencias o campos ficticios.

**P0 obligatorio:** identidad correcta, dos tenants, dos orgs mismo tenant, scopes, cambio de membresía, token revocado, token de otro audience, `authContext` falsificado, `Origin` inválido, headers incompatibles, soft-deleted Job, no upsert por GET y auditoría sanitizada. READ_ONLY bloquea writes en descriptor y runtime.

La herramienta `semse.project.get_status.v1` es el nombre recomendado para S1: no se usará `get_summary` mientras el dominio no entregue un resumen real y autorizado. El cambio de nombre ocurre solo en diseño; no hay clientes MCP existentes que migrar.

## Riesgos y observabilidad

- OAuth token de otro resource aceptado → bypass crítico.
- Confused deputy: servicio con credencial global ignora identidad y org del usuario → fuga crítica.
- `ActorContextService` auto-provisiona recursos de claims no validados → efecto secundario/privilege bootstrap.
- MCP handshake 2025 implementado como si fuera 2026 → error de compatibilidad / autorización indefinida.
- Logs registran bearer/cuerpo → exposición de credenciales.
- Gobernanza: dos controles de confianza no equivalen a membership org → cross-org.

Auditar `actorId`, `tenantId`, `orgId`, `connectionId` si existe, capability, recurso, decisión y correlation; nunca credenciales ni datos privados. Rate limits y SLO tras baseline; flags OFF por defecto y `emergency_stop` para surface MCP.

## Criterio de decisión

Para pasar a ACCEPTED: seguridad valida proveedor de identidad real, client onboarding, versión/host MCP, token audience, revocación de membership, consentimiento y representación de conexión; se actualizan SDD child spec y ADR con decisión fechada, actor aprobador, firmas/reviews y alcance. De lo contrario mantener opción C. Incluso ACCEPTED no equivale a implementación ni deployment.

## Fuentes primarias verificadas al 2026-10-15

1. Especificación MCP 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
2. Autorización HTTP MCP 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
3. MCP SDK TypeScript v2 y versión de 2026: https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28

**Aplicado:** propuesta authn/authz, versionado y threat model. **Backlog:** selección de host/SDK/IdP y conformidad reproducible. **Descartado:** diseño basado exclusivamente en version 2025 o autoaprobar MCP externo por existencia del SDD.
