# Integracion Autonomia Ecosistema — 2026-04-09

## Objetivo

Integrar el Autonomous PR Core al ecosistema vivo de SEMSE en `project-manager-app` y validar el flujo completo desde la web protegida del sistema.

## Estado final

- Integracion viva en `packages/autonomy`, `apps/api` y `apps/web`.
- Persistencia de runs en la base del monorepo mediante `AutonomousPrRun`.
- Migracion Prisma aplicada: `20260409195000_autonomous_pr_runs`.
- API de autonomia funcionando en el ecosistema.
- Panel web `/admin/autonomy` funcionando con sesion real del shell web.
- Ejecucion completa validada desde la web:
  - login
  - acceso al panel
  - POST via proxy web
  - branch
  - cambio
  - commit
  - push
  - PR local
  - consulta de detalle

## Verificacion realizada

### API viva

- `GET /v1/health` OK en `http://127.0.0.1:4132`
- `GET /v1/autonomy/runs` OK con identidad `OPS_ADMIN`
- `POST /v1/autonomy/runs` OK

Run validado por API:

- `id`: `apr_1775760782203_od1d48jk`
- `branch`: `feat/add-status-badge-mnru4cu1`
- `commit`: `03908cd160d8c264741f1850e67cfeaaa653afbb`
- `prUrl`: `semse://local-pr/feat/add-status-badge-mnru4cu1`

### Web viva

Instancia validada:

- `http://127.0.0.1:3014`

Flujo validado:

1. `POST /api/semse/auth/token` con `admin@demo.semse / demo1234` -> `200`
2. cookie `semse_session` emitida correctamente
3. `GET /admin/autonomy` -> `200`
4. `GET /api/semse/autonomy` -> `200`
5. `POST /api/semse/autonomy` -> `200`
6. `GET /api/semse/autonomy/:runId` -> `200`

Run validado desde la web:

- `id`: `apr_1775761401437_rblgga3c`
- `branch`: `feat/add-docs-badge`
- `commit`: `7406ae246ac4db270bd231228e20683b1aca4a35`
- `prUrl`: `semse://local-pr/feat/add-docs-badge`

## Checks ejecutados

- `npm run db:migrate`
- `npm run prisma:generate --workspace @semse/db`
- `npm run test:unit --workspace @semse/api`
- `npm exec tsc --workspace @semse/web -- --noEmit`
- `npm run build:api`
- validacion runtime de API en `4132`
- validacion runtime de web en `3014`

## Hallazgos operativos

- El aparente `500` inicial de `/api/semse/auth/token` en web no era un bug funcional persistente del login.
- En `next dev`, la primera llamada quedaba dominada por compilacion en frio de middleware y la route handler.
- Una vez compilado el segmento, el login responde `200` y el flujo completo sigue estable.
- El acceso al detalle del run por web tambien puede rozar el timeout en el primer hit de compilacion, pero luego responde correctamente.

## Procesos dejados arriba

- API: `http://127.0.0.1:4132`
- Web: `http://127.0.0.1:3014`

## Riesgo remanente real

- El flujo esta validado en `SEMSE_AUTONOMY_LOCAL_PR_MODE=true`, es decir, PR local (`semse://local-pr/...`).
- La integracion con GitHub REST real ya esta cableada en la capa de autonomia, pero requiere credenciales operativas (`SEMSE_AUTONOMY_GITHUB_TOKEN`, `SEMSE_AUTONOMY_REPO_NAME`) para validacion end-to-end contra GitHub.
