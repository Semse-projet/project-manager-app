# Web Sprint 1.5 Smoke

Smoke práctico para el flujo visible de Sprint 1.5 en `apps/web`:

1. Dashboard
2. Job detail
3. Crear milestone
4. Submit / approve / release
5. Registrar evidence
6. Fund escrow
7. Abrir y resolver dispute

## Qué hace

`scripts/web-sprint15-smoke.mjs` levanta:

- Un stub HTTP en memoria para la API SEMSE (`/v1/jobs`, ops dashboard, agents runs, projects, milestones, evidence, escrow y disputes).
- `apps/web` en modo producción (`next build` + `next start`) con el runtime apuntando al stub.
- Un navegador Playwright headless que recorre la UI real y valida el cambio de estado en cada surface.

No toca datos reales ni requiere `apps/api`.

## Ejecutar

```bash
npm run bootstrap:semse
npm run smoke:web:sprint15
```

## Variables opcionales

- `SEMSE_WEB_SMOKE_PORT`
- `SEMSE_WEB_SMOKE_API_PORT`

## Nota de entorno

El smoke necesita abrir sockets locales para el stub HTTP y `next start`.

Si el proceso termina con un mensaje sobre `Cannot bind http://127.0.0.1...` o `EPERM`, el problema es del entorno donde corre el comando, no del flujo visible en sí. En ese caso:

1. corre `npm run build:web`
2. corre `npm run build:api`
3. corre `npm run test:unit`
4. repite `npm run smoke:web:sprint15` en una shell local o runner con loopback habilitado

## Cuándo usarlo

- Antes de tocar `apps/web/app/jobs/*` o `apps/web/app/api/semse/*`.
- Cuando haga falta confirmar que la shell visible todavía conecta dashboard, milestones, evidence, escrow y disputes.
- Como smoke local rápido cuando `apps/api` no está levantado.
