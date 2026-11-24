# 2026-11-24 — Liens, Forge y Satellites fuera del piloto FieldOps

## Resumen

#1169 ya estaba fusionado en `main` (`594279af`) con cuadrillas, BO-09 y Time Tracker. El diff fusionado no incluye pantallas de Liens, Forge ni Satellites. Ese trabajo seguía en el draft #1150 (`claude/vibrant-goodall-rfu2ul`), mezclado con la copia anterior de FieldOps y en conflicto con `main`.

Esta rama conserva solo Liens, Forge y Satellites, aplicada sobre `main` actual:

- pantallas y BFF de `/admin/liens`, `/client/liens`, `/worker/liens`, `/admin/forge`, `/admin/satellites`;
- clientes en `module-surfaces-api.ts`, sin reemplazar las funciones de cuadrillas y ubicación ya fusionadas;
- navegación ES/EN y registro, más las tarjetas de admin;
- API de avisos: el listado incluye borradores; un envío con dirección inválida o estado no DRAFT responde 422/409 en lugar de 500; se quita `AuthGuard('jwt')` de passport, que no tiene estrategia registrada y devolvía 500. La autenticación sigue en el `APP_GUARD` global.

No activa escrow, Lob, ni flags. #1150 no se reescribe: sigue siendo el draft mezclado y conflictivo. El código de Liens/Forge/Satellites no se pierde.

## Checklist

- [x] Separado de FieldOps (#1169, ya en `main`)
- [x] Tests de avisos y de registro de navegación
- [x] Sin cambios de Prisma, Railway ni producción

## Evidencia

- `node --experimental-strip-types --test tests/unit/navigation-registry.test.ts`
- Los tests de API de liens importan `apps/api/dist/` y quedan para el CI de este PR.

## Siguientes pasos

- No fusionar este PR con el piloto FieldOps. #1152 lo deja fuera del lanzamiento.
- #1168 (servidor OPEN-18) y después #1172 (clientes W-07). #1172 ya incluye #1168.
- #1150 puede cerrarse cuando este PR cubra la revisión de Liens/Forge/Satellites.
