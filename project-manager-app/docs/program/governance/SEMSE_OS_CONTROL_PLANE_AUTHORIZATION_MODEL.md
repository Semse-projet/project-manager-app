# SEMSE OS Control Plane — Modelo de autorización

**Estado:** ACCEPTED DESIGN CONTRACT
**Fecha:** 2026-07-19
**Spec:** `platform.semse-os-control-plane`
**Riesgo:** critical
**Alcance:** T-004 documental; no autoriza implementación

## Decisión

El Control Plane usa RBAC default-deny, ownership tenant/org/workspace, policy
por acción/target y separación entre solicitar, aprobar y ejecutar. El primer
slice no introduce un rol Workspace Admin nuevo: solo `OPS_ADMIN` puede
solicitar y decidir mientras exista un ownership verificado. Prometeo conserva
el actor original y propone mediante tools, pero no recibe permisos propios.

## Matriz mínima

| Actor/rol | Permisos | Puede solicitar | Puede aprobar | Puede ejecutar |
| --- | --- | --- | --- | --- |
| `OPS_ADMIN` humano | `capabilities:read`, `operate`, `approve`, `rollback` | sí | sí, con separación de funciones | no |
| `CAPABILITY_EXECUTOR` servicio | `capabilities:execute` | no | no | sí, con grant válido |
| Prometeo/agent | ninguno directo | solo propuesta atribuida al usuario | no | no |
| CLIENT/PRO/WORKER | ninguno en MVP | no | no | no |

Rol y permiso son condiciones simultáneas. Un token con permiso pero sin el rol
de servicio, o con rol sin permiso, se rechaza. `CAPABILITY_EXECUTOR` no aparece
en sesiones humanas, navegación o alias de roles.

## Aprobaciones por riesgo

| Riesgo/acción | Gate mínimo |
| --- | --- |
| low: list/observe/health | permiso read + ownership |
| medium: plan/simulate | policy + AuditLog; sin effect externo |
| medium: apply en sandbox local | un humano distinto del requester |
| high: shared target o rollback | un humano distinto + revalidación step-up |
| critical: secrets/network/data migration | dos humanos distintos entre sí y del requester |

En el MVP los aprobadores humanos pueden compartir rol `OPS_ADMIN`, pero deben
ser identidades distintas y cada decisión conserva actor, modo, razón y tiempo.
Roles Security/Operations especializados requieren un spec posterior; no se
simulan mediante strings no implementados.

## Binding y vigencia

Cada approval se liga a:

- `operationId`;
- `planDigest` y `configurationRevision`;
- `runtimeTargetId` y tenant/workspace;
- `approvalMode` + slot independiente;
- requester, approver, reason, `decidedAt` y `expiresAt`.

Cambiar cualquier binding invalida todas las aprobaciones. Una identidad no
ocupa dos slots y el requester no ocupa ninguno. El grant de ejecución es
single-use, tiene audience/purpose/target binding y expira antes que la approval.
La policy inicial fija un máximo de 15 minutos para approvals y 2 minutos para
grants; valores menores pueden exigirse por riesgo.

## Endpoints y ownership

| Ruta | Control adicional |
| --- | --- |
| GET definitions/installations/operation | tenant + org/workspace ownership |
| POST operation | `capabilities:operate`, idempotency y target allowlist |
| POST approve/reject | `capabilities:approve`, separación y binding |
| POST rollback | `capabilities:rollback`, revisión direccionable |
| POST operation/process | `CAPABILITY_EXECUTOR` + `capabilities:execute` + grant |

Conocer un ID nunca concede acceso. IDs cross-tenant devuelven la respuesta
canónica que no filtra existencia. El servicio deriva tenant/org/workspace del
actor y de recursos persistidos, no del body.

## Auditoría obligatoria

- solicitud, policy decision y digest;
- approval/rejection/expiry/revocation;
- grant emitido/consumido/expirado sin guardar el secreto;
- claim, cada receipt, verify, cancellation y rollback;
- actor original, actor de servicio, target, correlation y reason code.

No se registran tokens, configRef resuelta, stdout sin filtrar o plan completo.
Las transiciones materiales escriben estado + AuditLog + outbox en una sola
transacción corta, antes de cualquier llamada externa.

## Resultado Governance

Modelo aceptado para F0. La futura implementación deberá añadir permisos a
`packages/auth/src/rbac.ts` y bootstrap de service identity solo después de
T-008/T-009. Este documento no modifica RBAC actual.

