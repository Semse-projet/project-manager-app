# Seguimiento de consolidación — 2026-09-05

## Estado de la integración

- Rama: `consolidation/integration-main-preserved-20260905`
- Merge de integración: `c178e531`
- Seguimiento documental: `ddc210db`
- Árbol de trabajo: limpio.
- Conflictos pendientes: ninguno.
- Archivos faltantes frente a `consolidation/local-f1-f4-preserved-20260905`: 0.
- GitHub y Railway no fueron modificados.

## Cambios preservados y completados

- Se conservaron los módulos y documentos locales F1–F4.
- Se alineó el esquema Prisma con la migración del capability control plane.
- `pre-migrate.mjs` permanece fail-closed y no ejecuta borrados ni `db push` en producción.
- Se corrigió `BASE_RATES[input.laborType]` en la herramienta de Labor.
- Se reincorporó el ADR-022 del Browser Agent/Obscura.

## Validación

La validación local registrada es: 1.055 pruebas aprobadas, 0 fallidas y 9 omitidas; typecheck de API/web correcto, worker válido, agro-sync 11/11 y gate de seguridad de migraciones 3/3.

## Railway

API, worker, vision, Postgres, Redis y Ollama están en línea. `semse-web` está en línea, aunque Railway conserva un despliegue fallido histórico por una referencia antigua a `baseRate`; la rama integrada contiene la corrección correspondiente.

El siguiente paso requiere autorización explícita para publicar: abrir PR o hacer push de la rama y ejecutar después un despliegue controlado de `semse-web`.
