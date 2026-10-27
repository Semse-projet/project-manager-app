# Corrección de KIT-F3-04: todos los usuarios web compartían el cupo de peticiones de la API

**Fecha:** 2026-10-23 · **Rama:** `claude/fix-rate-limit-tracker` (desde `main` @ `06dfd7b`) · **Aprobación:** el responsable eligió la opción "Clave por usuario" en la sesión · **CI de GitHub:** bloqueado a nivel de cuenta; toda la evidencia es local. Sin cambios en Railway.

## Resumen

El `ThrottlerGuard` de la API cuenta las peticiones por IP del socket y por handler. Todo el tráfico web llega desde la BFF, que llama a la API por la red privada (`SEMSE_API_BASE_URL=http://semse-api.railway.internal:4000` según `infra/railway/DEPLOY.md`). Por tanto, toda la plataforma compartía un único cupo:

- 5 logins por minuto (límite fijo en `@Throttle`; `RATE_LIMIT_LIMIT` no lo cambia);
- 5 tokens BFF por minuto (`POST /v1/auth/token`). Al sexto usuario nuevo en un minuto la BFF se quedaba sin token y sus peticiones respondían 401;
- `RATE_LIMIT_LIMIT` peticiones por minuto en cada endpoint (20 según `DEPLOY.md`) para todos los usuarios juntos.

No se ha podido ver la configuración real de Railway (el conector no está autorizado en la sesión). El problema está en el código y se reproduce con la configuración documentada.

## Cambio

`SemseThrottlerGuard` (`apps/api/src/common/semse-throttler.guard.ts`) sustituye al guard global y decide a quién se cuenta cada petición:

| Petición | Clave del cupo |
|---|---|
| La BFF, acreditada con el bootstrap token, pidiendo un token para una identidad | `identity:<tenant>:<user>` |
| La BFF, con el bootstrap token y `x-semse-client-ip` | `ip:<IP del visitante>` |
| Token de acceso con firma válida y sin caducar | `user:<tenant>:<user>`. Sólo se comprueban firma y caducidad, sin consultar la base; las sesiones revocadas las sigue rechazando `AuthGuard` |
| Cualquier otra | `ip:<IP del socket>`, como antes |

- La IP reenviada sólo se acepta junto con el bootstrap token. Sin él, o si el token no está configurado, se ignora y no sirve para elegir cupo.
- La web reenvía la IP en las llamadas anónimas: login (web y móvil), registro, recuperación de contraseña y demo (`trustedClientHeaders` en `_server.ts`).
- La IP sale de la entrada **más a la derecha** de `X-Forwarded-For`, la que añade el proxy delante de la web. Las entradas de la izquierda las escribe el cliente.
- La comprobación del bootstrap token se extrae a `apps/api/src/common/bootstrap-token.ts`, con la misma comparación en tiempo constante que ya usaba el controlador.
- Nueva constante compartida `SEMSE_CLIENT_IP_HEADER_NAME` en `@semse/shared`.
- Los límites siguen siendo los mismos; sólo cambia a quién se cuenta.

## Checklist final

- ✅ Test nuevo `apps/api/test/semse-throttler-guard.test.ts` (9 casos):
  - qué clave recibe cada tipo de petición;
  - las IP reenviadas por un llamante no acreditado se ignoran;
  - un bootstrap token no configurado no da confianza a nadie;
  - los tokens falsificados, firmados con otro secreto o caducados vuelven a contar por IP;
  - pasando por el `ThrottlerGuard` real: 6 visitantes entran en el mismo minuto, un mismo visitante sigue limitado y un atacante que rota IP falsas también.
- ✅ Con el `ThrottlerGuard` original, el caso de los 6 visitantes falla con `ThrottlerException` (reproducido).
- ✅ Test nuevo `tests/unit/bff-trusted-client-headers.test.ts`: elección de IP, nunca reenvía algo que no sea una IP, y las 6 rutas anónimas reenvían las cabeceras.
- ✅ Sin cambios de esquema, eventos, dependencias ni variables de Railway.

## Evidencia

| Prueba (desde `project-manager-app/`) | Antes | Después |
|---|---|---|
| API local, 6 logins de 3 usuarios con `X-Forwarded-For` distintos | el 6.º, **429** | igual: sin bootstrap token, las IP reenviadas se ignoran (correcto) |
| API local, 6 logins con cabeceras BFF e IP de visitante distinta | — | 6 × **201** |
| API local, 7 tokens BFF para identidades distintas | 6.º y 7.º, **429** | 7 × **201** |
| API local, 2 usuarios alternando 22 `GET /v1/auth/me` | las 2 últimas, **429** (cupo compartido) | 22 × **200** |
| API local, un único usuario, 22 `GET /v1/auth/me` | — | las 2 últimas, **429** (sigue limitado) |
| Web en producción, 6 logins de visitantes distintos en un minuto | — | 6 × **200** |
| Web en producción, 6 logins con IP inventadas a la izquierda del salto del proxy | — | la API cuenta los 6 contra la misma IP; el 6.º recibe 429 |
| `node --experimental-strip-types --test apps/api/test/semse-throttler-guard.test.ts` | — | 9 pass |
| `node --experimental-strip-types --test tests/unit/bff-trusted-client-headers.test.ts` | — | 4 pass |
| `node ./apps/api/scripts/run-tests.mjs` | — | 3634 tests: 3588 pass, 38 skipped, 8 fail. Los 8 son `SAT-007`: necesitan DNS real, que el sandbox no tiene |
| `tests/unit/*.test.{mjs,ts}` | — | 1556 pass, 1 fail: `browser-governance isUrlSafe`, también por DNS |
| `pnpm --filter @semse/api lint` / `--filter @semse/web lint` / `tsc --noEmit` de api y web | — | 0 errores. Los avisos ya existían; ninguno está en los archivos modificados |

## Siguientes pasos

1. CI verde cuando se restablezca GitHub Actions, revisión de seguridad y merge.
2. El limitador propio del login web (`auth/token/route.ts`) cuenta por la entrada **más a la izquierda** de `X-Forwarded-For`, que el cliente controla. Se puede saltar su cupo por IP, aunque el cupo por correo sigue funcionando. No se cambia aquí para no ampliar el PR.
3. Confirmar en Railway qué cabeceras añade el proxy delante de la web. Si delante hay otro proxy (por ejemplo Cloudflare), la entrada de la derecha sería la de ese proxy y habría que tomar la anterior.
4. En #1022, marcar KIT-F3-04 como corregido.
