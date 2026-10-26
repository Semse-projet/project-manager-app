---
type: plan
feature: "semse-library-hub-f1-inventory"
domain: "platform"
spec: "docs/specs/platform/semse-library-hub-f1-inventory.spec.md"
version: "2.0"
status: "APPROVED"
branch: "feat/semse-library-hub-f1-static-scanner-20261025"
date: "2026-10-25"
---

# Plan técnico F1: escáner offline

## Estado de referencia
- Derivado de PR #1048 (documentación); F1 tiene permiso expreso del propietario, independiente del SDD general en DRAFT.
- Códigos fuente sólo en `scripts/library-hub-inventory*.mjs`; sin dependencias nuevas, Railway ni Prisma.
- Fuentes: `pnpm-workspace.yaml`, `package.json`, `apps/*/package.json`, `packages/*/package.json`, `pnpm-lock.yaml` v9 y `requirements*.txt` de apps.
- CI del HEAD de código F1 `0e4f1815` SUCCESS en GitHub Actions #40264754613: quality-gates, unit-coverage y E2E. Código y smoke checkout real validados; no equivale a revisión humana, merge, despliegue o verificación de producción.

## Arquitectura
1. Descubrimiento dinámico y validación de paths; rechazo de symlinks; manifiestos de sólo lectura.
2. Extracción declarativa JS/TS y Python conservando lo no resuelto.
3. Reconciliación conservadora con `importers` y overrides globales de nombre exacto del pnpm lock v9; distinguir pin intencional de `STALE_LOCKFILE`, sin inferir integridad, transitivas ni compatibilidad. Overrides condicionados quedan fuera del alcance F1.
4. JSON estable por stdout, sin filesystem writes. CLI local, sin endpoint y sin herramientas del agente.
5. Tests con repositorios temporales; ningún paquete observado se ejecuta. Sin afectar otros dominios.

## Seguridad, costes y datos
- No ejecución de scripts ni paquetes del repo; no spawn ni red.
- Sanear referencias URL en requirements que puedan contener credenciales.
- No memoria persistente ni nuevos recursos; costes de escáner en CI existentes cuando se ejecute.
- No confundir estos datos con licencia verificada, SBOM, CVEs, coste Railway o código desplegado.
- Ninguna migración. Rollback: revertir los archivos F1.

## Entrega
- Tests primero; implementación de la librería y CLI.
- Pruebas Node 22 aisladas y corrida del checkout real ya acreditadas en SHA anterior; ver `docs/reportes/2026-10-25_library-hub-f1-lockfile-reconciliation.md` para 4 overrides y 2 declaraciones peer pendientes de certificación post-corrección.
- Actualizar SDD, tareas, checklist e índice; revisar diff.
- **Último gate:** tests locales y `pnpm spec:validate:strict`, `pnpm spec:index:check`, CI; PR separado en draft sin merge/deploy.
