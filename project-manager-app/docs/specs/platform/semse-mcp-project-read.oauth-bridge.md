# S1 — Diseño propuesto de OAuth inbound y consentimientos revocables (D2 + D7)

**Fecha:** 2026-10-15  
**Estado:** PROPOSED / NOT_IMPLEMENTED / NOT_APPROVED.  
**Vinculación:** `platform.semse-mcp-project-read`, `ADR-045`, `semse-mcp-project-read.decisions.md`.  
**Requisitos ya autorizados por propietario:** `SEC-S1-01` OAuth seguro y revocable, `SEC-S1-02` consulta sin mutación/aprovisionamiento y `SEC-S1-03` aislamiento tenant/org/recurso.

> El propietario aprobó **los tres invariantes**, no seleccionó el proveedor de autorización ni autorizó activar MCP. Este documento propone un mecanismo de implementación D2/D7 para su evaluación; no altera la especificación ni la base de datos.

## 1. Política de identidad

- SEMSE conserva **User**, **Membership**, **Org**, **Tenant**, `AuthSession` y el control del negocio; un cliente MCP es un actor delegado que **nunca** recibe roles/tenant desde el cuerpo de la tool.
- El servidor MCP actúa como OAuth **resource server** y acepta únicamente tokens cuyo `iss` es el autorizado y cuyo `aud` corresponde a la URI del recurso SEMSE MCP. Un JWT de sesión de la aplicación web no debe aceptarse directamente como token MCP externo.
- El Authorization Server (AS) puede ser una extensión revisada de la capa Auth de SEMSE o un proveedor independiente autorizado; **no** se selecciona hasta D2. Si se usa AS externo, debe existir una vinculación `subject → SEMSE user + active session` verificable; no equivale a confiar en claims/roles arbitrarios del proveedor.
- Autorización delegada vía Authorization Code + PKCE (S256), state, nonce cuando corresponda, `iss` anti mix-up (RFC 9207), Client ID Metadata Documents y consent específico de cliente/recurso/organización/scopes. Redirigir solo a URIs de cliente preautorizadas y comparadas exactamente; no wildcard redirects.
- Usar `resource` (RFC 8707) al solicitar token para URL canónica del MCP, `WWW-Authenticate` con Protected Resource Metadata y metadata del AS. El token de acceso de corta duración no sustituye la consulta de sesión/membresía revocables.
- Registrar rechazo al usar token de ChatGPT/Claude/GitHub/otro `aud`, token sin consentimiento, scopes insuficientes, user/org suspendido o token de sesión revocada.

## 2. Cadena de verificación por petición (fail-closed)

```text
HTTPS MCP POST
  → Origin/Host/proxy/TLS + rate limit
  → validar versión, método, herramienta y metadata MCP
  → extraer Authorization Bearer y verificar OAuth (iss, aud/resource, exp, nbf, firma, scopes)
  → comprobar grant ACTIVE, no revocado, actor, org, client_id y scope permitidos
  → resolver usuario SEMSE y sesión ACTIVA por camino confiable de AuthService
  → verificar Membership ACTIVE + rol real actual (no claims viejos)
  → verificar projects:read y ProjectsRepository ownership (tenant/org/Project/Job no borrado)
  → ejecutar lectura SIN ensureActorContext/upsert
  → proyectar {projectId,status,correlationId} y auditoría sanitizada real
```

Si falla cualquier paso: **no** ejecutar lookup de proyecto, no provisión de identidad, no elevar scopes, no fallback legacy ni a servicios de credenciales globales. El status de conexión en `AdminIntegrationsService` no representa por sí solo consentimiento.

**Importante:** `AuthService.authenticateRequest` valida JWT SEMSE, sesión y membership; no debe recibir un OAuth bearer MCP tal cual sin intercambio/vinculación verificada. Introducir un **bridge explícito** con un contexto server-trusted, nunca construir `authContext` desde input de tool. No duplicar un segundo motor de RBAC.

## 3. Modelo de consent y revocación propuesto (no esquema aplicado)

