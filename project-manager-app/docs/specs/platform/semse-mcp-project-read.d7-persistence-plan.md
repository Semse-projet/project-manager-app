# S1 D7 — Handoff de persistencia de consentimiento delegado OAuth (diseño, no código)

**Fecha:** 2026-10-17  
**Estado:** PROPUESTA IMPLEMENTABLE / REVIEW / NOT_IMPLEMENTED  
**Autoridad:** D7 aprobado por propietario **a nivel de solución** el 2026-10-15; D2 (issuer/AS, cliente y seguridad) sigue pendiente. Este documento no autoriza una migración, despliegue, endpoint ni cambio de estado a APPROVED.  
**Referencias:** [issue #952](https://github.com/Semse-projet/project-manager-app/issues/952), [ADR-045](../../architecture/ADR-045-semse-mcp-inbound-authorization.md), [decisions](semse-mcp-project-read.decisions.md), [oauth-bridge](semse-mcp-project-read.oauth-bridge.md), [laboratorio PR #972](https://github.com/Semse-projet/project-manager-app/pull/972).

## 1. Estado real inspeccionado y frontera de alcance

En `packages/db/prisma/schema.prisma` ya existen `AuthSession` (`id`, `tenantId`, `orgId`, `userId`, `status`, `revokedAt`, `accessExpiresAt`, `refreshExpiresAt`) y `Membership` (clave compuesta `userId/orgId/roleId`, `status`). **No existe** `model McpDelegatedConsent` en la rama principal inspeccionada. `AuthRepository.findActiveSessionAuthorization` permite consultar las sesiones y membresías vigentes. El servicio de Project dispone de lectura interna sin aprovisionamiento; el laboratorio Hydra/PostgreSQL solo demuestra un vínculo de consentimiento **sintético en memoria**.

Este D7 debe persistir **grants específicos de SEMSE**; no decide ni implementa el servidor de autorización D2, ni convierte la PoC en guard productivo. Mantener `MCP_SERVER_ENABLED=false` por defecto y no exponer `tools/call` todavía.

## 2. Contrato candidato de almacenamiento (requiere revisión de esquema)

Entidad **propuesta**, aún **NO** agregada a Prisma ni migrada:

| Campo | Semántica y restricción |
|---|---|
| `id` | Identificador opaco único; nunca bearer ni clave secreta. |
| `tenantId`, `orgId`, `userId`, `sessionId` | Actor y **una sola organización** de la sesión SEMSE; deben coincidir en filas existentes y vigentes, verificados del lado del servidor. |
| `oauthIssuer`, `oauthClientId`, `resourceUri` | Emisor permitido, cliente exacto y audience de la URI canónica del recurso MCP. No aceptar URL aportada por la tool. |
| `scopeSet` | Lista canónica de scopes concedidos, sin duplicados; v1 solo `projects:read`. Negar escalada frente a la identidad vigente. |
| `grantBindingDigest` | HMAC/huella de referencia **estable y verificable** del grant del AS o identificador equivalente; único en su ámbito. No almacenar access/refresh tokens en claro ni derivar la sesión de argumentos de tool. El mecanismo exacto depende de D2. |
| `status` | `PENDING | ACTIVE | REVOKED | EXPIRED` bajo una FSM estricta. En S1, una lectura jamás cambia status. |
| `createdAt`, `authorizedAt`, `expiresAt`, `revokedAt`, `updatedAt` | Auditoría de ciclo de vida. `expiresAt` obligatorio para ACTIVE, limitado por política y validez de la sesión. |
| `policyVersion`, `consentVersion` | Huellas/versiones para impedir reinterpretar un grant antiguo con reglas nuevas. |
| `idempotencyKeyDigest` | Opcional para aceptación idempotente; unicidad **por tenant** y tratamiento seguro de solicitudes concurrentes. |
| `revokedByUserId` / `revocationReasonCode` | Metadatos de revocación redactados; prohibir datos privados o tokens en el campo de motivo. |

**Índices propuestos (revisar cardinalidad y consultas):** `(tenantId, orgId, userId, status, expiresAt)`, `(tenantId, sessionId, status)`, `(tenantId, oauthClientId, status)`; unicidad para `(tenantId, grantBindingDigest)` y para la clave de idempotencia **cuando exista**. Las referencias a Tenant/Org/User/AuthSession y la consistencia tenant-org-sesión necesitan revisión de foreign keys y de sus efectos `ON DELETE`: no borrar silenciosamente la evidencia auditable al revocar. Una FK de `sessionId` requeriría modificar también el modelo actual `AuthSession`, que hoy no declara relación Prisma con el nuevo grant. No asumir que FK simple por `orgId` garantiza coherencia con `tenantId`.

**No hacer todavía:** añadir tabla real, migración SQL, endpoints, campos en `AuthSession` o valores `ACTIVE` sintéticos en producción.

## 3. Invariantes transaccionales

**Aceptar consentimiento (futura API interna, nunca pública sin D2):**
1. Un flujo confiable confirma usuario autenticado, sesión `ACTIVE`, expiraciones de sesión y `Membership ACTIVE` dentro de la **misma** organización/tenant; no usar `x-org-id` ni parámetros de la tool como autoridad.
2. Validar `oauthIssuer`, client id registrado, redirect exacto, `resourceUri`, solicitud PKCE/scopes y evidencia de consentimiento explícito con política vigente. Fallar cerrado si no existe un vínculo confiable del grant del AS con la sesión.
3. En transacción, persistir grant con `status=ACTIVE` únicamente tras autorización confirmada; la aceptación de la misma clave idempotente devuelve el **mismo** grant sin duplicarlo. Si el mismo idempotency key viene con payload incompatible, rechazar. Decidir la estrategia de bloqueo/unique constraint para la carrera concurrente.
4. No registrar ni emitir tokens de OAuth hasta que la persistencia asociada se haya confirmado; si el AS no ofrece transacción distribuida, especificar compensación/revocación del grant externo antes de avanzar D2. Ningún grant semipersistido debe autorizar.

**Verificar cada llamada de lectura:**
`OAuth token introspected/verified` → `iss/client/aud/exp/scope` exactos → identificador de grant vinculado criptográfica o autoritativamente al token → `McpDelegatedConsent ACTIVE AND expiresAt>now()` → `AuthSession ACTIVE` y expiraciones → `User active` y `Membership ACTIVE` + intersección RBAC → policy Project/Job/tenant/org → proyección `projectId,status,correlationId`. Identidad, organización y scopes siempre server-trusted. Denegar si DB/introspección no disponible, timeout, binding ambiguo, token revocado, o cualquier lectura falla. No cache positivo que permita pasar una revocación. No se escribe nada en esta vía, ni siquiera para marcar un consentimiento como `EXPIRED`; `expiresAt <= now()` se deniega directamente y un mantenimiento asíncrono podrá actualizar estado.

**Revocar:** operación acotada al tenant/org y rol autorizado, con compare-and-set `ACTIVE → REVOKED` y `revokedAt` durable. Una segunda revocación es idempotente y no reabre el grant. `REVOKED`/`EXPIRED` son terminales; la reautorización crea nuevo `id` y versión. Revocación de sesión/usuario/membresía también bloquea la **siguiente** llamada, independientemente de si se alcanzó o no a actualizar todos los grants relacionados (porque se vuelven a leer fuentes de autoridad). Cualquier propagación al AS debe especificar retry y fallo cerrado, sin garantizar un SLA no medido.

## 4. Paquete de pruebas test-first (dos tenants y dos organizaciones)

| Caso | Escenario | Resultado exigible |
|---|---|---|
| D7-01 | Aceptación válida con sesión, scope y client del recurso | Un solo grant ACTIVE persistido con actor/org/resource exactos |
| D7-02 | Dos aceptaciones paralelas mismo idempotency key y payload | Un único grant, sin emisión doble |
| D7-03 | Misma clave idempotente con cambio de scope/org/client | Rechazo sin modificar el grant |
| D7-04 | Token Hydra de usuario/client/scope idénticos pero vinculado a **otra sesión** | Rechazo antes de consulta Project |
| D7-05 | Grant de Org A intentando Project de Org B, mismo tenant | Rechazo no enumerativo, sin cross-org |
| D7-06 | Org o Project en otro tenant | Rechazo y cero fuga de datos |
| D7-07 | Revocar consent mientras bearer sigue `active` en AS | Siguiente llamada rechazada |
| D7-08 | Revocar AuthSession o Membership con grant todavía ACTIVE | Siguiente llamada rechazada |
| D7-09 | `expiresAt <= now` o nuevo policyVersion incompatible | Rechazo sin escribir al leer |
| D7-10 | Introspection timeout/error o PostgreSQL no disponible | Fail-closed; no fallback a claims |
| D7-11 | Ausencia de grant, client/scope/audience distinto, replay de grant revocado | Rechazo exacto sin lookups indebidos |
| D7-12 | `tools/list` seguido de revocación antes de `tools/call` | `tools/call` rechazada |
| D7-13 | En lectura instrumentada, conteos Tenant/Org/User/Project/Job/Consent idénticos antes y después; Prisma no-SELECT bloqueadas | Cero mutaciones/aprovisionamiento |
| D7-14 | Flag MCP OFF, incluso con token/grant válidos | No endpoint MCP accesible |
| D7-15 | Audit log de aceptación/revocación/denegación | Solo IDs opacos/códigos/correlationId, sin bearer, emails o PII |
| D7-16 | Carrera revoke/authorize, dos solicitudes con una revocación intercalada | Ninguna lectura autoriza grant que ya estaba revocado al momento de su verificación |

Para D7-16, definir por escrito el punto de serialización y una prueba determinista con barrera entre lectura del grant y decisión de acceso; no afirmar una garantía absoluta frente a revocaciones posteriores a una llamada ya autorizada. Pruebas de integración obligatorias contra PostgreSQL efímero real, además de unit y HTTP con host MCP **solo una vez resuelto D2**.

## 5. Fases y bloqueo de producción

**Fase A — Revisión:** acordar semántica exacta del grant AS↔SEMSE y su vínculo de sesión, revisores de seguridad, FKs, uniqueness, auditoría y retención (aún **por decidir**, no inventar días). Revisar latencia conjunta con la línea de 1000 ms del auth actual y las consultas adicionales D7. No elegir Hydra como AS productivo sin decisión D2.

**Fase B — Persistencia apagada:** tras aprobación formal del child spec/ADR/seguridad y autorización de migración, incorporar schema Prisma y migración **aditiva** revisable, repository/servicio internos y pruebas test-first. No exportar controller ni habilitar routes. Backout: `MCP_SERVER_ENABLED=false`; columnas/tabla nueva permanecen de forma segura mientras se evalúa rollback. Prohibido downgrade destructivo sin backup/plan.

**Fase C — Bridge y host real:** solo con D2 aceptado: integrar AS, guarded NestJS OAuth sin `@Public()` en tools, grant revocable + AuthSession/Membership + servicio de Project en camino no provisionador. Validar protocolo 2026-07-28 fijado, `tools/list` y `tools/call` con host independiente y negatives. Registrar evidencia de CI en SHA exacto, threat review y reviewer `APPROVED`.

**Fase D — Despliegue separado:** requiere aprobación específica de Railway/entorno, métricas, kill switch y rollback demostrado. Un CI verde o PR de laboratorio **no** activa S1 ni convierte ADR-045 a ACCEPTED.

## 6. Decisiones de seguridad que no debe tomar un PR automáticamente

- **D2:** emisor AS, metadata, client registration, token-to-grant authoritative binding, logout/revocación AS e interoperabilidad host.
- **D7a:** FKs y borrado/retención, cifrado/HMAC y custodia de clave, serialización de aceptación concurrente, versión de políticas, auditoría.
- **D7b:** quién puede consentir por organización, revocar por client/org, plazos máximos, respuesta a incidentes.
- **Gate:** security reviewer externo a la autoría firma la matriz y el threat model; propietario aprueba migración/despliegue por separado.

**Criterio de entrega de este documento:** facilitar implementación posterior sin declarar modelo Prisma implementado, validaciones ejecutadas, D2 aprobado o MCP activo.
