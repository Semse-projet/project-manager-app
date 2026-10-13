# Runbook — Membresías de la identidad de servicio del worker (hotfix DEC-R1)

> Estado: **propuesto, no ejecutado**. Cada paso marcado **[PROD]** requiere
> aprobación explícita del owner. Este documento no cambia producción por sí mismo.

## Incidente

Desde el deploy del worker de las 06:23Z del 2026-10-12 (commit `902e4d59`,
PR #877), todas las llamadas del worker a la API devuelven 401:
`POST /v1/auth/token` → 201, luego `/v1/agents/runs/reclaim-stale` y
`/v1/auth/refresh` → 401 cada ~10 s. Efecto: ningún `AgentRun` se reclama ni se
ejecuta (incluido el RETRY del browser-agent, que sigue `queued`), y fallan el
barrido de reservas y la extracción de contributors.

## Causa (confirmada por lectura de código; no verificada contra la BD de prod)

- #877 hace que `authenticateRequest` valide la sesión durable y exija, por cada
  rol, una `Membership` `ACTIVE` en la org de la sesión
  (`findActiveSessionAuthorization` + `authorizedRoles`). Sin roles efectivos →
  401 `No active organization permission`.
- El worker usa `SEMSE_USER_ID=usr_worker_system`, `SEMSE_ORG_ID=org_admin_001`,
  `SEMSE_ROLES=OPS_ADMIN,WORKER,EVENT_CONSUMER`. `packages/db/prisma/seed.ts`
  crea ese `User` pero **ninguna membresía**; hasta #877 los roles salían del
  body de `/v1/auth/token` sin lookup (ver
  `docs/reportes/2026-07-31_worker_bloqueado_por_hardening_demo_accounts.md`).
- La spec `core.business-access-foundation` (AC-09) pedía inventariar y probar
  el camino del worker; #877 solo ajustó los smokes de CI, no producción.

## Arreglo

Sembrar las membresías reales que #877 exige, sin tocar la lógica de auth:
`scripts/ops/ensure-worker-service-membership.mjs`.

- Dry-run por defecto; solo escribe con `--apply`.
- Idempotente. No reactiva membresías `SUSPENDED`/`REVOKED`.
- Solo `usr_worker_system`; solo roles `OPS_ADMIN`, `WORKER`, `EVENT_CONSUMER`;
  la org debe existir y pertenecer al tenant. No crea User, Org ni Tenant.
- No concede roles nuevos: son los mismos que el worker ya enviaba.

## Ejecución

1. **[PROD]** Dry-run con el `DATABASE_URL` de producción (en la sesión del
   owner, sin imprimirlo): `node scripts/ops/ensure-worker-service-membership.mjs`.
   Revisar que `plan.ok` sea `true` y que `createMemberships` liste los roles
   esperados. Si `ok:false`, **no continuar**: avisar con el `reason`.
2. **[PROD]** Aplicar: `... --apply`.
3. Sin redeploy: el worker reintenta cada ~10 s y su siguiente `reclaim-stale`
   debe devolver 201. Si siguiera en 401, renovar su sesión reiniciando el worker
   (aprobación aparte).
4. Verificar: logs de API sin 401 de `/v1/agents/runs/reclaim-stale`; el AgentRun
   `cmqb7s6nh0001mi01dqgpeezr` pasa de `queued` a `running`/`completed`/`failed`.

## Rollback

Borrar solo las filas creadas (`Membership` de `usr_worker_system` en
`org_admin_001`); el script imprime qué creó. Alternativa global: revertir #877.

## Pendiente (fuera de este hotfix)

- El spec de #877 declaraba `deploy_status: NOT_DEPLOYED` y exigía autorización
  aparte para desplegar; el worker se desplegó con ese commit. Revisar el proceso.
- Otras identidades de servicio (BFF web, smokes en Railway) no se inventariaron
  aquí; AC-09 sigue abierto.
