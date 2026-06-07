# packages/schemas

Contratos compartidos de SEMSEproject.

Incluye:
- DTOs de entrada y salida;
- enums y estados de dominio;
- validaciones Zod;
- eventos de dominio;
- tipos de vista transicionales para frontend.

## Regla

Toda frontera externa valida contra schema.

## Precedencia

- El dominio lo define `docs/foundation/DOMAIN_MODEL.md`.
- Las transiciones validas viven en `docs/foundation/STATE_MACHINES.md`.
- Los eventos oficiales viven en `docs/foundation/EVENT_CATALOG.md`.
- Este paquete implementa esos contratos; no inventa semantica paralela.

## Clasificacion interna

- `*.schema.ts`: contratos Zod canonicos o transicionales documentados.
- `domain-events.schema.ts`: eventos de dominio compartidos.
- `client.types.ts`: tipos de presentacion transicionales que deben reducirse con el tiempo.
- `escrow-view.types.ts`: tipos de respuesta API alineados al runtime actual.

## Politica de migracion

- tipos de dominio compartidos nuevos: entran aqui;
- view models puramente visuales: viven en la app que los usa;
- compatibilidad legacy: debe marcarse explicitamente, no mezclarse silenciosamente;
- cualquier divergencia entre runtime y modelo objetivo se documenta antes de expandir uso.
