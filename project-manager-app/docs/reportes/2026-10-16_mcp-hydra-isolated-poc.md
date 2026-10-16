# SEMSE MCP S1 — Ory Hydra PoC aislada (16-oct-2026)

## Autoridad y alcance

El propietario autorizó explícitamente una **prueba de concepto Ory Hydra autoalojada, con datos sintéticos y sin producción**, tras el cierre documental del PR #961 y el primer slice interno D4 (#953). **No es una decisión de adopción ni de despliegue**. D2 permanece PENDING, S1 REVIEW y ADR-045 PROPOSED.

## Equipo de pruebas
- Binario Ory Hydra **v26.2.0** Linux SQLite x86_64 (binario oficial de GitHub Releases), descarga solo en runner temporal con SHA-256 fijo: `28baf98c6d5da617c905d5ca77826fe863db9f9edab8f72664c69a56bde56b5a`. No se modifica ni construye imagen Docker.
- Workflow GitHub Actions manual/PR `.github/workflows/mcp-s1-hydra-poc.yml` en `ubuntu-24.04`, permisos `contents:read`, timeout 18 min y sin secretos de GitHub necesarios. `DSN` SQLite se crea bajo `RUNNER_TEMP`; claves `SECRETS_SYSTEM/COOKIE` se generan por ejecución y nunca se versionan.
- Hydra public/admin en **127.0.0.1:4444/4445**, consentimiento/login sintético en **127.0.0.1:3000**. Sin ingress, Railway, DNS, variables productivas, Postgres SEMSE, acceso a cuentas reales, ni cambios en modelos/migraciones.
- `scripts/mcp-s1-hydra-poc.mjs`: simula usuario, sesión, consentimiento y Membership en memoria; no usa credenciales ni datos existentes en SEMSE.

## Plan de verificación de evidencia

| Código | Prueba | Criterio | Estado antes de ejecutar CI |
|---|---|---|---|
| H-P0 | Binario oficial y suma SHA256 | Versión exacta verificada | NOT_EXECUTED |
| H-P1 | Hydra migrations y health | Servidor real inicia en loopback | NOT_EXECUTED |
| H-P2 | Public OAuth client + Authorization Code/PKCE S256 | Rechaza verificador incorrecto, emite token con correcto | NOT_EXECUTED |
| H-P3 | Hydra introspection, audience, issuer, client, scope | Token válido pasa; token ilegítimo y resource/issuer/client ajenos no | NOT_EXECUTED |
| H-P4 | Revocación sintética de sesión/rol/consent | El **verificador de laboratorio** deniega siguiente acceso aunque token Hydra permanezca activo | NOT_EXECUTED |
| H-P5 | Falla de Hydra/introspección | En prototipo con servidor no disponible se deniega | NOT_EXECUTED |

**Importante:** H-P4 NO demuestra revocación real de un `AuthSession` SEMSE persistido, `Membership` Postgres, ni consentimiento D7; solo que una puerta de autorización simulada reevalúa el estado. La prueba tampoco implementa un MCP host real, introspección integrada en NestJS, un Resource Server aceptado, E2E multinquilino ni aceptación total de D2.

**CI:** tras crear el PR, adjuntar enlace y resultado terminal. No reemplazar `NOT_EXECUTED` por `PASS` antes de comprobar logs y jobs reales.

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
