# Threat Model — SEMSE OS Capability Control Plane

**Estado:** ACCEPTED
**Fecha:** 2026-07-19
**Riesgo:** critical
**Alcance de aceptación:** contrato de seguridad F0; implementación no autorizada

## Activos protegidos

- aislamiento tenant/workspace;
- credenciales de runtime y registry;
- manifests y digests de imágenes;
- approvals y execution grants;
- logs, evidencias y audit trail;
- targets locales, cloud y edge;
- disponibilidad de capacidades críticas.

## Fronteras de confianza

```text
Usuario/Prometeo | API/Policy | Control Plane DB | Runtime Adapter | Runtime
                                     |                  |
                                  Event Bus        Secret Broker
```

Cada cruce exige identidad verificable, input estructurado, permiso, correlación
y salida redactada.

## Amenazas y controles

| Amenaza | Control obligatorio |
| --- | --- |
| Prompt injection solicita shell/deploy | Prometeo no posee shell; tool gateway y schemas cerrados |
| Escalada cross-tenant | workspace derivado de identidad + ownership backend + pruebas negativas |
| Manifest malicioso | firma, publisher trust, schema validation, digest y SBOM |
| Sustitución de imagen | digest inmutable y verificación de procedencia |
| Robo de secretos | handles, broker temporal, scopes mínimos, sin secretos en planes/logs |
| Replay de operación | idempotency key, nonce/grant con expiración y receipt persistido |
| Confused deputy | actor original + purpose binding + policy por acción/target |
| Aprobación obsoleta | approval ligada a planDigest y configurationRevision |
| Dos operaciones concurrentes | lease por installation/target y compare-and-set |
| Drift manual | observe/reconcile genera incidente; no adopta estado silenciosamente |
| Supply-chain compromise | scan, firma, SBOM, allowlist de registry y rollback |
| Denial of service | quotas, budgets, timeout, circuit breaker y backpressure |
| Log injection/PII | structured logging, redaction y límites de payload |
| Rollback destructivo | snapshot/revision direccionable y policy proporcional al riesgo |
| TOCTOU entre approval y apply | recalcular digest/revisión/target al claim y antes de cada efecto |
| Escape por path o symlink | resolver paths reales y exigir que permanezcan bajo roots allowlisted |
| Broker/executor suplantado | identidad mutua, audience/purpose binding y nonce de un solo uso |
| Abuso de red desde Compose | red default-deny y destinos explícitos por capability |
| Output exhaustivo o binario | límite de bytes, timeout, structured receipt y truncación redactada |
| Clock skew en grants | timestamps de servidor, tolerancia acotada y expiración fail-closed |

## Clasificación de operaciones

| Operación | Riesgo mínimo | Gate |
| --- | --- | --- |
| Observe/list/health | low | permiso read |
| Plan/simulate | medium | audit |
| Activate/update local sandbox | medium | policy + scoped grant |
| Activate/update shared target | high | ops approval |
| Secrets/network/data migration | critical | security + dual control |
| Production rollback | high/critical | incident policy + owner |

## Reglas no negociables

1. El agente nunca aprueba su propia acción.
2. Una aprobación no se reutiliza si cambia el digest.
3. No se montan sockets Docker dentro de agentes sin proxy de policy dedicado.
4. No se aceptan comandos shell proporcionados por el modelo.
5. Producción no usa tags mutables ni credenciales de larga vida.
6. Logs de tools y adapters pasan por redacción antes de persistir o mostrar.
7. El executor corre con el usuario host de menor privilegio disponible; no como
   administrador y nunca con credenciales heredadas del agente.
8. La transacción de claim/persistencia termina antes de invocar Docker o red.
9. Cada effect revalida kill switch, grant, digest, target y approval.
10. Paths Compose se comparan después de resolver symlinks y normalizar cwd.

## Decisión de Security/Governance

El threat model queda aceptado como contrato F0 con los controles anteriores y
el modelo de autorización canónico. Son bloqueantes para implementación:

- operaciones cerradas con `spawn(executable, args[])`, nunca command string;
- service identity separada de `OPS_ADMIN`;
- dual control real para riesgo `critical`;
- broker/grant de corta vida, single-use y target-bound;
- output limitado/redactado y sin secretos o manifests completos;
- Docker socket ausente de agentes y UI;
- kill switch fail-closed.

La aceptación no certifica código inexistente ni el host Docker. Esos controles
deben probarse mediante CP-002..CP-014 antes de cualquier canary.

## Pruebas de seguridad requeridas

- IDOR entre tenant, org y workspace;
- permiso faltante y rol insuficiente;
- planDigest cambiado después de aprobar;
- grant expirado, reutilizado o destinado a otro target;
- manifest/schema inválido y firma desconocida;
- imagen con tag mutable en target no local;
- dos apply concurrentes sobre la misma instalación;
- prompt injection intentando ampliar tools/file/network scope;
- output con secreto simulado para verificar redacción;
- rollback sin snapshot o sin autoridad.
