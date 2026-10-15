# S1 — Análisis de preparación MCP Server de solo lectura
**Fecha:** 2026-10-15  
**Spec:** `platform.semse-mcp-project-read` (REVIEW)  
**ADR:** `ADR-045-semse-mcp-inbound-authorization.md` (PROPOSED)  
**Programa:** `platform.semse-prometeo-interoperability`  
**Verificación:** lectura del código de `main` y estándares primarios; no hay aún código MCP S1 ni prueba runtime, CI ni deployment de S1.

## 1. Comparación contra el código implementado (AS-IS)

| Área | Evidencia exacta en repositorio | Qué se reutiliza | Brecha antes de escribir MCP |
|---|---|---|---|
| API Project | `apps/api/src/modules/projects/projects.controller.ts` `GET /v1/projects/:projectId` y `@RequirePermissions("projects:read")` | route/service/repository y response wrapper | adapter read-only, SDK y schema |
| Respuesta | `ProjectsRepository.toRecord` entrega `id,tenantId,jobId,assignedProOrgId,status` | solo `id,jobId,status` en allowlist provisional | `title/summary` NO disponibles; `auditRef` no inventable |
| Ownership | `ProjectsRepository.findById`, `assertProjectReadable` y `resource-scope.ts` | chequeos tenant + org cliente/PRO asignada; OPS no cruza tenant | probar no enumeración entre orgs de mismo tenant |
| Autenticación HTTP | `apps/api/src/common/auth.guard.ts` adjunta `req.authContext` con `AuthService.authenticateRequest` | **AuthGuard**, AuthService y validación de sesión | traducir credencial OAuth de recurso MCP a una identidad SEMSE sin token passthrough |
| Membresía revocable | `AuthRepository.findActiveSessionAuthorization` consulta `AuthSession`, `User.status` y `Membership.status=ACTIVE` | comprobación actual por solicitud y roles intersectados | pruebas con token válido tras revocación; no duplicar lookup |
| Deadline | `AuthService.accessLookup` usa timeout 1000 ms y fail-closed | deadline y comportamiento 503 | medir carga en path MCP; evitar consultas de membresía redundantes |
| Read-only sin side effects | `ProjectsRepository.findById` llama `ActorContextService.ensureActorContext` | mantener dominio canónico | la lectura puede hacer upserts; control que un token MCP no cause bootstrap no autorizado; evaluar ausencia de cambios al leer |
| Control de conexiones | `packages/shared/src/universal-connector/enforcement.ts` valida status, tenant, scope, policy y read-only | trust boundary donde aplique | no modela permiso por Org; la regla del proyecto se aplica adicionalmente |
| Tool Registry | `prometeo/tool-governance/tool-governance.policy.ts` evalúa roles y approval de descriptors | inventario/manifest canónico | policy de tool no sustituye RBAC por recurso |
| Admin Integrations | `admin-integrations.service.ts` gestiona comprobaciones por tenant | reutilizar UX/control plane | NO equivale a conexión org-scoped ACTIVE ni a consentimiento OAuth |
| SDK | no se acreditó dependencia runtime S1 `@modelcontextprotocol/server` | API NestJS existente | package/versión exactos y forma de montar HTTP requieren child plan |
| ChatGPT | host comercial independiente del negocio SEMSE | prueba de compatibilidad posterior | entitlement/permisos de workspace y configuración por host no verificadas |

## 2. Precisión normativa — MCP 2026-07-28

La versión canónica actualizada utiliza transporte Streamable HTTP con peticiones POST, sin sesión de protocolo persistente; el SDK TypeScript v2 usa `@modelcontextprotocol/server`, no el paquete v1 `@modelcontextprotocol/sdk`.

Para `tools/call`, comprobar:
- Encabezado `MCP-Protocol-Version: 2026-07-28` que coincida con `params._meta["io.modelcontextprotocol/protocolVersion"]`, `Mcp-Method` que coincida con el body y `Mcp-Name` para la tool, incluyendo seguridad de normalización de headers.
- `Accept: application/json, text/event-stream`; content-type JSON o SSE por solicitud, sin GET stream antiguo.
- Validación `Origin` (cuando enviado) y host, TLS y proxy. `tools/list` nunca concede acceso a `tools/call`.
- Credenciales OAuth `Authorization: Bearer` con issuer/resource-audience/expiry/consent verificados, sin token passthrough.
- Compatibilidad legacy 2025 solo si hay un host concreto que la necesite, sin habilitar negociación a costa de seguridad.

Fuentes: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http, https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization y https://ts.sdk.modelcontextprotocol.io/v2/ .

## 3. Threat → control → test → evidencia prevista

