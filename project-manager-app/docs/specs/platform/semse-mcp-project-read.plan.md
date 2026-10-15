---
type: plan
feature: "S1 SEMSE MCP project read"
domain: "platform"
spec: "docs/specs/platform/semse-mcp-project-read.spec.md"
version: "2.0"
status: "DRAFT"
branch: "docs/sdd-semse-prometeo-connector-consolidation-20261015"
date: "2026-10-15"
---

# S1 Plan técnico — MCP Server read-only

**Prerequisito:** spec `platform.semse-mcp-project-read` APPROVED, decisiones D1–D7 cerradas. No implementar con spec REVIEW.

## 1. Snapshot requerido
- `main` SHA y Railway API/Web SHA: obtener antes de code.
- Confirmar `ProjectsController.detail` / `ProjectsService.detail` / `ProjectsRepository.findById` y response `ProjectRecord`.
- Confirmar `authContext` source, membership revocation, actor-context side effects, tenancy.
- Confirmar Universal Connector Trust y Tool Registry versiones/CI/activation, sin inferencia por PR #797.

## 2. Autoridad
- Backend `apps/api` conserva negocio; MCP adapter transporta entrada/salida, nunca lee DB ni decide ownership.
- Actor/token y pertenencia efectivos en cada invocación, `projects:read`, `canReadProject`/tenant constraints, no token de servicio sobrerrepresentado.
- Output allowlist `projectId,jobId,status,sourceRef,correlationId,auditRef`; validar D5 y evidencia de `auditRef`; no `name`, `summary` o finanzas en V1.

## 3. Fases reversibles
A. Capturar contratos y amenazas, test fixtures de 2 tenants y dos org del mismo tenant; definir OAuth/issuer/audience/PKCE si remoto.
B. Tests primero: auth, spoofed actor, cross-tenant/org, revocation, soft-delete, no mutation, redaction, rate limit, idempotencia si se almacena estado.
C. Resolver/proteger el efecto de `ActorContextService.ensureActorContext` bajo ruta MCP y validar credenciales/roles reales; sin auto-provisión por lectura.
D. Implementar tool read-only bajo Tool Registry/transport MCP elegido; únicamente delega al API y proyecta campos autorizados.
E. Ejecutar tests, `pnpm spec:validate:strict`, `pnpm spec:index`, typecheck/build/lint, CI terminal. Mantener flags OFF.
F. PR separado de implementación tras APPROVED, merge SHA, Railway terminal + health, smoke autenticado por permisos, flag por tenant, rollback y recibos SHA.

## 4. Seguridad obligatoria
- No endpoints públicos sin authenticación; recursos no enumerables, credenciales fuera de prompts y UI.
- Egreso externo no aplica a S1; no autorizar MCP Client de Prometeo sin reconciliar ADR-025.
- Rate/quotas + kill switch + auditoría sin PII; no modificar `GET /v1/projects/:id` sin spec del dominio.
- Bloquear `POST/PATCH/DELETE`; fail-closed en conexión/sesión revocada.

## 5. Datos/eventos
No DB migration planeada hasta que D2/D3/D4 definan persistencia; cualquier cambio necesita expand/contract, checksum y forward-fix. Reads no cambian FSM ni pagos; acceso bloqueado con código seguro.

## 6. Riesgos y pruebas
- **P0:** reusar header auth sin audience/membership; personal/tenant provisionado por GET; info leak same tenant different org.
- **P1:** auditoría ficticia, host MCP sin OAuth compatible, fallbacks inseguros, rate limit ignorado.
- Rollback por flag OFF; nunca fallback a ruta less-governed.
- Definition of Done = CI+merge+deploy+canary autenticado+audit+rollback+evidencia, estados separados.

## 7. Investigación externa para diseño aprobado
Consultar especificaciones primarias MCP y autorización, y documentación del host concreto con compatibilidad real. La versión/transport elegido debe fijarse antes de pruebas de conformidad.
