# Ningún rol podía mover un trabajo de estado, y la transición fallaba al emitir su evento

**Fecha:** 2026-11-06 · **Rama:** `claude/fix-job-transition-permission` (desde `main` @ `faf8ae0`) · **Origen:** el recorrido completo de contratación contra la API local, al reescribir los specs e2e de API · **Decisión del responsable:** permiso nuevo `jobs:transition` (opción recomendada)

## Diagnóstico

Hay dos fallos encadenados en `POST /v1/jobs/:jobId/transition`.

1. **403 para todos los roles.**
   - La ruta exigía `jobs:update`, y **ningún rol lo tiene** en `packages/auth/src/rbac.ts` (ni siquiera `OPS_ADMIN`; no aparece en el historial del archivo).
   - Así, el profesional no podía empezar el trabajo (`in_progress`) ni pedir revisión (`review`), y el cliente no podía cerrarlo (`completed`). Son los botones de `/worker/jobs/[jobId]` y `/client/jobs/[jobId]`.
   - Sin `COMPLETED` no se pueden enviar valoraciones («Ratings can only be submitted for completed jobs») y la reputación nunca cuenta trabajos completados.
   - Es la forma RC3 de `semse-rbac-permissions`: un permiso que bloquea una función entera.
2. **500 después de aplicar el cambio.**
   - Tras actualizar el estado y escribir la auditoría, `transitionJob` emite `job.status_changed` por `DomainEventBus`.
   - Ese tipo está en `EVENT_CATALOG.md` («Jobs & Bids Event Projection»: el código emite `job.created`, `job.status_changed` y `job.preferred_professional_selected`), pero no en `semseEventSchema`. El bus lanzaba un `ZodError`.
   - Le pasa igual al cierre automático (`systemCompleteJob`).
   - Quedaba oculto por el 403. Con sólo el arreglo de permisos, cada transición se habría guardado y luego habría devuelto 500.

## Cambio

- `packages/auth/src/rbac.ts`: permiso nuevo `jobs:transition` para `CLIENT`, `PRO` y `OPS_ADMIN`.
  - `WORKER`, `EVENT_CONSUMER` y `DEMO_AGRO` no lo reciben.
  - Quién puede dar cada paso lo sigue decidiendo `assertTransitionAuthorized`:
    - el cliente sólo puede hacer las transiciones de cliente, y sólo en sus trabajos;
    - el profesional, sólo las suyas en el trabajo asignado;
    - `OPS_ADMIN` puede hacer cualquiera.
- `jobs.controller.ts`: la ruta de transición exige `jobs:transition` en lugar de `jobs:update`.
- `packages/schemas/src/domain-events.schema.ts`: se añade `job.status_changed` con el payload de su versión `.v1` (`jobId`, `fromStatus`, `toStatus`) a la unión del bus, a `SEMSE_EVENT_TYPES` y a `EVENT_AGENT_MAP` (`risk`, `audit`, los disparadores que ya pasa el servicio). No es un evento nuevo: el catálogo ya lo registra.

## Desviación del plan aprobado: `jobs:update` no se concede

La propuesta aprobada incluía conceder `jobs:update` (editar el trabajo) a `CLIENT` y `OPS_ADMIN`. **No se hizo.** `PATCH /v1/jobs/:jobId` (`JobsService.update` → `JobsRepository.updateFields`) sólo filtra por tenant, sin comprobar que el trabajo sea de quien lo edita. Concederlo permitiría a cualquier cliente editar trabajos de otras organizaciones del mismo tenant.

Hoy no es explotable precisamente porque nadie tiene el permiso. Un test lo fija: falla si algún rol recibe `jobs:update` antes de que la edición compruebe la propiedad.

Consecuencias:

- Editar un trabajo sigue bloqueado (403) para todos.
- `PATCH /v1/tasks/:taskId/status`, que el móvil usa para «Mis tareas» y también exige `jobs:update`, sigue igual.

Las dos cosas necesitan su propio cambio.

## Verificación

| Prueba | Resultado |
|---|---|
| `tests/unit/job-transition-permission.test.ts` (nuevo) | 4/4: roles con y sin `jobs:transition`, alias `PROFESSIONAL`/`ADMIN`, nadie con `jobs:update`, la ruta exige `jobs:transition`. Con el código anterior fallan 2. |
| `tests/unit/job-status-changed-event.test.ts` (nuevo) | 5/5: el bus acepta el evento como lo emiten `transitionJob` y `systemCompleteJob`, exige su payload, está registrado, y todo tipo `job.*` que emite `jobs.service.ts` está en el schema. Con el schema anterior fallan 4. |
| Tests de API (runner completo) | 3780 pasan. Fallan 8 `SAT-007`, que necesitan DNS real y también fallan en `main` en este sandbox. |
| Tests unitarios de la raíz | 1648 pasan. Falla 1 (`isUrlSafe`, necesita DNS real; ya fallaba). |
| `tsc` de la API, `@semse/schemas` y `@semse/auth`; eslint del controlador | 0 errores |
| En vivo (API local con identidad por cabeceras, datos demo, junto con #1110): trabajo → reserva → aceptar → contrato → dos firmas → escrow (`mock`) → hito → evidencia → enviar → aprobar → liberar → `in_progress` (PRO) → `review` (PRO) → `completed` (cliente) → dos valoraciones → resumen y reputación | todo 2xx. Antes, las transiciones daban **403** y luego **500**. Con el trabajo completado, la reputación del profesional pasa de `emerging` a `established`. |

Depende de #1110 sólo para el recorrido completo: sin él no se puede crear el contrato. Los dos cambios son independientes y se pueden fusionar en cualquier orden.

## Corrección posterior (revisión de Codex en #1111): cierre antes de completar

Codex señaló, con razón, que el permiso dejaba al cliente completar un trabajo en revisión con hitos pendientes o fondos todavía en el escrow. Eso choca con `DOMAIN_INVARIANTS.md` («`Job` no debe llegar a `COMPLETED` si el cierre operativo y financiero no está resuelto») y desbloqueaba las valoraciones antes de tiempo. Hasta ahora no se podía llegar a ese caso porque nadie tenía permiso para la ruta.

- `JobsService.transitionJob` comprueba el cierre antes de escribir cualquier transición manual a `completed` (desde `review` o `dispute`), para cualquier rol, `OPS_ADMIN` incluido:
  - todos los hitos de los proyectos del trabajo están en `APPROVED` o `PAID`;
  - el escrow no retiene fondos: depósitos − liberaciones − reembolsos, contando sólo transacciones `SUCCEEDED`, da 0.
- Si no, responde **409** con el motivo. La regla es una función pura exportada, `jobCompletionBlockers`.
- El cierre automático (`systemCompleteJob`, tras aprobar todos los hitos) no pasa por aquí y no cambia.

| Prueba | Resultado |
|---|---|
| `apps/api/test/job-completion-closure.test.ts` (nuevo) | 7/7: hitos pendientes, fondos retenidos, transacciones no `SUCCEEDED`, `OPS_ADMIN`, caso permitido, consultas limitadas al trabajo y al tenant, sin consulta en otras transiciones |
| En vivo: recorrido completo con todo liberado | sigue pasando de principio a fin |
| En vivo: completar con 200 retenidos | **409** (antes, 201) |
