# Reporte — S0: guard de ownership y destino en mutaciones de FreeProject

**Fecha:** 2026-10-15 · **Spec:** [`labor.free-project-mutation-guard`](../specs/labor/free-project-mutation-guard.spec.md) (APPROVED → IMPLEMENTED) · **PR:** #937 · **EPIC:** #935 · **Issue:** #934 · **PR D9:** #938

Estado por capa, sin inferir una de otra:

| SPEC | CODE | TEST local | CI | MERGE | DEPLOY | ACTIVATION | UAT |
|---|---|---|---|---|---|---|---|
| IMPLEMENTED | COMPLETE | PASS (ver Evidencia) | pendiente en #937 | UNMERGED | NOT_DEPLOYED | INACTIVE | NOT_RUN |

## Resumen

En `main` @ `83375e6`, `PATCH`, `DELETE` (archivar) y `POST …/convert` de
`/v1/labor/free-projects/:id` sólo filtraban por `tenantId`. Cualquier
`WORKER`/`PRO` del tenant podía editar, archivar o convertir el proyecto
personal de otra persona, y un PATCH vacío devolvía su nombre, ubicación y
coordenadas. `convert` aceptaba cualquier `jobId` (inexistente, eliminado, de
otro tenant o no asignado) y sobrescribía conversiones previas; `PATCH`
aceptaba cualquier `status` salvo `converted`.

Cambios:

- **Repositorio:** búsqueda y escritura acotadas por `createdBy`
  (`findOwnedFreeProject`, `updateOwnedFreeProject`). Convertir/archivar son
  escrituras condicionales sobre el estado (compare-and-set) con su `AuditLog`
  en la misma `$transaction`; `ensureActorContext` corre antes. Se eliminaron
  los métodos sin scope `updateFreeProject`/`archiveFreeProject`.
- **Servicio:** 404 idéntico para ajeno o inexistente; el Job destino se
  valida con `isJobAssignedToWorker` (misma regla que el selector y
  `startTimer`, incluida la asignación por org — D8) y responde un 403 único;
  409 para archivado o ya convertido a otro Job; reintento al mismo Job
  idempotente; archivar idempotente; ownership antes de geocodificar; logs de
  rechazo sólo con ids y código de razón.
- **Controlador:** contexto de la sesión (tenant/org/usuario/requestId) a las
  tres rutas; `status` en PATCH → 400.
- **Documentación canónica:** `DOMAIN_INVARIANTS.md` (FreeProject como
  agregado personal), `EVENT_CATALOG.md` (`free_project.converted`,
  `free_project.archived`, audit-only), `SEMSE_API_SURFACE_V1.md` (las tres
  rutas), runbook del censo D6.

No se tocaron `TimeEntry`, Jobs, contratos, pagos, Prisma schema, migraciones,
CI ni Railway. No hay feature flag (D7).

## Checklist final

- ✅ Aprobación del owner registrada (spec §14), con condiciones D6–D9 y de concurrencia.
- ✅ Tests negativos escritos primero y rojos contra `main` (18/25).
- ✅ Implementación; los 25 tests de S0 en verde.
- ✅ Integración con PostgreSQL real: ownership, destino y rollback de la transacción.
- ✅ Prueba de mutación: sacar la escritura de la transacción pone rojo el test de rollback.
- ✅ Regresión API, typecheck del workspace, lint de la API, gates SDD.
- ✅ D9 en PR independiente (#938), con su propio test rojo→verde.
- ❌ CI de GitHub, revisión, merge, deploy, smoke autenticado: pendientes.
- ❌ Censo D6: runbook listo; no ejecutado (requiere operador con rol de sólo lectura en producción).
- ❌ Prueba en navegador del mensaje de error en `ProyectosTab`: revisado en código, no ejecutado.

## Evidencia

Entorno: contenedor de la sesión, Node 22.22.0, pnpm 10.33.0, sin red
externa para DNS. Fixtures 100% sintéticos.

1. **Rojo contra `main`** — `apps/api/test/labor-engine-free-project-guard.test.ts`
   con `src` de `83375e6`: 25 tests, 7 pass, **18 fail**. Los fallos son
   `Missing expected rejection`: otro usuario sí podía PATCH/DELETE/convert
   (N1, N2, N1-lectura), convertir a Jobs inválidos (N5–N8), reconvertir (N9),
   convertir archivados (N10) y cambiar `status` por PATCH (N12); tampoco había
   audit, idempotencia ni CAS (P1, P2, N14). Ya pasaban: otro tenant (N3),
   inexistente (N4), `jobId` inválido (N11), `status: "converted"` (2.16), RBAC
   declarado (N13), edición propia y `startTimer` con Job no asignado.
2. **Verde con el cambio** — mismo archivo: 25/25.
3. **Integración** — `labor-engine-free-project-integration.test.ts` contra
   PostgreSQL 16 local (BD `semse_s0_test`, migraciones del repo aplicadas con
   `prisma migrate deploy`): 1/1. Incluye un trigger temporal que hace fallar
   el `INSERT` en `AuditLog`; la conversión responde error y la fila queda
   `active` sin `convertedJobId` ni audit. Las horas sintéticas (510 min)
   quedan intactas.
4. **Mutación** — reemplazar en `dist` `tx.freeProject.updateMany` por
   `this.prisma.freeProject.updateMany` hace fallar el test de integración con
   "la transición no debe quedar escrita sin su audit". Restaurado con build.
5. **Regresión API** — `pnpm --filter @semse/api test:unit`: 3437 tests, 3391
   pass, 38 skipped, **8 fail**, todos en `satellite-webhooks-service.test.ts`
   ("url failed SSRF validation": `resolveSafeUrl` resuelve DNS y la sesión no
   tiene DNS externo). El mismo conjunto falla sin los cambios de S0 (corrida
   del PR #938 sobre `main`).
6. **Unitarios raíz** — `pnpm test:unit`: 1516 tests, 1498 pass, 6 skipped,
   1 fail (`browser-governance: isUrlSafe…`, usa `dns.lookup`) y 1 `# TODO`
   preexistente de la app móvil. Ningún archivo de `packages/` ni `tests/`
   cambió respecto de `main`.
7. **Typecheck** — `pnpm typecheck` (workspace): exit 0.
8. **Lint** — `pnpm --filter @semse/api lint`: 0 errores; 2 avisos
   preexistentes en `milestones.repository.ts` y `payments.repository.ts`.
9. **SDD** — `spec:validate --strict --base-ref origin/main`, `spec:index:check`
   y `spec:audit-plan-coverage`: 0 errores.

## No verificado

- SHA desplegado de `semse-API` (sin acceso a Railway desde la sesión).
- CI de GitHub en el head final de #937.
- Censo D6 en producción (`NOT_EXECUTED`).
- Smoke autenticado de dos usuarios en producción.
- UI en navegador.

## Siguientes pasos

1. Esperar CI y revisión de #937; resolver hallazgos sin ampliar el alcance.
2. Merge sólo con autorización del owner; registrar SHA.
3. Deploy del API y smoke autenticado con dos usuarios de prueba (spec §8).
   Ante una regresión: forward-fix, **nunca** volver a un deployment sin el
   guard (D7).
4. Ejecutar el censo D6 y anotar los conteos sin atribuirlos a personas.
5. Fusionar #938 (D9).
6. S1 (#933): archivados, restauración por endpoint dedicado y paginación;
   S2 (#931): ubicación y semántica de `null` en PATCH; S3 (#932/#934):
   asignación individual para selector, cronómetro y conversión.
