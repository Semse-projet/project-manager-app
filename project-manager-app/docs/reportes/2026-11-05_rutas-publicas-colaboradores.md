# Rutas públicas del programa de colaboradores sin identidad del servidor

**Fecha:** 2026-11-05 · **Rama:** `claude/public-contributor-routes` (desde `main` @ `21ecf67`) · **Origen:** recorrido del 2026-10-26 (`/contributors` → 503 en local)

## Problema

`/api/semse/contributors/public/{terms,missions,missions/[id]}` sirven la página pública `/contributors`, que no tiene usuario. Usaban `fetchSemseDataForRequest`, que sin sesión recurre a la identidad fija del servidor:

- donde esa identidad no está configurada (local, entornos nuevos), la página respondía 503 «runtime not configured»;
- en producción funcionaba, pero cada visita anónima llegaba a la API como la identidad del servidor, justo lo que `stats/public` y `public/worker-openings` evitan a propósito.

## Cambio

- `contributors/public/_public.ts` llama a los endpoints `@Public` de la API sin `Authorization` ni cabeceras de identidad:
  - envía `x-tenant-id` y las cabeceras de transporte del BFF (`trustedClientHeaders`: token bootstrap e IP del visitante), para que cada visitante tenga su propio cupo en el throttler en lugar de compartir el del BFF;
  - quita las barras finales de `SEMSE_API_BASE_URL`;
  - corta a los 10 s y reenvía el estado real de la API.
- Las 3 rutas usan ese helper. El detalle valida el ID (`[A-Za-z0-9_-]{1,128}`) como `public/worker-openings/[id]`.

## Hallazgo aparte (sin cambio aquí)

`GET /v1/contributor-program/missions/:id` es `@Public` y devuelve cualquier misión por su ID, sin filtrar por estado ni por tenant (`getMission`). Ocurre en la API, así que cualquiera puede llamarla directamente. Los IDs son cuid y difíciles de adivinar. Cambiarlo afecta a cómo se previsualizan las misiones en borrador, así que necesita decisión de producto.

## Verificación

| Prueba | Resultado |
|---|---|
| `tests/unit/contributors-public-routes.test.ts` | 4/4: sólo cabeceras de tenant y de transporte, barras finales quitadas, estado real reenviado y las 3 rutas pasan la petición al helper. Contra el helper anterior fallan 3. |
| `tsc` y eslint de la web | 0 errores |

## Corrección posterior (revisión de Codex en #1094)

Codex señaló dos cosas, las dos ciertas:

- **Cupo compartido.** Sin la IP del visitante, todas las visitas anónimas a `/contributors` caían en el cupo de la IP del BFF y un solo visitante podía agotarlo para el resto.
- **Barras finales.** Con `SEMSE_API_BASE_URL` terminada en `/`, la URL quedaba con `//v1/...`. Ahora se quitan, como en `_server.ts`.
