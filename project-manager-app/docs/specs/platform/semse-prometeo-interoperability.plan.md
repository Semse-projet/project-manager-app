---
type: plan
feature: "SEMSE Prometeo Universal Connector interoperability program"
domain: "platform"
spec: "docs/specs/platform/semse-prometeo-interoperability.spec.md"
version: "2.0"
status: "DRAFT"
branch: "docs/sdd-semse-prometeo-connector-consolidation-20261015"
date: "2026-10-15"
---

# Plan técnico — interoperabilidad SEMSE/Prometeo/Universal Connector/MCP

> Programa rector; el primer PR solo registra diseño y decisiones abiertas. Cada slice necesita spec SDD 2.0 propia, aprobación y PR reversible. No ejecutar código desde una spec REVIEW.

## 1. Snapshot de verdad y límites del análisis

- Repo: `Semse-projet/project-manager-app`, raíz canónica `project-manager-app/`; rama base `main`.
- PR #797: fusionado 2026-10-06, trust contracts y código de Universal Connector. La metadata de `universal-connector-trust.spec.md` todavía contradice el estado de merge. **No tratar su deploy ni CI como confirmados**.
- PR #859: fusionado 2026-10-11, solo documentación Workspace/Integraciones; no certifica funcionamiento.
- `ADR-025-mcp-external-tool-gateway.md`: opción C aprobada el 2026-10-11 (MCP externo pospuesto). Necesita nuevo ADR/amendment para habilitar cualquier MCP Client externo.
- Dos archivos nombrados ADR-042 para decisiones distintas; pendiente corrección con referencias.
- Git HEAD exacto de cada release, SHAs y estados Railway API/Web/Worker, DB migrations, feature flags, health y e2e: **NO COMPROBADOS en esta revisión**.
- El documento `WORKSPACE_REUSE_AND_CONNECTORS.md` registra configuración tenant-wide que no autoriza conexiones por org automáticamente.
- Línea de base: Constitución 1.1, `SDD_GOVERNANCE.md` 2.0 y `SOURCE_OF_TRUTH.md` 2.2; resolver cualquier divergencia antes de codificar.

## 2. Constitution check

- [x] Arquitectura documental mantiene `apps/api` como backend canónico.
- [x] PostgreSQL/Prisma/Domain Services/Policy/Approval son autoridades; ningún adaptador escribe BD directamente.
- [x] Tool Registry y Prometeo no pueden autoescalar permisos.
- [x] Evidence/Payment Governance no se abren a herramientas externas en MVP.
- [ ] Spec paraguas aprobado formalmente.
- [ ] Child spec de cada slice aprobada e indexada.
- [ ] Revisión ADR-025, colisión ADR-042 y estado real de Universal Connector reconciliados.
- [ ] Fuente exacta de permisos por recurso y org confirmada en código.

## 3. Arquitectura de ejecución (propuesta)

**Publicar herramientas SEMSE:** host compatible → adaptador MCP Server → autenticación y binding del actor → API canónica → Policy/ownership/Tool Registry → servicio de dominio → auditoría y proyección autorizada → salida MCP. No exponer tablas, secretos ni servicios internos.

**Consumir externas:** Prometeo Runtime → Tool Registry → evaluación Policy y delegación → adaptador MCP Client → Universal Connector runtime trust + egress/OAuth/scope → servidor MCP allowlisted. La respuesta externa no puede crear nuevas instrucciones privilegiadas ni saltarse aprobación.

**Interfaz:** recursos MCP Apps `ui://` proporcionan UI opcional en host compatible y segregado. No hay lógica de negocio en HTML/JS ni sesión/secretos persistentes en la UI. Fallback textual siempre.

**Workspace:** `Dashboard → Settings → Integraciones` y Workspace usan vistas del mismo control plane y permisos; nunca una segunda base de conexiones.

### Mapa de ownership

| Componente | Conserva autoridad sobre | Sólo adapta |
|---|---|---|
| `apps/api/src/modules/` | proyectos/jobs/Estimate/BuildOps/Evidence/Payment Governance | adaptadores llaman endpoints de dominio |
| Auth/RBAC/Policy/Approval | identidad, pertenencia, recursos, grants y autorizaciones | MCP verifica los mismos gates |
| Tool Registry Prometeo | exposición de capacidades y riesgo por tool | MCP registro de wrappers |
| `packages/shared/src/universal-connector/` | contratos de confianza y enforcement reusable | proveedor específico implementa transporte |
| `apps/web` | UX y rutas BFF existentes | Apps UI opcionales por host |
| Audit/Evidence | hechos históricos y custodia | cada invocación enlaza referencias |

## 4. Slices reversibles y dependencias

| Slice | Alcance entregable | Dependencia bloqueante | Verificación |
|---|---|---|---|
| S0 | Auditoría AS-IS, tabla verdad por capacidad, ADRs reconciliados, spec padre + children | Ninguna mutación productiva | trazabilidad módulo→código→test→CI→runtime |
| S1 | MCP Server read-only `semse.project.get_status.v1` (nombre propuesto) | S0, child spec APPROVED | usuario A lee su proyecto, usuario B/org B no; logs/audit |
| S2 | MCP Client externo para un proveedor allowlisted y un caso real | actualizar ADR-025, S0/S1 y egress aprobado | permisos reducidos, token revocado, SSRF bloqueado |
| S3 | MCP Apps visual read-only (Estimate o Projects) | S1 y host compatible real | CSP/sandbox, autorización, fallback texto |
| S4 | Integraciones visibles por Org en Workspace | F10/ADR-040 permisos/estado segmentados | dos org del mismo tenant, revocación membership |
| S5 | Writes puntuales no económicos | S1-4, approval e idempotencia por acción | human approval, retries 10x, rollback |
| S6 | Catálogo terceros/comercialización | experiencia de piloto y controles completos | onboarding, cuotas, contrato de uso y auditoría |

