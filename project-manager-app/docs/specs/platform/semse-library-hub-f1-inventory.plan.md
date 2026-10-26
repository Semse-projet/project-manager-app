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
- CI, deployment y runtime productivo: **no verificados**.

## Arquitectura
1. Descubrimiento dinámico y validación de paths; rechazo de symlinks; manifiestos de sólo lectura.
2. Extracción declarativa JS/TS y Python conservando lo no resuelto.
3. Reconciliación con sólo `importers` del pnpm lock v9; no inferir integridad/transitivos.
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
- Verificación estática/fixtures aislados; posteriormente corrida con checkout real.
- Actualizar SDD, tareas, checklist e índice; revisar diff.
- **Último gate:** tests locales y `pnpm spec:validate:strict`, `pnpm spec:index:check`, CI; PR separado en draft sin merge/deploy.
