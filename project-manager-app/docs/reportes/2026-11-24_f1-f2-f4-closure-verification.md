# F1, F2 y F4 — verificación hacia el cierre

Fecha: 2026-11-24. Ninguna fase queda `VERIFIED` ni activa en producción.

## Resumen

Se auditó el código contra los specs de Event Backbone (F1), Tool Registry (F2) y Mission Control 2.0 (F4). El read-through de jobs/bids ya estaba implementado y apagado. `vision.analyze_video` sigue fuera del spec de F2 (pipeline temporal, capacidad de F7). Lo que sí pedía el spec y no se cumplía era el contrato de invocación: una tool `adapterPending` devolvía 200 `blocked`. Ahora responde 400 `ADAPTER_PENDING` después del policy y antes de cualquier adapter o `PrometeoProposedAction`.

## Checklist final

- [x] F2: `analyze_video` sigue `adapterPending` y no llama a `VisionService`.
- [x] F2: invocación de una tool pendiente es 400, con auditoría `blocked`.
- [x] F2: un rol sin permiso sigue en 403, antes del 400.
- [x] F1: read-through de CLIENT, fallback, backfill y flag apagado siguen verdes.
- [x] F1: PRO/WORKER no consultan la proyección aunque el flag esté encendido.
- [x] F1: `diffJobReadthroughSamples` compara id, título y estado.
- [x] F1-F: el runbook ya no pide reemplazar el allowlist compartido con F3 y jobs/bids.
- [x] F4: tests locales del 404 fuera de allowlist, idempotencia y dry-run siguen verdes.
- [ ] Canary real de F1-F, read-through en Railway y canary incompleto de F4. Siguen abiertos.

## Evidencia

Comandos, desde `project-manager-app/apps/api`, después de `pnpm db:generate` y `pnpm --filter @semse/api build`:

```bash
node --experimental-strip-types --test \
  test/prometeo-tool-execution.service.test.ts \
  test/prometeo-tool-vision-execution.service.test.ts \
  test/prometeo.controller.test.ts \
  test/prometeo-tool-write-execution.service.test.ts \
  test/prometeo-tool-registry.test.ts \
  test/jobs-bids-projection.test.ts \
  test/operational-context.service.test.ts \
  test/mission-control-2.test.ts
```

Resultado: 68 passed, 0 failed.

```bash
node --experimental-strip-types --test test/event-domain-consumer.test.ts
```

Resultado: 10 passed, 0 failed, incluido el caso de dispatch generalizado F1-F.

No hay Postgres ni Docker en esta sesión, así que no se reaplicó la migración contra una base local. No se llamó a Railway ni a producción.

## Siguientes pasos

1. F1-F: el owner ejecuta `docs/runbooks/F1F_EVENT_BACKBONE_CANARY.md` sin pisar allowlists. Registrar SLO, DLQ y ausencia de efecto en pagos. Recién entonces el spec puede pasar a `VERIFIED`.
2. Read-through: ejecutar el SQL de `docs/runbooks/JOBS_BIDS_PROJECTION_CANARY.md` (cero mismatches) y solo después `SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED=true` en la API. Vigilar 5xx de `POST /prometeo/chat`.
3. F2: no cablear `analyze_video` hasta un spec de pipeline temporal. El campo de verificación/compensación sigue sin tarea aprobada.
4. F4: completar el checklist que queda en `docs/runbooks/MISSION_CONTROL_2.md` (404 de un tenant fuera de la allowlist y ACK/RESOLVE/ESCALATE con efecto). No usar `SEMSE_MISSION_CONTROL_V2_ENABLED=true` para el canary.
