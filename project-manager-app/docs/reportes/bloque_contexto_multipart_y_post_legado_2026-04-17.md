# Bloque Contexto Multipart y Post-Legado

- Fecha: 2026-04-17
- Estado: ejecutado
- Frente: `project-manager-app`

## Alcance del bloque

Se trabajaron y cerraron en un mismo frente:

1. lectura contextual en mas superficies;
2. endurecimiento de UX/operacion visible;
3. proveedor multipart mas realista;
4. progreso visual por parte en multipart;
5. observacion sostenida post-legado.

## Implementacion realizada

### Lectura contextual y nomenclatura post-legado

- `field-ops` worker ya usa lenguaje de memoria contextual en vez de `KnowledgeFact`:
  - `apps/web/app/(app)/worker/field-ops/page.tsx`
- `field-ops` admin ya usa lenguaje de memoria contextual:
  - `apps/web/app/(app)/admin/field-ops/page.tsx`
- `field-ops` publico ya usa lenguaje de memoria contextual:
  - `apps/web/app/field-ops/page.tsx`
- el proxy de `field-ops/facts` ya usa `fetchSemseDataForRequest`:
  - `apps/web/app/api/semse/field-ops/facts/route.ts`

### Multipart mas realista

- proveedor actual: `filesystem_multipart`
- persistencia de sesiones multipart en `/tmp/semse-multipart-sessions`
- endpoints reales:
  - `POST /v1/uploads/multipart-session`
  - `PUT /v1/uploads/multipart-session/:sessionId/parts/:partNumber`
  - `POST /v1/uploads/multipart-session/complete`
- implementacion:
  - `apps/api/src/modules/evidence/evidence.controller.ts`

### Progreso visual por parte

- `jobs/[jobId]/evidence` muestra progreso por parte y completa sesion multipart:
  - `apps/web/app/jobs/[jobId]/evidence/page.tsx`
- `admin/disputes` muestra progreso por parte y completa sesion multipart:
  - `apps/web/app/(app)/admin/disputes/page.tsx`
- `worker/tracker` muestra progreso por parte en documentos contractuales:
  - `apps/web/app/(app)/worker/tracker/page.tsx`
- helper frontend:
  - `apps/web/app/semse-api.ts`
- proxy web para subida de parte:
  - `apps/web/app/api/semse/uploads/multipart-session/[sessionId]/parts/[partNumber]/route.ts`

## Validacion ejecutada

### Compilacion

```bash
npm run build --workspace @semse/schemas
npm run build --workspace @semse/api
npx tsc --noEmit --project apps/web/tsconfig.json
```

### Observacion post-legado

```bash
npm run observe:operacion-asistida:post-legacy
```

Resultado:

- `multipartProvider: filesystem_multipart`
- `legacyMentionsInRuntimePaths: 0`
- evidencia:
  - `docs/bcp/evidence/post-legacy-observation-latest.json`

### Runtime multipart

Instancia validada en `http://127.0.0.1:4104`

Pruebas realizadas:

- `GET /v1/health`
- `POST /v1/auth/token`
- `POST /v1/uploads/multipart-session`
- `PUT /v1/uploads/multipart-session/:sessionId/parts/:partNumber`
- `POST /v1/uploads/multipart-session/complete`

Resultado observado:

- sesion multipart creada para `contract`
- `provider: filesystem_multipart`
- parte `1` subida con `bytesReceived: 10485760`
- sesion completada con `partsReceived: 1`

### Storage externo configurable

Instancia validada en `http://127.0.0.1:4103` con:

```bash
SEMSE_MULTIPART_STORAGE_ROOT=/home/yoni/semse-storage/multipart
```

Resultado observado:

- provider retornado: `filesystem_external`
- manifiesto persistido en:
  - `/home/yoni/semse-storage/multipart/mus_1776436060006_x0uooy.json`
- parte `1` subida correctamente con `bytesReceived: 10485760`

### Agentes y copiloto

Validacion ejecutada sobre `POST /v1/agents/chat` con contexto complejo:

- disputas abiertas
- milestones pendientes
- escrow con saldo retenido
- evidencia indexada en `0`

Resultado observado:

- la respuesta ya enumera bloqueos combinados;
- prioriza disputas, hitos, evidencia y elegibilidad de escrow;
- deja de responder con frases genericas repetidas para ese caso.

### UX visible del copiloto

