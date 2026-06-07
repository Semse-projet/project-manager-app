# BuildOps Rerun Bridge — Smoke Report
**Fecha:** 2026-05-13  
**Rama:** `dev`  
**API local:** `http://localhost:4000`  
**Script:** `scripts/buildops-rerun-bridge-smoke.mjs`

---

## Qué se probó

El endpoint `POST /v1/buildops/plans/:buildOpsProjectId/rerun-bridge` implementado en:

- `apps/api/src/modules/buildops/buildops-plan-rerun.service.ts`
- `apps/api/src/modules/buildops/buildops.controller.ts` (línea 294)

### Flujo cubierto

1. Seed de fixture con `ProjectIntake` + `Job` + `BuildOpsProject` en estado `changes_requested`
2. Llamada al endpoint con actor `OPS_ADMIN`
3. Verificación de respuesta + base de datos
4. Casos negativos (bloqueos)
5. Limpieza automática de fixture

---

## Resultado local

```
SMOKE: rerun-bridge  →  http://localhost:4000

  ✅  PASS  blocked when approvalStatus=approved
  ✅  PASS  blocked when approvalStatus=rejected
  ✅  PASS  blocked for non-existent buildOpsProjectId
  ✅  PASS  blocked without OPS_ADMIN role
  ✅  PASS  happy path — changes_requested → rerun_completed
  ✅  PASS  version history — v1 superseded, v2 active
  ✅  PASS  plan approval status reset to pending after rerun
  ✅  PASS  no legacy promotion after rerun
  ✅  PASS  tasks created after rerun (tasksCreated > 0)
  ✅  PASS  traceability — sourceToolResult set on active version
  ✅  PASS  blocked when approvalStatus=pending (not changes_requested)
  ✅  PASS  blocked when legacyPromotionStatus=promoted

────────────────────────────────────────────────────────────
  12/12 checks passed

Result: PASS
```

---

## Comportamiento confirmado

| Escenario | Estado esperado | Resultado |
|-----------|----------------|-----------|
| `changes_requested` + `OPS_ADMIN` | 200 `rerun_completed` | ✅ |
| `approved` | 409 | ✅ |
| `rejected` | 409 | ✅ |
| `pending` (post-rerun) | 409 | ✅ |
| `legacyPromotionStatus=promoted` | 409 | ✅ |
| ID inexistente | 404 | ✅ |
| Sin rol `OPS_ADMIN` (rol `CLIENT`) | 403 | ✅ |
| Versión v1 queda `superseded` | DB check | ✅ |
| Versión v2 queda `active` | DB check | ✅ |
| `clientPlanApprovalStatus` reset a `pending` | DB check | ✅ |
| Sin artefactos legacy promovidos | DB check | ✅ |
| `tasksCreated > 0` | respuesta API | ✅ |
| `sourceToolResult` en versión activa | DB check | ✅ |

---

## Comandos usados

```bash
# Levantar API local (con DB corriendo en puerto 5433)
cd apps/api
DATABASE_URL="postgresql://semse:semse@127.0.0.1:5433/semse?schema=public" \
  node dist/main.js

# Ejecutar smoke
DATABASE_URL="postgresql://semse:semse@127.0.0.1:5433/semse?schema=public" \
  SEMSE_API_URL="http://localhost:4000" \
  node scripts/buildops-rerun-bridge-smoke.mjs
```

---

## Variables requeridas

| Variable | Descripción | Default |
|----------|-------------|---------|
| `SEMSE_API_URL` | URL base de la API | `http://127.0.0.1:4000` |
| `DATABASE_URL` | Postgres (para seed/cleanup directo) | Cargado desde `packages/db/.env` |

> El smoke hace seed y cleanup directo por Prisma para evitar dependencia de endpoints de administración. Requiere acceso a la base de datos desde el host donde se ejecuta.

---

## Contra Railway

**No ejecutado en esta sesión.** Para ejecutar contra Railway:

```bash
SEMSE_API_URL="https://tu-api.railway.app" \
  DATABASE_URL="postgresql://..." \  # Railway DB URL
  node scripts/buildops-rerun-bridge-smoke.mjs
```

> Railway requiere `AUTH_SECRET` en producción → el endpoint requerirá un Bearer token válido.
> El smoke script actualmente usa headers planos (modo dev sin `AUTH_SECRET`). Para Railway
> habría que agregar soporte de `SEMSE_AUTH_TOKEN` como Bearer.

---

## Limitaciones encontradas

1. **Sin soporte de JWT**: el smoke usa headers de identidad planos (`x-tenant-id`, etc.). En entornos con `AUTH_SECRET` (Railway production) no funcionará sin un token válido.

2. **Seed/cleanup directo por Prisma**: el script necesita acceso de escritura a la base de datos. No aplica si la DB está en Railway sin acceso externo.

3. **`computeBridgePlan` llama al LLM**: el rerun real invoca el motor de IA (Anthropic). En local sin `ANTHROPIC_API_KEY` podría fallar. En la prueba de hoy pasó porque la API tenía credenciales configuradas en el entorno.

---

## Estado de tests al cierre

```
Unit tests (API):  209/209 ✅
Smoke local:       12/12   ✅
```

---

## Próximo frente recomendado

**Prioridad 2 — Notificaciones de aprobación/rechazo (SSE + email)**

Con el rerun-bridge validado operacionalmente, el flujo completo está probado:

```
intake → Job → BuildOpsProject → plan → approval → promote | rerun
```

El siguiente bloque monetizable es cerrar el loop de comunicación con el cliente:

- Evento `buildops.plan.approved` → SSE dashboard + email cliente
- Evento `buildops.plan.changes_requested` → SSE + email OPS
- Evento `buildops.plan.rejected` → SSE + email
- Evento `buildops.plan.rerun_completed` → SSE dashboard (plan listo para re-revisión)
- Registro interno `BuildOpsEvent` con tipo + actorId + timestamp + payload