Entidad lógica `McpDelegatedConsent` (nombre provisional):
- ID opaco, `tenantId`, `orgId`, `userId`, `oauthClientId`, `resourceUri`, `scopeSet`, `sessionBindingId` o mecanismo equivalente autenticado;
- `status`: `PENDING`, `ACTIVE`, `REVOKED`, `EXPIRED`; `createdAt`, `authorizedAt`, `expiresAt`, `revokedAt`; huella de consent/versión de política e `idempotencyKey` de aceptación si corresponde;
- No guardar tokens en texto claro; almacenar hashes/identificadores de grants y claves bajo almacenamiento seguro, con retención y acceso limitado.
- Un grant solo aplica a la intersección `grantedScopes ∩ currentSessionRoles ∩ activeMembership ∩ projectResourcePolicy`; jamás agrega permisos que el usuario no tiene.
- Revocación del user/session/membership/consent debe bloquear **la siguiente** invocación real, aun cuando el token criptográfico no haya expirado. Los caches de autorización positiva deben invalidarse de inmediato o no utilizarse para S1.

### FSM del consentimiento (propuesta)
```text
PENDING → ACTIVE → REVOKED
    └──→ EXPIRED
ACTIVE  → EXPIRED
REVOKED / EXPIRED = terminales; nueva autorización = nuevo grant versionado
```

Política de organización: un usuario con memberships de Org A y B no permite trasladar un grant de A hacia B. Cambiar organización requiere consentimiento/grant de esa organización. Rol `OPS_ADMIN` sin tenant o sin scope recurso nunca elude la frontera.

## 4. Reglas de migración/rollback

No existe autorización en esta fecha para alterar Prisma schema o generar migración. Si se acepta el modelo:
1. Child spec de persistencia `APPROVED`, `migration_status: PENDING`, revisar índices por tenant/org/client/grant y privacidad; migración **aditiva** primero, sin remover tablas del negocio.
2. API MCP permanece OFF y el módulo nuevo sin rutas expuestas. El JWT web actual no cambia.
3. Pruebas de grants concurrentes, duplicados, expirados/revocados e idempotencia, safe rollback con `MCP_SERVER_ENABLED=false`.
4. Canary no se activa con una sola respuesta `/health`; requiere fixtures autenticadas 2 tenants / 2 orgs mismo tenant y evidencia de denial cross-org.
5. No registrar `ACTIVE` en la UI general de Integraciones si el token no está validado y el consentimiento no está vinculado.

## 5. Matriz focalizada de pruebas que deben fallar cerrado

| Caso | Entrada | Esperado |
|---|---|---|
| OAuth-01 | bearer sin `aud` de SEMSE MCP | 401 + metadata de recurso; nada de lectura |
| OAuth-02 | bearer válido de otro client/org | 403/deny no enumerativo |
| OAuth-03 | sesión SEMSE revocada pero OAuth no expirado | deny en siguiente `tools/call` |
| OAuth-04 | Membership revocada dentro de tenant | deny, sin usar roles del token antiguo |
| OAuth-05 | grant Org A y request Project exclusivo Org B | deny; nunca cambia de org por argumento |
| OAuth-06 | `state` o `iss` OAuth mix-up | autorización rechazada antes de token |
| OAuth-07 | redirect no registrado o PKCE inválido | no se emite token |
| OAuth-08 | grant revocado entre list y call | listado anterior no habilita call |
| OAuth-09 | OAuth no vinculado a sesión SEMSE | fail-closed antes de ActorContextService |
| OAuth-10 | `ActorContextService.ensureActorContext` lanza/upsert | vía MCP no depende de bootstrap, cero writes |
| OAuth-11 | expiración de consent, reloj alterado, token replay | deny y auditoría sanitizada |
| OAuth-12 | API o DB auth fuera de servicio | falla cerrado (503), sin fallback a claims |

## 6. Decisiones técnicas aún pendientes

- **D2a:** primera parte o proveedor de IdP, capacidad OAuth2/PKCE, HTTPS JWKS, rotación y metadata, costos operativos y licencia.
- **D2b:** cómo enlazar consent grant a sesión SEMSE de manera revocable y con deadlines, sin mostrar token interno al host.
- **D7a:** entidad persistida, índices por scope/tenant/org, transacciones de revocación, retención/auditoría y migraciones.
- **D7b:** políticas de clientes autorizados, configuración empresarial, feature-flag kill switch y permisos del administrador de Integraciones.
- **Gates:** diseño de amenaza aprobado, especificaciones child `APPROVED`, CI, canary y evidencias de revocación antes de activar.

## Referencias primarias

- MCP authorization 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- TypeScript SDK v2 y OAuth opt-ins: https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28
- RFC 8707 (resource audience) y RFC 9207 (issuer verification): https://www.rfc-editor.org/rfc/rfc8707 , https://www.rfc-editor.org/rfc/rfc9207

**Resumen de estado:** invariantes aprobados por propietario; propuesta técnica D2/D7 sin aceptación final. No hay servidor MCP, OAuth AS/grant store ni producción modificados.