| ID | Amenaza | Enforcement point | Test rojo obligatorio | Resultado |
|---|---|---|---|---|
| S1-A01 | Token externo aceptado como SEMSE | MCP resource auth + issuer/audience | token de GitHub/otro audience | 401 sin crear actor |
| S1-A02 | Sesión revocada | AuthService + AuthRepository | JWT con session.status REVOKED | 401/fail-closed |
| S1-A03 | Rol/membership revocado | AuthService + AuthRepository | token no expirado pero Membership REVOKED | 401/403 sin lectura |
| S1-A04 | Fuga cross-tenant | Domain scope + repository tenant predicate | actor A pide project tenant B | denegado sin contenido |
| S1-A05 | Fuga cross-org mismo tenant | Domain scope + ownership | actor Org A pide proyecto exclusivo Org B | denegado sin contenido |
| S1-A06 | Confused deputy | delegated actor context + Policy | token servicio con acceso alto invocado por usuario sin permiso | no acceso |
| S1-A07 | Auto-provision en GET | AuthGuard + bloqueo de bootstrap no autorizado | OAuth no asociado a sesión intenta lectura | cero filas nuevas y rechazo |
| S1-A08 | Enumeración | MCP error projection | IDs ajenos versus inexistentes | respuesta de tool indistinguible en información privada |
| S1-A09 | Mutación por read | MCP manifest/runtime guard | POST/PATCH/DELETE/sync como tool | ninguna tool ni escritura |
| S1-A10 | Header/body mismatch | MCP transport validation | `Mcp-Method`, `Mcp-Name`, protocolVersion incompatibles | 400 |
| S1-A11 | Origen no confiable | HTTP Origin/Host gate | Origin malicioso/DNS rebinding | 403 |
| S1-A12 | Secrets/PII | response projection + logger | salida y audit logs tras error | sin tokens/PII/otras org |
| S1-A13 | Fallo DB auth | AuthService.accessLookup | DB lenta > plazo | 503 fail-closed, sin fallback a claims |
| S1-A14 | Proyecto soft-deleted | Domain filter | Project Job.deletedAt | not found, no payload |
| S1-A15 | Compatibilidad del host | SDK cliente independiente | tools/list + tools/call en versión fijada | ambos flujos completos |
| S1-A16 | Revocación de consentimiento | MCP binding store (diseño pendiente) | consent revocado, token aún válido | siguiente llamada denegada |

## 4. Decisiones previas a APPROVED

- **D1 protocolo:** recomendación MCP 2026-07-28 con SDK TypeScript v2, `@modelcontextprotocol/server` adaptado a NestJS, prueba de protocolo con cliente `@modelcontextprotocol/client`. Compatibilidad de ChatGPT y otros hosts es gate distinto, no promesa universal.
- **D2 OAuth:** recomendación resource server con OAuth, audience dedicada `semse-mcp`, consentimiento por actor/org/capability, sesión SEMSE activa y efectiva por request. Evitar aceptar directamente JWT normal de la web en endpoint público MCP; no hay issuer/audience OAuth 2.1 delegado demostrado en el monorepo.
- **D3 auditoría:** no crear `auditRef` falso; usar `correlationId` real y registro de acceso sanitizado recuperable. Si no hay auditRef durable, hacer campo opcional o omitirlo hasta aprobación del storage/retención.
- **D4 efectos secundarios:** reconciliar `ensureActorContext` y evitar auto-upserts por llamadas MCP. Es evidencia de riesgo, no bypass probado.
- **D5 exposición mínima:** recomendar `projectId,status` como salida pública inicial; `jobId` opcional solo tras prueba de proyección autorizada y necesidad de producto.
- **D6 errores:** proyectar error uniforme `RESOURCE_UNAVAILABLE` para objeto ausente/ajeno, conservando 401/403 OAuth a nivel HTTP y observabilidad interna diferenciada sin leak.
- **D7 control plane:** no crear estado ACTIVE ficticio. Diseñar binding de conexión MCP inbound con actor, org, OAuth client, scopes, expires/revocation, feature flag y auditoría; migración sólo después de child schema.

## 5. Matriz de host sin bloquear S1 artificialmente

1. **Cliente de referencia:** SDK TypeScript MCP v2 ejecutado en entorno de prueba. Esto valida protocolo sin depender de una cuenta personal ni de un proveedor.
2. **ChatGPT:** probar solo cuando el workspace/plan/tipo de conexión permita crear una app MCP; su disponibilidad puede variar según plan y administración. Fuente oficial: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
3. **Otros hosts:** Claude/IDE/agentes, pruebas independientes de discovery, OAuth y compatibilidad; ausencia de MCP Apps UI implica fallback textual.

## 6. Resultado del análisis

**S1 todavía no está aprobado ni implementado.** Puede concluirse la definición contractual read-only, inventariar el SDK/identidad y preparar pruebas negativas antes de codificar. No es admisible afirmar que `AuditRef` existe o que ChatGPT ya está conectado. El siguiente gate es revisar el ADR-045 y cerrar D1-D7 con decisiones y evidencia, no activar Railway.
