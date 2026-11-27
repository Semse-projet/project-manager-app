# F1-F — Canary y cierre del Event Backbone

Ejecuta esto solo con acceso real a Railway (`railway login` ya hecho, proyecto
`project-manager-app` linkeado). Corresponde a T-075/T-076/T-077 de
[`docs/specs/platform/event-backbone.tasks.md`](../specs/platform/event-backbone.tasks.md).
No lo corras si F1-D/F1-E no están en el SHA desplegado — confirmar primero
con `railway status` / `git log origin/main -1`.

**Actualización 2026-11-24.** F1-F sigue abierto. El dispatch genérico, el
slice Evidence y el canary de jobs/bids están en código; el cierre
transversal (SLO sostenido, DLQ/replay observados y ausencia de efecto en
pagos sobre la base real) no está verificado. **No reemplaces**
`SEMSE_EVENT_TYPE_ALLOWLIST` ni `SEMSE_EVENT_CONSUMER_ALLOWLIST` por la lista
de un solo slice: hoy esas variables son compartidas con F3
(`project.lifecycle-source-changed.v1` / `project-lifecycle-projection.v1`) y
con jobs/bids (`job.created.v1`, `job.status_changed.v1`, `bid.created.v1`,
`bid.accepted.v1`, `bid.rejected.v1` / `jobs-bids-projection.v1`). Pisarlas
apaga consumidores que ya están en canary.

## Antes de empezar

- F1-A..F1-E ya están mergeados en `main` (confirmado 2026-07-19; ver
  `docs/reportes/F1E_OPS_DLQ_REPLAY_2026-07-19.md`). Railway hace auto-deploy
  en push a `main`, así que el código ya debería estar desplegado.
- Los switches son `default-off` en código — **no hace falta tocar Railway
  para que sigan apagados**. Este runbook es para *encenderlos* de forma
  controlada (canary), no para el deploy inicial en sí.
- `OPS_ADMIN` con `domain-events:read`/`domain-events:replay` es el único rol
  que puede usar los endpoints de T-077 (`/v1/domain-events/outbox`,
  `/v1/domain-events/:eventId/deliveries`, `/v1/domain-events/:eventId/replay`).

## T-075 — Verificar health post-deploy

```bash
railway status
railway logs --service api | tail -100
```

Confirmar sin reinicios/crashloops recientes. Contra el host real de la API
(sustituir `<api-host>`):

```bash
curl -s https://<api-host>/health
curl -s https://<api-host>/ready
```

Ambos deben responder 200. Si alguno falla, **no continuar** a T-076 — el
canary no debe activarse sobre un deploy inestable.

## T-076 — Inspeccionar el canary sin reducir el allowlist compartido

El slice original de F1 sigue siendo `evidence.uploaded.v1` →
`evidence-readiness.v1`. Desde que F3 y jobs/bids entraron al mismo par de
variables, el procedimiento ya no es asignar solo esos dos nombres.

```bash
railway variables --service api
railway variables --service worker
```

Leer en ambas salidas `SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED`,
`SEMSE_EVENT_CONSUMERS_ENABLED`, `SEMSE_EVENT_TYPE_ALLOWLIST` y
`SEMSE_EVENT_CONSUMER_ALLOWLIST`.

Checklist de esta inspección (no es el cierre de F1-F):

- [ ] API y Worker tienen el mismo `SEMSE_EVENT_TYPE_ALLOWLIST` y el mismo
      `SEMSE_EVENT_CONSUMER_ALLOWLIST`.
- [ ] Siguen presentes `evidence.uploaded.v1` y `evidence-readiness.v1`.
- [ ] Siguen presentes los tipos/consumers de F3 y de `jobs-bids-projection.v1`
      si ese canary sigue encendido (ver `JOBS_BIDS_PROJECTION_CANARY.md`).
- [ ] `SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED` y `SEMSE_EVENT_CONSUMERS_ENABLED`
      están en `true` solo si el owner ya aceptó ese canary. Si están en
      `false`, no los enciendas desde este runbook sin la ventana de
      observación de T-077.

No ejecutes `railway variables set` sobre esos allowlists con un valor que
omita nombres ya activos. Un alta nueva se hace concatenando el valor actual
más el nombre nuevo, en API y Worker, y esperando el redeploy de ambos.

## T-077 — Verificar SLO, duplicados, DLQ y ausencia de pagos

Generar una Evidence real de prueba (o esperar tráfico orgánico) y luego, con
un token `OPS_ADMIN`:

```bash
# Backlog y lag — objetivo: PENDING > 60s sostenido debe ser 0
curl -s -H "Authorization: Bearer $OPS_TOKEN" \
  "https://<api-host>/v1/domain-events/outbox?status=PENDING" | jq '.data.oldestPendingAgeMs, .data.counts'

# DLQ — objetivo: DEAD_LETTER sin owner > 15 min debe ser 0
curl -s -H "Authorization: Bearer $OPS_TOKEN" \
  "https://<api-host>/v1/domain-events/outbox?status=DEAD_LETTER" | jq '.data.items'

# Detalle de un evento puntual (duplicados / receipts)
curl -s -H "Authorization: Bearer $OPS_TOKEN" \
  "https://<api-host>/v1/domain-events/<eventId>/deliveries" | jq
```

Checklist de cierre (todo debe cumplirse antes de ampliar el allowlist más
allá de este slice):

- [ ] `counts.PENDING` no crece sin control durante la ventana de observación;
- [ ] `oldestPendingAgeMs` se mantiene bajo (spec: p95 outbox publish lag < 2s);
- [ ] ningún evento queda en `DEAD_LETTER` sin que Ops lo haya revisado
      (usar `POST /v1/domain-events/:eventId/replay` con `reason` si aparece
      uno y la causa ya está corregida);
- [ ] `semse_event_consumer_duplicates_total` en `/metrics` no indica un
      efecto lógico duplicado (solo el receipt debe verse duplicado, nunca
      `Milestone.evidenceReadiness` cambiando dos veces por el mismo evento);
- [ ] `Milestone.status`, `paymentReadiness` y las tablas de `Payments` no
      cambiaron como efecto de este slice (el consumer `evidence-readiness.v1`
      no debe tocarlos — confirmar contra la base real, no solo por código).

## Rollback

Si algo de lo anterior falla:

```bash
railway variables set SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED=false
railway variables set SEMSE_EVENT_CONSUMERS_ENABLED=false
```

No se requiere revertir el deploy ni borrar filas de `DomainOutboxEvent` /
`DomainEventConsumption` — quedan como diagnóstico y son reanudables vía
replay una vez corregida la causa. No ejecutar una migración `down`
destructiva.

## Después de cerrar el canary

Actualizar (no antes, y solo con la evidencia de este runbook en mano):

- `docs/specs/platform/event-backbone.spec.md` → `status: IMPLEMENTED` o
  `VERIFIED` según corresponda;
- `docs/specs/platform/event-backbone.tasks.md` → marcar T-075/T-076/T-077 y
  el "Criterio de cierre" final;
- `ROADMAP.md` → sección F1, marcar F1-F completado.
