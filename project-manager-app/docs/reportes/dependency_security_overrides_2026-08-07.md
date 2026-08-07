# Actualización de overrides de seguridad — 2026-08-07

## Objetivo

Corregir las alertas de Dependabot que no podían resolverse automáticamente y
eliminar las vulnerabilidades restantes detectadas por `pnpm audit --prod`, sin
cambiar contratos de dominio, datos, variables ni configuración de Railway.

## Cambios

Se actualizaron overrides compatibles y el lockfile correspondiente:

- `mermaid`: `11.16.0` → `11.16.1`
- `js-yaml`: `4.3.0` → `4.3.1`
- `brace-expansion`: `5.0.8` → `5.0.9`
- `dompurify`: `3.4.12` → `3.4.13`
- `fast-uri`: `3.1.4` → `3.1.5` y `4.1.1` → `4.1.2`
- `hono`: `4.12.30` → `4.12.34`
- `postcss`: `8.5.19` → `8.5.23`
- `undici`: `7.28.0` → `7.29.0`

El override de `hono` se añadió en un seguimiento inmediato: GitHub publicó
tres alertas nuevas durante el despliegue inicial, cuando la versión corregida
`4.12.34` todavía no era resoluble por Dependabot.

## Evidencia local

- instalación con `pnpm install --frozen-lockfile`: PASS
- `pnpm audit --prod`: PASS, sin vulnerabilidades conocidas
- `pnpm --filter @semse/assistant-portal test`: PASS, 69 tests
- `pnpm --filter @semse/assistant-portal build`: PASS
- `pnpm --filter @semse/web lint`: PASS, 0 errores y 57 warnings

Los avisos de chunks grandes, variables analíticas opcionales y lint web ya
existían y no forman parte de esta intervención.

## Impacto y rollback

No hay cambios de schema, migraciones, FSM, RBAC, eventos ni pagos. El rollback
consiste en revertir el commit de esta actualización; no requiere acción sobre
datos ni configuración de producción.

La evidencia de CI, merge y despliegue se mantiene separada en el pull request
y en las ejecuciones de GitHub Actions correspondientes.
