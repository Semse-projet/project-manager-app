# S1 — Receive / paquete de aceptación MCP Project Read

**Spec:** `platform.semse-mcp-project-read` — REVIEW / NOT_STARTED.  
**ADR:** ADR-045 — PROPOSED.  
**Fecha:** 2026-10-15.  
**Ambiente de referencia:** no definido; **no** atribuir ejecución real a los casos de esta tabla.

## 1. Cadena obligatoria

Requirement → Threat → Control → Enforcement point → Test → Expected result → Evidence → Activation scope.

Las pruebas propuestas son criterios, **no resultados**. Un test unitario exitoso del SDD o un PR documental fusionado **no** certifican un MCP Server inexistente.

| Requisito | Amenaza | Control + enforcement | Prueba verificable | Esperado | Estado |
|---|---|---|---|---|---|
| MCP-READ-01 | Suplantar actor | Resource token válido + AuthService + Policy | usuario con proyecto propio vía cliente MCP real | salida allowlist y correlación, sin credenciales | NOT_IMPLEMENTED |
| MCP-READ-02 | Cross-tenant | Repo filtra tenant + ResourceScope | tenant A→Project B | ningún dato ni ID ajeno | NOT_IMPLEMENTED |
| MCP-READ-03 | Cross-org | Membership activa + ownership en repositorio | org A→recurso B dentro del mismo tenant | rechazo no enumerativo | NOT_IMPLEMENTED |
| MCP-READ-04 | Sesión revocada | AuthSession ACTIVE + AuthService | token antes válido tras revocación | 401/403 y ningún proyecto | NOT_IMPLEMENTED |
| MCP-READ-05 | Rol revocado | Membership ACTIVE + role intersection | Membership SUSPENDED/REVOKED con token vigente | sin acceso ni fallback claims | NOT_IMPLEMENTED |
| MCP-READ-06 | Token de otro resource | OAuth `aud` específica + issuer | bearer de proveedor/ChatGPT no destinado a SEMSE | 401, sin trust transitive | NOT_IMPLEMENTED |
| MCP-READ-07 | Bootstrap de identidad | Validación fuerte antes de Project repo | credencial falsa y conteo de filas pre/post | cero nuevas entidades | NOT_IMPLEMENTED |
| MCP-READ-08 | Soft-delete | `job.deletedAt:null` | Project asociado a Job borrado | indisponible, sin dato | NOT_IMPLEMENTED |
| MCP-READ-09 | Lectura que escribe | manifest read-only + code audit | invocar write/sync/delete e inspeccionar DB | sin herramientas mutantes | NOT_IMPLEMENTED |
| MCP-READ-10 | Enumeración | tool error projection | IDs inexistente/ajeno comparados | ninguna pista de existencia | NOT_IMPLEMENTED |
| MCP-READ-11 | Protocolo inconsistente | transport `Mcp-Method/Name/Version` | headers y JSON-RPC body diferentes | 400 | NOT_IMPLEMENTED |
| MCP-READ-12 | SSRF/DNS rebinding | Origin/TLS/Host check | origen externo no aprobado | 403 | NOT_IMPLEMENTED |
| MCP-READ-13 | Exposición de datos | allowlist + logger redaction | capturar respuesta, HTTP errors, logs | solo campos aprobados, cero secretos | NOT_IMPLEMENTED |
| MCP-READ-14 | Backend auth lento | acceso con timeout, fail-closed | DB tarda más de 1s | sin lectura y 503 | NOT_IMPLEMENTED |
| MCP-READ-15 | Conexión/consent revocado | binding revocable por actor/org/client | revocar entre `tools/list` y `tools/call` | `tools/call` denegada | NOT_IMPLEMENTED |
| MCP-READ-16 | Dependencia de host comercial | SDK cliente de referencia + fallback textual | protocolo 2026-07-28 contra host de pruebas | tools/list + call interoperables | NOT_IMPLEMENTED |

## 2. Fixtures mínimas — aislamiento

Crear en ambiente aislado un tenant T1 con organizaciones O1 y O2, otro tenant T2 con O3; usuario U1 miembro activo de O1, usuario U2 de O2, usuario U3 de O3, usuario U4 con dos memberships y uno revocable. Crear Project P1 cliente O1 asignado a PRO autorizada, P2 exclusivo O2, P3 de T2. Crear además P4 cuyo Job fue soft-deleted y P5 con org vacía/no asignada. Ningún tenant/org debe ser inferido solo de argumentos.

**Test positivo:** U1 lee P1. **Negativos:** U1→P2 y U1→P3; U2→P1 si no es parte autorizada; U3→P1; revocar membership de U4 y repetir con JWT aún válido; pasar `orgId` arbitrario; usar OAuth de otro resource. Probar OPS_ADMIN dentro del tenant sin permitir cruce a T2. Si una fixture tiene permisos compartidos, marcarla explícitamente, no usarla para una negativa.

## 3. Evidencia necesaria antes de merge técnico

- Spec S1 APPROVED, ADR-045 ACCEPTED con acta owner/seguridad y D1-D7 resueltas.
- SHA de rama, versiones reales de `@modelcontextprotocol/server`/`@modelcontextprotocol/client` y cambios del lockfile reproducibles.
- Unidad/protocolo: resultados de tests rojos primero, después verdes; contratos metadata/version/cabeceras, con cobertura de ramas negativas.
- API/auth: sesión revocada, membresía revocada, timeout, tenant/org y resource filter; logs con correlation y auditRef realmente existente.
- CI terminal PASS del mismo SHA, PR técnico con revisión, merge SHA y despliegue separado en Railway staging/canary OFF.
- Smoke autenticado real con 2 tenants/2 org y revocación. No simulado o screenshot sin consulta.
- Retención/control de acceso a auditoría y evidencia de rollback: disabled flag cierra ruta MCP sin interrumpir `/v1/projects`.
- Verificar la disponibilidad de ChatGPT u otro host **separadamente**; no es prueba de tenant/ownership.

## 4. Red flags que obligan a mantener INACTIVE

- Token del host se usa como JWT SEMSE sin intercambio/correspondencia de sesión; `aud` no validado.
- Cabeceras de `userId/orgId/roles` derivan en autorización.
- El protocolo se acepta sin control `Mcp-Method/Mcp-Name` o `Origin`.
- Error devuelve Project ajeno, stack interno o datos sensibles.
- `auditRef` no existe pero aparece como evidencia.
- `ensureActorContext` crea tenant/org/user sin proof confiable.
- Un READ_ONLY publica writes, o un fallo de backend cambia a ruta legacy insegura.
- Solo hay health 200/CI unitario pero falta smoke autenticado, revocación o verificación de implementación.

## 5. Gate de cierre

**Registro al 15-oct-2026:** todos los tests S1 arriba están `NOT_IMPLEMENTED`; no existe evidencia de MCP Server ejecutándose. El CI de PR documental #940 se refiere a validadores y regresión del repositorio, NO a S1 implementado. No cambiar `code_status`, `deploy_status`, `activation_status`, `last_verified` ni `production_evidence` de S1 por aprobar documentación.

Documentación asociada:
- `docs/specs/platform/semse-mcp-project-read.{spec,plan,tasks,analyze,checklist}.md`.
- `docs/architecture/ADR-045-semse-mcp-inbound-authorization.md`.
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
