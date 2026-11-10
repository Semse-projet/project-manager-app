# Limitador del login web: contar la IP que añade el proxy, no la que escribe el cliente

**Fecha:** 2026-10-25 · **Rama:** `claude/fix-login-limiter-client-ip` (desde `main` @ `06dfd7b`) · **Origen:** nota pendiente del PR #1029 · **CI de GitHub:** bloqueado a nivel de cuenta; la evidencia es local.

## Hallazgo

El login web (`app/api/semse/auth/token/route.ts`) tiene su propio limitador de intentos:

- 10 por correo cada 15 minutos;
- 30 por IP cada 15 minutos.

La IP salía de la **primera** entrada de `X-Forwarded-For`, que escribe el propio cliente. Inventando una IP distinta en cada intento, el cupo por IP nunca se agotaba. Así se podían probar contraseñas contra muchos correos a la vez, que es justo lo que el cupo por IP debería frenar. El cupo por correo seguía funcionando.

## Cambio

- `getClientIp` usa `clientIpFromHeaders`, que toma la **última** entrada de `X-Forwarded-For`, la que añade el proxy delante de la web, o en su defecto `x-real-ip`. Sólo acepta valores que sean una IP; si no hay ninguna, usa el cupo `unknown`, como antes.
- `app/api/semse/_client-ip.ts` es idéntico al del PR #1029, así que los dos PR se fusionan sin conflicto. El import se coloca en otra línea que la de #1029 por la misma razón.
- Los límites no cambian (10 por correo, 30 por IP, 15 minutos). Sin cambios en la API ni en Railway.

## Evidencia (web en modo producción)

Prueba: 32 intentos de login del **mismo** visitante (salto del proxy `203.0.113.50`), cambiando en cada uno la IP inventada de la izquierda y el correo, para que sólo pueda saltar el cupo por IP.

| | Antes (build de `main` sin el arreglo) | Después |
|---|---|---|
| Respuestas 429 en 32 intentos | **0**: el cupo por IP no se aplicaba | **2**: el 31.º y el 32.º, como corresponde a un límite de 30 |
| 12 visitantes reales distintos justo después | — | 0 respuestas 429: no comparten cupo |
| `tests/unit/login-limiter-client-ip.test.ts` | — | 3 pass |
| Tests unitarios de la raíz | — | 1555 pass, 1 fail (`isUrlSafe`, necesita DNS real) |
| `tsc` y `pnpm --filter @semse/web lint` | — | 0 errores; ningún aviso en los archivos modificados |

## Nota

Esta corrección asume que delante de la web hay un único proxy (el de Railway). Si se añade otro delante, por ejemplo Cloudflare, la última entrada sería la de ese proxy y habría que tomar la anterior. Es el mismo punto pendiente que en #1029.
