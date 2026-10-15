# S1 — Acta de decisiones para autorizar el primer SEMSE MCP Server

**Fecha:** 2026-10-15  
**Programa:** `platform.semse-prometeo-interoperability` (SDD REVIEW).  
**Spec hija:** `platform.semse-mcp-project-read` (REVIEW).  
**ADR:** `ADR-045-semse-mcp-inbound-authorization.md` (PROPOSED).  
**Modalidad:** requisitos de seguridad **aprobados por el propietario en conversación el 2026-10-15**; las opciones de implementación D1–D7 siguen pendientes de aprobación técnica. **No cambiar los estados de la spec a APPROVED ni de la ADR-045 a ACCEPTED sin resolver sus decisiones pendientes y revisión de seguridad.**

## Decisión del propietario — requisitos de seguridad APROBADOS (2026-10-15)

**Fuente de autoridad:** aprobación explícita del propietario de SEMSE Project en la conversación de trabajo del 15-oct-2026, tras solicitarle ratificar tres condiciones obligatorias para S1. **Alcance de la autorización: requisitos de seguridad, no elección de IdP/SDK, no aceptación automática de D1–D7, no aprobación de un rollout ni permiso para activar producción.**

| Invariante | Decisión del propietario | Evidencia de cumplimiento necesaria |
|---|---|---|
| **SEC-S1-01: OAuth e identidad SEMSE** | **APROBADO — obligatorio.** Los clientes MCP deben operar con identidad SEMSE vinculada de manera confiable, scopes mínimos y revocación; prohibidos tokens passthrough, identidad arbitraria en headers y roles sobreelevados. | OAuth issuer/audience/consent validados, sesión y membership vigentes, pruebas de revocación y de token de otra audience. |
| **SEC-S1-02: Cero aprovisionamiento en lectura** | **APROBADO — obligatorio.** Una consulta MCP no puede crear Tenant, Org, User ni modificar Project/Job/Evidence/Payment. | Tests de no efecto lateral con conteos de filas y registro de operaciones Prisma; resolver llamada actual a `ActorContextService.ensureActorContext` antes de habilitar MCP. |
| **SEC-S1-03: Aislamiento tenant/org/recurso** | **APROBADO — obligatorio.** Comprobar tenant, membership activa, scope org, `projects:read` y ownership del Project por petición. | Fixtures autenticadas con 2 tenants, 2 orgs en uno de ellos y usuarios con grants/revocación; negativas cross-org/cross-tenant sin fuga. |

**Consecuencia operativa:** estas tres salvaguardas ya no son opcionales en ninguna variante de S1. Si no se demuestra una de ellas, mantener la superficie MCP desactivada (`INACTIVE`), incluso si todas las pruebas de documentación pasan.

**Quedan sin decidir:** proveedor o implementación OAuth (D2), compatibilidad exacta del host/SDK (D1), modelo de consentimiento y revocación (D7), estructura de auditoría (D3), tratamiento de `ensureActorContext` (D4), proyección de salida (D5) y errores externos (D6). La ratificación de principios no equivale a aprobación de sus soluciones.

## Finalidad

Desbloquear **únicamente** S1: una tool MCP remota **read-only** para consultar estado de un Project autorizado en SEMSE, sin crear otro kernel de negocio ni otro motor de Policy. La tool propuesta se llama `semse.project.get_status.v1`. No abre MCP Client saliente de Prometeo (ADR-025, opción C vigente), no crea MCP Apps ni permite cambios sobre Project, Evidence, Payment o Escrow.

**Documento de profundización D2/D7:** `docs/specs/platform/semse-mcp-project-read.oauth-bridge.md`. Propone OAuth resource audience, vinculación de sesión SEMSE, consent por empresa y revocación transaccional, pero mantiene pendiente la elección concreta de Authorization Server y persistencia.

## Decisiones pendientes (recomendación prellenada, sujetas a aceptación explícita)

