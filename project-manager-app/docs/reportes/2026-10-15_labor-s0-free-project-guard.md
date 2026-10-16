# Reporte — S0: guard de ownership y destino en mutaciones de FreeProject

**Fecha:** 2026-10-15 · **Spec:** [`labor.free-project-mutation-guard`](../specs/labor/free-project-mutation-guard.spec.md) (APPROVED → IMPLEMENTED) · **PR:** #937 · **EPIC:** #935 · **Issue:** #934 · **PR D9:** #938

Estado por capa, sin inferir una de otra:

| SPEC | CODE | TEST local | CI | MERGE | DEPLOY | ACTIVATION | UAT |
|---|---|---|---|---|---|---|---|
| IMPLEMENTED | COMPLETE | PASS dirigido (8 fallos DNS locales preexistentes) | PASS (#937, 9/9) | MERGED (#937, #938, #941) | DEPLOYED (`6eae43cb`, Railway SUCCESS) | ACTIVE (guard, sin flag) | PARTIAL: navegación A/B; smoke no ejecutado |

## Adenda UAT del owner — cuentas A/B y proyectos sintéticos (2026-10-15)

**Confirmación posterior, sin atribuciones ni PII:** el propietario declaró expresamente en conversación que creó las cuentas A y B para probar SEMSE Project. Esta declaración **sí certifica su propósito de prueba**, pero **no certifica automáticamente** cada Job, cliente, fotografía, TimeEntry o evidencia previamente existente bajo las cuentas. El bloqueo P0 original se conserva como hallazgo histórico sobre los Jobs y se **refina**: no hacen falta nuevas cuentas solo por su propósito; sigue prohibido utilizar Jobs o evidencias no calificados como fixtures para mutaciones riesgosas.

Pruebas UAT con **datos nuevos exclusivamente sintéticos**, realizadas mediante sesiones separadas en el navegador. Todas las horas son UTC y las ejecuciones son auditables en TinyFish:

| Caso | Inicio–fin UTC (2026-10-15) | Evidencia | Resultado |
|---|---|---|---|
| UI-CREATE-A | 19:20:08–19:20:47 | [Run](https://agent.tinyfish.ai/runs/dcfd8324-6eba-45f9-a4aa-c5b70979dbd4) | PASS: `SMOKE-S0-20261015-VOZ-A` creado, active |
| UI-CREATE-B | 19:20:10–19:21:41 | [Run](https://agent.tinyfish.ai/runs/d19f602f-238c-49fd-a717-05ed510db1f9) | PASS: `SMOKE-S0-20261015-VOZ-B` creado, active |
| UI-LIST-A | 19:22:09–19:22:29 | [Run](https://agent.tinyfish.ai/runs/36e1c2e1-2f68-449f-ab3f-921b27f39f4d) | PASS solo UI: A ve su proyecto y no B |
| UI-LIST-B | 19:22:12–19:22:43 | [Run](https://agent.tinyfish.ai/runs/3e24235e-fc49-4714-941d-7248318112b1) | PASS solo UI: B ve su proyecto y no A |
| UI-EDIT-A | 21:08:18–21:10:23 | [Run](https://agent.tinyfish.ai/runs/122c8e81-e285-4d91-a0fe-b81e46b98588) | Nombre editado y persistido; **color INCONCLUSO**: selección verde, tarjeta en ámbar tras guardar |
| UI-EDIT-B | 21:08:19–21:09:22 | [Run](https://agent.tinyfish.ai/runs/73fe8162-7efa-4546-b751-e075410136e5) | PASS: nombre editado y persistido; selector Job habilitado, **sin conversión** |
| UI-TIMER-A | 21:10:51–21:12:17 | [Run](https://agent.tinyfish.ai/runs/f7a534cf-47e3-4b21-a038-9fd0cd9b087e) | PASS interfaz: start → running → stop, registro completo de **13 segundos**, ningún timer activo al final; persistencia tras relectura API **NOT_VERIFIED** |
| UI-ARCHIVE-B | 21:10:54–21:13:02 | [Run](https://agent.tinyfish.ai/runs/fee94956-fdc8-40c2-b188-78332265990e) | PASS creación/archivo de `SMOKE-T032-20261015-VOZ-B`; **dos pestañas / rechazo de conversión NOT_EXECUTED** |

**Efectos escritos por esta UAT:** tres FreeProjects nuevos `SMOKE-*` (dos activos renombrados con sufijo `-EDITADO` y uno archivado), y un TimeEntry sintético de 13 segundos sobre el FreeProject nuevo de A. No se editaron ni archivaron proyectos anteriores; no se envió conversión ni se cambió ningún Job, evidencia, escrow o pago en estas ejecuciones. El TimeEntry **no se borra** automáticamente.

**Límites de la evidencia:** aislamiento solo en listados de UI, no prueba de autorización por IDs cruzados; identidad única y tenant iguales vía `/v1/auth/me` **NO COMPROBADOS**; color A requiere inspección del JSON con `id` y `color`; T-062 en producción **NOT_EXECUTED** (nunca afirmar 13/13); T-032 de dos pestañas **NOT_EXECUTED**; censo D6 y upload/restore real **NOT_EXECUTED/NOT_VERIFIED**. El último intento de lectura autenticada mediante TinyFish no comenzó por falta de saldo; no se generó información ni hubo nuevas escrituras.

**Recuperación:** continuar con smoke T-062 según `LABOR_S0_FREE_PROJECT_SMOKE.md`, que **crea sus propios dos proyectos temporales, los archiva y cierra las sesiones**. Requiere credenciales introducidas de forma oculta por operador y `jobId` inequívocamente autorizado; no usar proyectos existentes ni evidencias de un Job como fixture. Registrar `smoke-s0.json` solo si ejecutado. No declarar `VERIFIED` ni cerrar #935 por pruebas parciales.

## Acta de verificación de producción (parcial, 2026-10-15 UTC)

La verificación se registra **por capa**, sin equiparar disponibilidad a aceptación funcional:

- **D10 — decisión explícita:** el owner confirmó en la conversación del 2026-10-15 que FreeProject es personal de su creador (`createdBy`) dentro del tenant. Ratificación registrada en la revisión P1 de [#937](https://github.com/Semse-projet/project-manager-app/pull/937) y ese hilo quedó resuelto. No equivale a cerrar otros gates.
- **CI de #937:** nueve checks en verde para el head `372846cb7079276e9238eb8f8f802676c9d77b5d`, incluidos quality, coverage, integración, e2e y CodeQL. **#941:** workflow CI `38777634351` terminó SUCCESS (quality-gates, unit-coverage, e2e). Los resultados locales de pruebas dependientes de DNS, descritos abajo, no se ocultan.
- **Merge:** #937 → `29bf284ca2eb982afad948bb3f80bec395e9f604`; #938 → `cd50c6b75737c8c77af05c54739be4654ebcca0f`; #941 → `6eae43cb56888ade2d180dfa12f9350a48c17300`.
- **Railway API, production:** despliegue `feca4630-fe39-4dfe-96ac-521bb239edef` de `6eae43cb56888ade2d180dfa12f9350a48c17300` terminado **SUCCESS** 2026-10-15T18:15:53.802Z; API online, sin despliegue pendiente en la comprobación posterior.
- **Readiness:** GET `https://api.semseproject.com/v1/ready` → `ready` 2026-10-15T18:23:17.418Z; storage `ok` con `Local storage root is writable (local:/data/semse-storage)`, junto con DB, migraciones, Redis y worker `ok`. Un volumen Railway de 5 GB está montado en `/data`. **No demuestra backup ni restore ni una subida autenticada de evidencia.**
- **Rutas protegidas sin sesión:** GET `/v1/labor/free-projects`, GET `/v1/time-tracker/jobs` y web BFF `/api/semse/time-tracker/jobs` respondieron HTTP **401** sin autenticación. Sólo acredita denegación anónima.
- **Navegación autenticada:** dos perfiles independientes A/B pudieron abrir `/worker/tracker`; ambos muestran rol «Profesional», las seis pestañas y un selector de Job con una opción. A muestra un FreeProject, B lista vacía. **No se comprobó por `/v1/auth/me` que sean personas distintas ni que pertenezcan al mismo `tenantId`.** Los nombres de Jobs observados no prueban por sí solos su carácter sintético. Se navegó **sin mutar datos**.
- **Bloqueo P0 — cuenta A / Job existente no seguro para smoke:** la lectura de `docs/AUDIT_REMEDIATION_PLAN.md` en `main` encontró el Job que ve A (`cmqvqsol40023k101j9fh81mq`) referenciado en una auditoría en vivo que lo trata como trabajo de una **cuenta profesional real** e incluye una evidencia JPEG real. Que el título sea genérico **no lo convierte en fixture sintético**. Prohibido usar ese Job o el FreeProject ya existente de A para pruebas de escritura. La cuenta B tampoco tiene un Job verificado como sintético. Crear/provisionar dos cuentas `WORKER/PRO` expresamente de prueba en el mismo tenant y un Job aislado con asignación autorizada antes de T-062; no interpretar perfiles de navegador guardados como autorización para alterar datos reales. No se ha ejecutado ninguna mutación.
- **T-062:** `NOT_EXECUTED` en producción; **no existe** `smoke-s0.json` verificado de la corrida real. El `PASS (13/13)` del PR #941 procede sólo de fixtures de prueba locales.
- **T-032:** `NOT_EXECUTED` en navegador el conflicto de dos pestañas / proyecto archivado. Visibilidad de controles no valida error 409 ni estabilidad después de un conflicto.
- **D6:** `NOT_EXECUTED`; no se dispuso de rol PostgreSQL de sólo lectura para ejecutar el censo sin PII. Conteos **no disponibles**, no cero.
- **Custodia de evidencia:** subida autenticada de foto, inventario SHA-256 de originales y restore aislado siguen `NOT_VERIFIED` y no forman parte de este gate S0.
- **Observación de infraestructura:** Railway muestra Postgres online con un aviso no caracterizado; requiere diagnóstico independiente. No se infiere caída de DB a partir de ese aviso.

**Política de liberación:** este reporte no acredita aceptación de S0 ni cierre del EPIC #935. Si se detecta fallo, remediar con PR y forward-fix; no hacer rollback del guard de ownership.

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

- ✅ D1–D9 y concurrencia documentadas; D10 ratificada **expresamente** el 2026-10-15 y registrada en #937.
- ✅ Tests negativos escritos primero y rojos contra `main` (18/25).
- ✅ Implementación; los 25 tests de S0 en verde.
- ✅ Integración con PostgreSQL real: ownership, destino y rollback de la transacción.
- ✅ Prueba de mutación: sacar la escritura de la transacción pone rojo el test de rollback.
- ✅ Regresión API, typecheck del workspace, lint de la API, gates SDD.
- ✅ D9 en PR independiente (#938), con su propio test rojo→verde.
- ✅ CI de #937 y #941, revisión de #937, merge de #937/#938/#941 y deploy API terminal verificados.
- ❌ Smoke autenticado T-062 de producción (13/13): NO EJECUTADO.
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
   quedan intactas. El mismo archivo corre en el job `integration` del CI
   (`api-integration.yml` ejecuta `test:integration` con `DATABASE_URL`).
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

## Pendientes para aceptación S0

1. **Precondiciones T-062:** comprobar por `/v1/auth/me` que A y B son dos usuarios de prueba diferentes del mismo `tenantId`, con `field-ops:write`; verificar que el `SEMSE_SMOKE_JOB_ID` corresponde a un Job **autorizado y designado expresamente de prueba** para A. No usar el Job sólo porque parezca sintético.
2. Ejecutar `scripts/labor-s0-free-project-smoke.mjs` primero sin `--yes` y luego con `--yes --out smoke-s0.json` desde un entorno autorizado, guardando el JSON sin credenciales; aceptar sólo `PASS (13/13)` y exit 0.
3. Verificar T-032 de dos pestañas con FreeProject sintético y 409 visible en rojo sin romper la lista; comprobar crear/editar/archivar, temporizador propio y Job asignado sin alterar registros ajenos.
4. Subir evidencia **sintética** con cuenta autorizada; comprobar no sólo readiness sino bytes/hash y política de custodia por su runbook separado.
5. Ejecutar censo D6 bajo rol PostgreSQL `READ ONLY` autorizado; registrar sólo agregados. Hasta entonces conservar `NOT_EXECUTED`.
6. Enlazar artefactos y sus horas UTC en el reporte, issue #934 y EPIC #935; sólo entonces evaluar `status: VERIFIED`. Mantener #935 abierto por S1/S2/S3 y otros gates AAAA.
