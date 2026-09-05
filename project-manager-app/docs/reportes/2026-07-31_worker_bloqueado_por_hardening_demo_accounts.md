# Worker de producción bloqueado por el hardening de cuentas demo — 2026-07-31

## Resumen

El endurecimiento de seguridad de `PRODUCTION_DOMAIN_HARDENING_2026-07-30.md`
(deshabilitar login de las 3 cuentas demo legacy en producción) rompió, como
efecto colateral no intencional, la autenticación del propio `semse-worker`
contra `semse-API`. El worker llevaba usando `usr_admin_001` (el `userId` de
`admin@demo.semse`) como atajo para su identidad interna de servicio. Desde
que se mergeó el hardening, cada ciclo de auth del worker terminaba en 401,
silenciosamente, durante todo el 30 y parte del 31 de julio.

## Síntoma observado

En los logs de `semse-API` en producción, cada ~10 segundos:

```
POST /v1/agents/runs/reclaim-stale  -> 401  (con el token de la sesión previa)
POST /v1/auth/refresh               -> 401  (el refresh token también inválido)
POST /v1/auth/token                 -> 201  (bootstrap: sesión nueva, token fresco)
POST /v1/agents/runs/reclaim-stale  -> 401  (falla otra vez, con el token recién emitido)
```

Un token recién firmado, por el mismo proceso, con el mismo secreto,
rechazado a los 4ms de emitido — no era expiración, ni RBAC (que devuelve
403, no 401), ni desincronización de `AUTH_SECRET` entre servicios.

## Causa raíz

`apps/api/src/modules/auth/auth-demo-mode.ts` — función `isDisabledDemoIdentity()`,
agregada en el hardening del 2026-07-30, PRs `#480`/`#481`:

```ts
export function isDisabledDemoIdentity(userId: string, roles: string[]): boolean {
  if (LEGACY_DEMO_USER_IDS.has(userId) && !isLegacyDemoLoginEnabled()) {
    return true;
  }
  ...
}
```

`LEGACY_DEMO_USER_IDS` incluye `usr_admin_001` (el `userId` real de la cuenta
`admin@demo.semse`). El servicio `semse-worker` en Railway (producción) tenía
`SEMSE_USER_ID=usr_admin_001` — exactamente ese ID — configurado desde antes
del hardening, como atajo de conveniencia para tener permisos de `OPS_ADMIN`.

`auth.service.ts` → `authenticateRequest()` llama a `isDisabledDemoIdentity()`
después de verificar la firma del token, y si retorna `true` lanza
`UnauthorizedException("Demo sessions are disabled")` — de ahí el 401, incluso
con un token válido y recién emitido.

El hardening del 30-jul era correcto y necesario (bloquear las cuentas demo
reales en producción); simplemente nadie tenía visibilidad de que el worker
de producción usaba esa misma identidad.

## Fix aplicado

Puramente de configuración, sin cambio de código:

- `packages/db/prisma/seed.ts` ya crea una identidad dedicada para esto,
  `usr_worker_system` / `worker-system@semse.local` ("Worker system user
  para el worker process"), nunca conectada en Railway hasta ahora.
- Se cambió la variable `SEMSE_USER_ID` del servicio `semse-worker` en
  Railway (`production`) de `usr_admin_001` → `usr_worker_system`.
- `SEMSE_ROLES=OPS_ADMIN,WORKER,EVENT_CONSUMER`, `SEMSE_ORG_ID` y
  `SEMSE_TENANT_ID` no se tocaron — `isDisabledDemoIdentity` sólo filtra por
  `userId`, y los roles vienen del propio `SEMSE_ROLES` en el body de
  `/v1/auth/token`, no de un lookup a la tabla `User`.
- Redeploy del worker vía `railway redeploy --service semse-worker
  --environment production`.

## Validación

Log de arranque del worker tras el redeploy:

```
label="startup" ... userId="usr_worker_system" roles="OPS_ADMIN,WORKER,EVENT_CONSUMER"
```

Secuencia posterior en `semse-API`, ciclo limpio:

```
POST /v1/auth/token                  -> 201
POST /v1/reservations/sweep-expired  -> 201
POST /v1/agents/runs/reclaim-stale   -> 201
POST /v1/agents/runs/reclaim-stale   -> 201  (siguiente ciclo, igual de limpio)
```

Sin más 401 en los ciclos de auth del worker después del redeploy.

## Lecciones / pendiente

- El primer intento de redeploy (vía `railway variable set`, que dispara
  redeploy automático) arrancó con una carrera: el deployment nuevo se creó
  casi al mismo tiempo que se terminaba de persistir la variable, y arrancó
  con el valor viejo (`usr_admin_001`) igual. Se necesitó un
  `railway redeploy` explícito, posterior, para que tomara el valor
  correcto. Si se repite este patrón (cambiar variable + esperar el
  autoredeploy), conviene verificar el log de `startup` del servicio
  después, no asumir que el primer redeploy automático ya tomó el valor.
- `authenticateRequest()` en `auth.service.ts` descarta el motivo real de un
  401 (`catch { throw new UnauthorizedException(...) }`, sin loguear si fue
  firma inválida, expiración, o — como en este caso — identidad demo
  bloqueada). Este incidente se diagnosticó leyendo código y variables de
  entorno, no por un log explicativo. Agregar un log (sin cambiar el
  mensaje que ve el cliente) del motivo real dentro de ese `catch`
  aceleraría el próximo diagnóstico similar — señalado, no implementado en
  este pase.
- Vale la pena revisar si hay otro servicio o script interno (aparte del
  worker) que también haya estado usando algún `userId` de
  `LEGACY_DEMO_USER_IDS` como atajo de identidad — no se auditó
  exhaustivamente fuera de `semse-worker` en este pase.