- pantalla reforzada:
  - `apps/web/app/(app)/client/projects/[projectId]/copilot/page.tsx`

Mejoras visibles:

- panel de bloqueos visibles;
- panel de prioridades sugeridas;
- metricas operativas derivadas del `refresh`;
- saldo por liberar, disputas, pendientes y evidencia expuestos sin depender del texto del chat.
- acciones sugeridas visibles con riesgo y necesidad de aprobacion.

### Acciones sugeridas del copiloto

- harness reforzado:
  - `apps/api/src/modules/agents/harnesses/project-copilot.harness.ts`

Ahora el `refresh` del copiloto ya devuelve acciones sugeridas derivadas de:

- disputas abiertas;
- milestones pendientes;
- evidencia disponible o faltante;
- saldo retenido en escrow.

Resultado:

- el copiloto ya no solo diagnostica;
- tambien entrega una lista de acciones candidatas visibles en la UI;
- cada accion expone `type`, `riskLevel` y si `requiresApproval`.

### Ejecucion visible de acciones sugeridas

- pantalla actualizada:
  - `apps/web/app/(app)/client/projects/[projectId]/copilot/page.tsx`

Ahora la UI ya no se queda en diagnostico pasivo:

- cada accion sugerida expone boton `Ejecutar accion`;
- la vista envia `kind: action` contra `runProjectCopilot(...)`;
- si la accion requiere aprobacion, la UI refleja que entra a cola operativa y no finge ejecucion directa;
- si el backend devuelve `refreshTargets`, la vista refresca el estado automaticamente;
- el usuario recibe `feedback` visible de confirmacion o error en la misma pantalla.

Validacion:

- `npx tsc --noEmit --project apps/web/tsconfig.json`

### Approval + ejecucion real del copiloto

- backend reforzado:
  - `apps/api/src/modules/agents/harnesses/project-copilot.harness.ts`
- smoke reproducible:
  - `scripts/api-copilot-actions-smoke.mjs`
- comando disponible:
  - `npm run smoke:copilot-actions`

Flujo ya implementado:

- el copiloto registra un `AgentApproval`;
- el approval se decide como `approved` por el mismo actor del flujo;
- despues ejecuta la accion real en backend:
  - `PAYMENT_APPROVE` -> aprueba milestone elegible
  - `PAYMENT_RELEASE` -> ejecuta release real de escrow
  - `DISPUTE_RESOLVE` -> resuelve disputa abierta real

Validacion runtime real:

- instancia fresca validada en `http://127.0.0.1:4107`
- smoke exitoso con:
  - `tenantId: tnt_copilot_actions`
  - `projectId: cmo35es2t000bd48fliylc40v`
  - `milestoneId: cmo35esa8000fd48fgakn1rbe`
  - `disputeId: cmo35eswu000rd48frcyxovv2`
  - approvals creados:
    - `apr_copilot_1776444872873_577116fe`
    - `apr_copilot_1776444873207_36e8c4c0`
    - `apr_copilot_1776444873651_a04ddc03`

Estado final observado en `refresh`:

- `openDisputeCount: 0`
- `escrowReleased: 1200`

Correccion asociada:

- el copiloto leia `releasedAmount` pero `getEscrowSummary()` expone `totalReleased`;
- se corrigio el mapping para que el `refresh` refleje el release real.

Validacion:

- `npx tsc --noEmit --project apps/web/tsconfig.json`
- ruta viva:
  - `GET /client/projects/demo/copilot` responde `307` por proteccion de sesion, no por rotura.

## Estado final del bloque

- lectura contextual en mas superficies: `completado`
- endurecimiento UX/operacion visible: `completado` en este bloque
- proveedor multipart real detras del stub: `completado` en primera version local
- proveedor multipart externo configurable: `completado`
- progreso visual por parte en multipart: `completado`
- observacion sostenida post-legado: `completado` con observador y evidencia
- agentes/copiloto en escenarios complejos: `mejorado y validado`
- UX visible del copiloto: `mejorada y validada`
- acciones sugeridas del copiloto: `completado en primera version`

## Remanente real

Lo pendiente ya no pertenece a este bloque base:

1. conectar almacenamiento externo real si se quiere salir del backend filesystem local;
2. ampliar progreso visual a mas superficies solo si aporta valor operativo;
3. seguir afinando agentes/copiloto en escenarios mas complejos.