| ID | Recomendación precisa | Motivo/evidencia | Alternativa rechazada/prohibida | Gate para APPROVED |
|---|---|---|---|---|
| **D1** | Exponer endpoint MCP HTTP remoto bajo `apps/api` con SDK TypeScript v2 `@modelcontextprotocol/server`; soportar inicialmente **2026-07-28** modern-only en el contrato S1. Cliente de prueba `@modelcontextprotocol/client` con negociación explícita `{mode:{pin:"2026-07-28"}}`. | La spec 2026 exige POST por request, metadatos/headers y no sesión de transporte; SDK v2 **por defecto habla legacy** si no hay opt-in. | Instalar SDK v1; suponer que usar v2 habilita automáticamente modern; mezclar sesiones v2025 sin tests. | Documentar versions/lockfile, montaje NestJS, prueba `server/discover`, `tools/list/call` y negative header mismatches. |
| **D2** | Resource Server OAuth con `iss`, `aud` específica de SEMSE MCP, firma/expiración y scopes `projects:read`; consentimiento vinculado a actor, org, cliente y capability. Traducir a identidad de **sesión SEMSE vigente** tras verificación confiable; nunca token passthrough. | `AuthGuard` ya valida sesiones activas y `Membership.status=ACTIVE` en cada solicitud con deadline de 1000 ms. Su JWT interno no es automáticamente un token OAuth con `iss/aud` para un host externo. | Usar access JWT del web en host MCP público; token compartido OPS_ADMIN; claims `x-org-id` desde cliente; segundo lookup DB sin límite. | Diseñar OAuth Authorization Server/IdP o puente validado, discovery, consentimiento revocable, sesión vigente, prueba audience/issuer/cross-org y medición de latencia. **Bloqueante principal.** |
| **D3** | Responder `projectId,status,correlationId` con `sourceRef` verificable cuando exista. `auditRef` **opcional**, presente solo si hay registro durable recuperable; registrar telemetría sanitizada y retención explícita. | `ProjectRecord` no devuelve `name/summary`; `auditRef` no está demostrado para lecturas MCP. | Identificadores ficticios de auditoría o prometer resumen. | Decidir storage/política de auditoría, evidenciar 1 invocation → 1 correlación rastreable. |
| **D4** | S1 no debe crear tenant/org/user en lecturas. Elegir punto de ejecución de dominio que aplique `ProjectsRepository`/Policy sin un `ensureActorContext` bootstrap innecesario para actor ya autenticado; mantener semántica de API web. | `ProjectsRepository.findById` actualmente invoca `ensureActorContext` con upserts. | Evitar el repository de dominio desde MCP y consultar Prisma directamente; alterar el GET principal sin regresión. | Test de no creación con conteos DB pre/post y regresión API web. |
| **D5** | V1 publica solo `projectId,status` más trazabilidad no sensible; `jobId` se excluye hasta demostrar necesidad y permiso de relación. | Principio de minimización de datos y `ProjectRecord` sin title/summary. | Devolver `ProjectRecord` entero, nombres imaginarios, info financiera o Evidence. | Revisión schema Zod `strict` y snapshots de salida permitida. |
| **D6** | 401 para bearer ausente/inválido (challenge OAuth), 403 para scope OAuth insuficiente; **error de tool uniforme** para ID inexistente o recurso de otra org/tenant, sin revelar existencia. Mantener diferencias internas para auditoría. | El API actual puede usar Forbidden/NotFound con semántica distinta; el MCP introduce otra superficie de enumeración. | Mostrar `orgId`, `tenantId` ajeno, IDs o razón exacta de denegación. | Test de paridad de salida y timing razonable para inexistente/ajeno; log auditado sin datos privados. |
| **D7** | Control plane de consentimiento/binding S1: identidad de actor, org actual, client ID, resource/scope, fecha de vencimiento, estado ACTIVE/REVOKED; **no inventar ACTIVE global**. Feature flag OFF por defecto, revocación de consentimiento independiente de sesión. | Universal Connector maneja trust/provider pero no autoriza automáticamente org ni representa OAuth inbound vinculado a usuario. | Reusar status `AdminIntegrationsService.CONFIGURED_UNVERIFIED` como si fuera consentimiento. | Modelo de datos y migración expand/contract si hace falta, owner de revocación y prueba del siguiente `tools/call` bloqueado. |

**Decisión propuesta:** D1, D3, D5, D6 recomendables sin cambio de kernel; D2, D4 y D7 **requieren diseño/revisión de seguridad específica**. Ninguna recomendación se declara aceptada por editar esta tabla.

## Exigencias técnicas de versión (importante)

El SDK TypeScript v2 implementa 2026-07-28 pero no lo emite por defecto: `Client.connect()` sin `versionNegotiation` utiliza `initialize` de la época 2025. En la prueba S1 fijar `{ mode: { pin: "2026-07-28" } }`; la implementación server requiere también habilitación explícita de modern en el handler. Si un host exige legacy, abrir un caso de compatibilidad aislado en vez de degradar silenciosamente.

