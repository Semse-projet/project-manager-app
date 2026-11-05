# Rutas públicas del programa de colaboradores sin identidad del servidor

**Fecha:** 2026-11-05 · **Rama:** `claude/public-contributor-routes` (desde `main` @ `21ecf67`) · **Origen:** recorrido del 2026-10-26 (`/contributors` → 503 en local)

## Problema

`/api/semse/contributors/public/{terms,missions,missions/[id]}` sirven la página pública `/contributors`, que no tiene usuario. Usaban `fetchSemseDataForRequest`, que sin sesión recurre a la identidad fija del servidor:

- donde esa identidad no está configurada (local, entornos nuevos), la página respondía 503 «runtime not configured»;
- en producción funcionaba, pero cada visita anónima llegaba a la API como la identidad del servidor, justo lo que `stats/public` y `public/worker-openings` evitan a propósito.

## Cambio

- `contributors/public/_public.ts`: llama a los endpoints `@Public` de la API sin `Authorization` ni cabeceras de identidad, sólo con `x-tenant-id`, con un tiempo máximo de 10 s, y reenvía el estado real de la API.
- Las 3 rutas usan ese helper. El detalle valida el ID (`[A-Za-z0-9_-]{1,128}`) como `public/worker-openings/[id]`.

## Hallazgo aparte (sin cambio aquí)

`GET /v1/contributor-program/missions/:id` es `@Public` y devuelve cualquier misión por su ID, sin filtrar por estado ni por tenant (`getMission`). Ocurre en la API, así que cualquiera puede llamarla directamente. Los IDs son cuid y difíciles de adivinar. Cambiarlo afecta a cómo se previsualizan las misiones en borrador, así que necesita decisión de producto.

## Verificación

| Prueba | Resultado |
|---|---|
| `tests/unit/contributors-public-routes.test.ts` | 3/3: sólo la cabecera del tenant, estado real reenviado y las 3 rutas usan el helper |
| `tsc` y eslint de la web | 0 errores |