No forzar orden S2/S3 si la compatibilidad del host cambia; conservar sus gates independientes. **S1 no despliega escrituras.** No abordar pagos, escrow, firmas o cambio de FSM sin specs de cada dominio.

## 5. S0 — auditoría y normalización antes de código

1. Capturar SHA `main` y listar `packages/shared/src/universal-connector/**`, Tool Registry F2, rutas `v1/agents/copilot`, `v1/prometeo/**`, rutas BFF y consumers UI.
2. Confirmar adopción de `PrometeoToolInvocationAudit`, approval canonical, binding tenant/org y callback de cada tool; distinguir declared vs wired.
3. Comparar PR #797 con spec Universal Connector y pruebas actuales. Cambiar `merge_status` solamente con commit demostrado; CI/deploy con evidencia propia.
4. Resolver numeración ADR-042 con índice y enlaces; documentar relación con Operational Intelligence/Omniverse, sin mezclar programas.
5. Reabrir ADR-025 de forma explícita si el dueño aprueba un caso real para consumir MCP externo.
6. Inventariar CRM/ERP adapters REST/GraphQL/webhooks existentes; clasificar REGISTERED, IMPLEMENTED, TESTED, DEPLOYED, ACTIVE y ownership.
7. Capturar snapshot Railway y ejecutar validaciones autorizadas; no asumir flags ni migraciones activas.
8. Seleccionar ruta API canónica y test fixtures multi-tenant/org para la lectura de proyecto.

## 6. S1 — MCP Server read-only

- Registrar contrato de tool en Tool Registry con `mode=read`, Zod input/output y permisos exactos del recurso.
- Exponer endpoint MCP por transporte compatible con cliente seleccionado; autenticación obligatoria, lifecycle y rate limits. Elegir ubicación en API existente o edge controlado, sin nuevo Business Kernel.
- Derivar identidad y tenant/org de sesión y membership activos, no de argumentos `tenantId/orgId` sin autoridad.
- Resultado mínimo `{projectId,name,status,summary,sourceRef,correlationId,auditRef}` sujeto a proyección permitida; no copiar PII o adjuntos por defecto.
- Cero writes por endpoint/manifest/policy; bloquear intento de elevar scope, cross-org y revocación.
- Tests de contrato, integración HTTP/MCP, end-to-end autenticado 2 tenants + 2 org dentro de mismo tenant, límites, logs sanitizados.
- Canary desactivado por defecto, protegido por allowlist test; registrar SHA, entorno, resultado de prueba y rollback.

## 7. S2 — MCP Client externo (NO autorizado por el ADR actual)

- Abrir amendment a ADR-025 y aprobar child spec de riesgo crítico; sin esto NO implementar.
- Fijar proveedor y `capabilityId`, credenciales opacas en secret manager, control de scopes/provenance, OAuth/PKCE si aplica.
- Denegar hosts no permitidos, IP privadas, metadata endpoints, redirects que cambien origen, DNS rebinding, rate/cost spikes.
- Tratar respuesta como UNTRUSTED; no tool chaining ni acciones críticas sin evaluación adicional.
- Tests de confused deputy, expiración/revocación, intento prompt-injection, SSRF y auditoría.

## 8. S3/S4/S5 — UX, organizaciones y writes

- S3: UI `ui://` con CSP estricta, sandbox y fallback; verificar compatibilidad con los hosts elegidos y su plan/workspace real.
- S4: segmentar estado Workspace tenant+org+project y reparar guard backend; migración/backfill reversible si cambia persistencia; no autorizar por selector visual.
- S5: distinguir `read|write|delete|sync|execute`, exigir aprobación del acto y resource scope; durable idempotency claim + fingerprint, outbox si transición de negocio, auditoría, límites por actor y kill switch.
- Datos históricos externos no crean ownership ni derecho de modificar información de SEMSE.

## 9. Seguridad, operabilidad, métricas y rollback

P0 sin waiver: 0 accesos cross-tenant/org, 0 fugas secretos, 0 bypass Policy/Approval, 0 writes sin autorización, 0 SSRF. Cada resultado: actorId, tenantId, orgId, connectionId, tool, resource, decisionId/auditRef y correlationId (sin secretos). Monitorizar rechazo por código, error rate, latencia, revocación, límites, retries y actividad anómala.

SLO cuantitativos y umbrales de alertas: establecer en child spec según baseline medido; no inventar latencias o disponibilidad actuales. Controles de emergencia: DISABLE_AGENT_ACCESS, DISABLE_WRITES, SUSPEND_CONNECTION, EMERGENCY_STOP. Deshabilitar por flag y preservar evidencia; no fallback legacy inseguro.

## 10. Investigación externa y aceptación

Consultar y versionar en child specs tres fuentes primarias: `modelcontextprotocol.io` (protocolo/autorización), `github.com/modelcontextprotocol/ext-apps` (MCP Apps y compatibilidad UI) y documentación oficial del host de prueba. Revalidar versión antes de implementar.

**Gate S0:** análisis/requisitos/matriz cerrados; ADRs reconciliados; spec y children listos para revisión. **Gate S1:** tests y CI en SHA, authz real, smoke Railway y canary read-only auditado; cada fase se evidencia por separado. **No hay autorización implícita de implementación por aprobar este plan.**
