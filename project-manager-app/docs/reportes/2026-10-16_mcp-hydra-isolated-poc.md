# SEMSE MCP S1 — Ory Hydra PoC aislada (16-oct-2026)

## Autoridad y alcance

El propietario autorizó explícitamente una **prueba de concepto Ory Hydra autoalojada, con datos sintéticos y sin producción**, con el PR #961 en revisión documental y el primer slice interno D4 (#953) fusionado. **No es una decisión de adopción ni de despliegue**. D2 permanece PENDING, S1 REVIEW y ADR-045 PROPOSED.

## Equipo de pruebas
- Binario Ory Hydra **v26.2.0** Linux SQLite x86_64 (binario oficial de GitHub Releases), descarga solo en runner temporal con SHA-256 fijo: `28baf98c6d5da617c905d5ca77826fe863db9f9edab8f72664c69a56bde56b5a`. No se modifica ni construye imagen Docker.
- Workflow GitHub Actions manual/PR `.github/workflows/mcp-s1-hydra-poc.yml` en `ubuntu-24.04`, permisos `contents:read`, timeout 18 min y sin secretos de GitHub necesarios. `DSN` SQLite se crea bajo `RUNNER_TEMP`; claves `SECRETS_SYSTEM/COOKIE` se generan por ejecución y nunca se versionan.
- Hydra public/admin en **127.0.0.1:4444/4445**, consentimiento/login sintético en **127.0.0.1:3000**. Sin ingress, Railway, DNS, variables productivas, Postgres SEMSE, acceso a cuentas reales, ni cambios en modelos/migraciones.
- `scripts/mcp-s1-hydra-poc.mjs`: simula usuario, sesión, consentimiento y Membership en memoria; no usa credenciales ni datos existentes en SEMSE.

## Plan de verificación de evidencia

| Código | Prueba | Criterio | Estado antes de ejecutar CI |
|---|---|---|---|
| H-P0 | Binario oficial y suma SHA256 | Versión exacta verificada | **PASS** — binario 26.2.0 verificado en runner |
| H-P1 | Hydra migrations y health | Servidor real inicia en loopback | **PASS** — SQLite temporal y health real |
| H-P2 | Public OAuth client + Authorization Code/PKCE S256 | Rechaza verificador incorrecto, emite token con correcto | **PASS** — OAuth real |
| H-P3 | Hydra introspection, audience, issuer, client, scope | Token válido pasa; token ilegítimo y resource/issuer/client ajenos no | **PASS** — introspección Hydra real, validaciones del verificador sintético |
| H-P4 | Revocación sintética de sesión/rol/consent | El **verificador de laboratorio** deniega siguiente acceso aunque token Hydra permanezca activo | **PASS SIMULADO** — Map de estados en memoria; NO sesión SEMSE real |
| H-P5 | Introspección inaccesible | Verificador sintético constata indisponibilidad de endpoint loopback y no acepta como activo | **PASS LAB** — no es prueba de caída real del servicio productivo |

**Importante:** H-P4 NO demuestra revocación real de un `AuthSession` SEMSE persistido, `Membership` Postgres, ni consentimiento D7; solo que una puerta de autorización simulada reevalúa el estado. La prueba tampoco implementa un MCP host real, introspección integrada en NestJS, un Resource Server aceptado, E2E multinquilino ni aceptación total de D2.

**Evidencia CI real:** [Hydra isolated PoC run #38942681289](https://github.com/Semse-projet/project-manager-app/actions/runs/38942681289) terminó **SUCCESS** sobre commit `6e75e5bce36f1c9c16b8fb14cac58e399d94c8fe`, registrando **26 checks**; incluye revocación **real de un access token Hydra** con `POST /oauth2/revoke` y confirmación posterior `introspection.active=false`, además de PKCE real. Primer éxito de 23 checks: [run #38942363307](https://github.com/Semse-projet/project-manager-app/actions/runs/38942363307). El fallo de introspección inaccesible se comprobó contra un endpoint loopback intencionalmente no disponible; esto solo prueba que el harness detecta el fallo, no el comportamiento de un futuro Resource Server SEMSE.

**El código que solo cambia formato de log** en el commit posterior debe volver a pasar workflow del HEAD; no extrapolar el run histórico a SHA diferente. **CI principal**: comprobar ejecución terminal separadamente antes de merge.

**Incidentes de laboratorio corregidos (no ocultar):** primer run [#38942074186](https://github.com/Semse-projet/project-manager-app/actions/runs/38942074186) falló por callback OAuth sin código; el [#38942201229](https://github.com/Semse-projet/project-manager-app/actions/runs/38942201229) reveló `request_forbidden` en callback. Se corrigió el cliente de pruebas para conservar la cookie CSRF de Hydra a lo largo de las redirecciones y el tercer run #38942363307 pasó con 26 checks. No se deshabilitó CSRF ni se relajó la validación PKCE.

**Lo que sigue NOT_EXECUTED:** un corte real de Hydra durante peticiones autenticadas a un Resource Server SEMSE y conexión a un `AuthSession`/Membership/consent real de SEMSE, roles dinámicos con DB, OAuth resource-server de NestJS, compatibilidad de host MCP y pruebas de cero writes reales.

## Bloqueos y siguientes pruebas

1. Fijar proveedor/edición/licencia/versión, método de soporte y operaciones de OAuth D2 con aprobación del propietario tras comparar costes y seguridad.
2. Implementar una aplicación real de login/consent SEMSE con state/PKCE/redirect exacto y ciclo de sesiones activas, incluyendo UX y consentimiento revocable (no aceptar automáticamente como la demo).
3. Implementar un vínculo autenticado y persistente `OAuth subject/consent ↔ user/org/client/resource/active AuthSession`, exclusivamente en un PR de seguridad autorizado; no confiar en claims de `tenantId/orgId/roles` del host.
4. Validar en staging aislado AS introspection + RBAC/domain + 2 tenants/2 orgs, denegaciones, kill switch, errores no enumerativos, auditoría y ausencia total de provisión antes de publicar MCP.
5. Revisar compatibilidad **MCP 2026-07-28 / CIMD** con host concreto. El PoC OAuth general **no** implica compatibilidad del host.

## Fuentes primarias
- Binario y checksum oficial: https://github.com/ory/hydra/releases/tag/v26.2.0
- Quickstart Ory Hydra y SQLite: https://www.ory.com/docs/oel/hydra/quickstart
- Login/consent: https://www.ory.com/docs/oauth2-oidc/custom-login-consent/flow
- Licencia y producción: https://github.com/ory/hydra/blob/master/README.md

**Restricción:** No se autoriza ningún paso en Railway ni fusión automática ni apertura de tool MCP externa.
