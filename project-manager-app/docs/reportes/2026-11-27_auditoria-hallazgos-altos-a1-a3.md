# Auditoría 2026-11-25: corrección de los hallazgos altos A1–A3

Base: `main` @ `0ae2c31` (la auditoría se hizo sobre `1bbaeb5`). Rama `fix/audit-high-a1-a3`.

| Hallazgo | Cambio |
|---|---|
| A1 — `GET /v1/uploads/files/*` sin firma por defecto | `resolveSignedGetMode()` devuelve `enforce` si la variable falta o trae un valor desconocido; `off`/`shadow` solo explícitos. `assertUploadsSigningConfiguration()` en `main.ts`: en producción la API no arranca con `shadow`/`enforce` sin `UPLOADS_SIGNING_SECRET` (≥16). Fuera de producción solo avisa. |
| A2 — Next.js 15.5.28 con 3 CVE | `next` 15.5.29 (última 15.5.x, publicada 2026-11-03); lockfile regenerado, solo cambian paquetes de Next. |
| A3 — secreto de sesión de respaldo en el código | Eliminado `semse-dev-session-secret`. Nuevo `apps/web/lib/dev-session.ts`: secreto `SEMSE_WEB_SESSION_SECRET`/`AUTH_SECRET` ≥32 sin respaldo; logins demo locales e identidades demo heredadas exigen `NODE_ENV=development|test` **y** `SEMSE_ALLOW_DEV_SESSION=true` (igual que `headerIdentityAllowed()` de la API). |

## Riesgo de despliegue

- A1: si el servicio API de Railway no tiene `UPLOADS_SIGNING_SECRET`, el próximo deploy no arrancará. Si la variable `UPLOADS_SIGNED_GET_MODE=shadow` está puesta, se respeta. Configurar Railway antes de fusionar.
- A3: si `SEMSE_WEB_SESSION_SECRET`/`AUTH_SECRET` del servicio web mide menos de 32 caracteres, las sesiones dejan de validarse (todos los usuarios quedan fuera). `infra/railway/DEPLOY.md` ya pide 64+.
- A3 local: quien use los logins demo sin API debe poner un secreto ≥32 y `SEMSE_ALLOW_DEV_SESSION=true`.

## Verificación local

- API `test:unit`: 4.150 tests, 9 fallos; 8 de `satellite-webhooks-service` por validación SSRF que necesita DNS (el sandbox no tiene) y 1 de `uploads.controller` que se corrigió en esta rama (ahora lee con URL firmada). Los dos ficheros tocados: 17/17.
- Raíz `tests/unit`: 1.787 tests, 1 fallo (`browser-governance isUrlSafe`), que también falla en `main` sin estos cambios.
- Nuevos/actualizados: `tests/unit/web-dev-session.test.ts`, `demo-login.test.ts`, `web-session.test.ts`: 33/33.
- `tsc` web y API sin errores; `eslint` web sin errores; `next build` con Next 15.5.29 OK.
- No ejecutado: e2e Playwright, integración con base de datos.
