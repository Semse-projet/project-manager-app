# 2026-11-25 — StorageWriteGate production-control slice

## Resumen

El control plane de T-008 (#954) ya permitía observar y aprovisionar `OPEN` en producción. Este slice añade drain, freeze y thaw solo con un opt-in separado, sin cambiar el comportamiento cuando la variable no está. No se tocó Railway, no se fusionó y no se ejecutó una ventana real en SEMSEproject.

## Checklist final

- ✅ `SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE=mutate` más `SEMSE_STORAGE_WRITE_GATE_MODE=production` para armar mutaciones.
- ✅ Permiso `ops:storage-write-gate:production-mutate` solo en `OPS_ADMIN`, con ticket, motivo, idempotencia y fila de auditoría.
- ✅ TTL 300–14400 s en `freezeExpiresAt`. Al vencer, las escrituras siguen fail-closed. Thaw con el gate ya `OPEN` es un recibo y no sube el epoch.
- ✅ Escrituras de originales/multipart responden 503 + `Retry-After: 5`. Lecturas no consultan el gate. semse-worker no monta `/data`; un write que resuelva ahí se rechaza.
- ✅ Inventario SHA-256 reutilizando los scripts de Field Memory, más runbook de ventana, restore aislado y rollback `MODE=off`.
- ✅ Migración aditiva `20261125140000_storage_write_gate_freeze_ttl`. Sin INSERT, DELETE ni wipe.
- ❌ Ventana productiva, inventarios reales y restore aislado de `/data`: no ejecutados. T-008i sigue abierto.

## Evidencia

- Unitarias de estado, contrato de fuentes, inventario, censo de writers y guard del worker: 32/32.
- API unit + integración del gate (Postgres 16 local en `127.0.0.1:5433/semse`, `CI=true`), incluido el flujo mutate con permiso ausente, TTL, freeze vencido que no reabre, thaw idempotente y `MODE=off`: 35/35, más coordinator/boundary/multiprocess 16/16.
- `verify-prisma-runtime-contract --db`: sin drift. ESLint de los archivos del gate: sin hallazgos. `nest build` del API: ok.
- CI de GitHub de este PR: pendiente en el momento del reporte. No es evidencia de deploy ni de freeze en semse-API.

## Siguientes pasos

1. Revisión humana del PR en draft. No fusionar hasta CI verde: Railway despliega `main` sin esperar al CI.
2. No definir `SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE=mutate` en el merge.
3. La ventana real sigue el runbook `docs/runbooks/FIELD_MEMORY_T008_PRODUCTION_FREEZE_WINDOW.md`, con aprobación aparte. No pulsar Restore ni wipe del volumen de semse-API.