Para 2026-07-28: POST por solicitud con `Accept: application/json, text/event-stream`, `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` en `tools/call`, `_meta["io.modelcontextprotocol/protocolVersion"]` y validación de valores coincidentes. Rechazos de cabeceras: HTTP 400 y JSON-RPC `HeaderMismatch -32020`. Origin inválido: 403. La especificación elimina GET SSE y `Mcp-Session-Id` de la capa de transporte de 2026; **no elimina las sesiones de usuario/consentimiento OAuth de SEMSE**.

Fuentes: https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions , https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28 y https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http .

**D4 — contrato sin aprovisionamiento:** `docs/specs/platform/semse-mcp-project-read.no-provision.md` propone una ruta interna de lectura que conserva `ProjectsRepository`/Policy y evita `ensureActorContext` exclusivamente para MCP, sin alterar el GET web existente. Pendiente revisión y aceptación técnica; el requisito SEC-S1-02 ya fue aprobado.

## Compatibilidad de dependencias — bloqueo de integración, no motivo para reescribir el monorepo

El manifiesto real `apps/api/package.json` usa `zod: ^3.24.2` y `@semse/schemas` también usa Zod 3. El SDK MCP v2 depende de Zod 4.2+; un `inputSchema` de Zod 3 puede compilar y fallar **en ejecución de `tools/list`**. No actualizar silenciosamente `@semse/schemas` ni todo el monorepo.

**Propuesta para el adapter S1:** instalar `@modelcontextprotocol/server` y `@modelcontextprotocol/node` en la API solo tras aprobación, y usar una instancia Zod 4 propia para los esquemas MCP mediante alias de paquete `"zod-v4": "npm:zod@^4.2.0"` en `apps/api/package.json` (o aislar esa dependencia en un paquete adapter propio, validado por `pnpm` y CI). Mantener contratos de dominio en `@semse/schemas` Zod 3, convertir datos únicamente en el boundary estable. No mezclar objetos Zod 3 y Zod 4 para definir `inputSchema` MCP.

**Prueba obligatoria D1:** `tools/list` real y `tools/call` real contra `createMcpHandler(factory, { legacy: "reject" })` mediante `StreamableHTTPClientTransport` y pin moderno. Ejecutar además `pnpm build:api`, `pnpm typecheck`, `pnpm test:coverage` y tests regresivos de schema. Adjuntar lockfile para que el upgrade sea reproducible.

**Fuente oficial:** https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2 y https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28 .

## Protocolo de implementación futura: bloqueos y entrega

1. **Antes de implementar:** owner/seguridad acepta ADR-045, cierra D1–D7 y convierte child S1 a APPROVED; registrar decisión y comentarios en GitHub.
2. Implementación en rama/PR técnico independiente; no ejecutar migraciones destructivas ni crear segundo negocio.
3. **Tests antes del código:** conformidad modern pinned; Auth/OAuth y 2 tenants + 2 orgs mismo tenant; usuario revocado con token vigente; errores no enumerativos; flag OFF; output allowlist; cero writes y cero secretos; fallos de DB auth.
4. Código: adapter mínimo de lectura conectado a backend de dominios, AuthGuard/Policy y gateway OAuth validado. `tools/list` no confiere derecho a ejecutar `tools/call`.
5. CI por SHA: `pnpm spec:validate:strict`, `pnpm spec:index:check`, typecheck, lint, tests/coverage/E2E y revisión; separar resultados de doc vs función.
6. Deploy staging/canary Railway **solo con aprobación operativa específica**, flag OFF por defecto; pruebas reales autenticadas, revocación y rollback antes de activar.
7. `VERIFIED` solamente si CI+merge+deploy+activación+smoke e identidad multi-org están demostrados.

## Estado de comprobación

**Confirmado en GitHub:** PR #939 fusionado a `21426fda974a21989f8d64145da66eca38367897`; PR #940 fusionado a `62ce802a436554bd6dae95e3cd8958975e74c9df`; ambos con pipelines `quality-gates`, `unit-coverage`, `e2e` exitosos sobre sus SHAs de documentación.

**No confirmado / no implementado:** issuer/resource OAuth, client onboarding, contrato de consentimiento, código de MCP Server, read-only runtime, prueba host ChatGPT, tests autenticados MCP reales, Railway y flags/secretos productivos. La spec sigue REVIEW y la ADR-045 PROPOSED.

**Owner decision record (rellenar al aprobar):** fecha, decision D1–D7, alcance, aprobador, threat review, SHA, enlace de acta y child spec actualizado. Ausencia de firma/review = NO APPROVED.
