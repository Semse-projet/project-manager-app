# #1083 — revisión y verificación posterior al merge
Fecha de observación: 2026-11-05, 03:29–03:34 UTC.

**Dictamen técnico del alcance estático: SIN BLOQUEOS IDENTIFICADOS. Verificación funcional completa de producción: BLOQUEADA por credenciales de prueba no disponibles.** Esto no constituye aprobación humana independiente ni cumplimiento retroactivo de los gates exceptuados.

## Identidad y alcance
- Repositorio: Semse-projet/project-manager-app.
- HEAD original de #1083: `890605c5f28c1e9494bdc0618920efb51ac919b1`.
- Squash fusionado: `be748bbf1fcae0598d88ba2911a99fe0b3dccec1` (2026-11-04T12:58:26Z).
- El diff efectivo de ese squash contiene únicamente O.HI4 y O.HI5. El filtro productivo de tenant y O.HI3 ya estaban en main por #1008.
- Revisión de seguimiento: #1091, HEAD `bec9cd6ecb30d846deafb0fb2e5689e27985d477`, merge `30fec1056ddaa3d3130ff3a80962fbab524e936d`.
- SHA actualmente desplegado, distinto del squash original: `61d23ee8ddaa44aa162b4ffe80416147cd28eb50`; contiene ambos merges por ancestría Git comprobada.
- Proyecto Railway: `95ad1b14-d1d9-467d-82d8-5354619ba873`, ambiente production `d682210a-956a-4508-9c5b-4ca5959278f9`.
- API real: https://api.semseproject.com. Web: https://app.semseproject.com (dominio observado; no se ejecutó un smoke web).

## Despliegues observados
| Servicio | Deployment ID activo | Estado / SHA |
|---|---|---|
| API | 969f35ab-a07c-438b-854f-242f0a036a6d | SUCCESS / 61d23ee8… |
| Web | 7ce964ef-50b9-45f8-969c-0f90fd4769af | SUCCESS / 61d23ee8… |
| Worker | e060949d-ada5-4ada-8618-4696b04c77a5 | SUCCESS / 61d23ee8… |
| Vision | aeb7a16b-450a-4991-93d4-be2becbf8870 | SUCCESS / 61d23ee8… |

Los cuatro estaban ONLINE, una réplica corriendo cada uno, sin fallos recientes ni alertas de esos servicios en la consulta de la última hora; no había trabajo staged/applying. No equivale a disponibilidad continua. API registró `api_bootstrap_complete` a 03:23:44 UTC. No se cambiaron configuración, flags, roles, sesiones ni datos.

## Revisión de seguridad y seguimiento existente
Inspeccionados el diff completo integrado, O.HI4/O.HI5, controlador y servicio Observer, AuthGuard, contexto, AuthService/AuthRepository, RbacGuard y su registro global. Se contrastaron las piezas aplicables con el SHA desplegado:
- `AuthGuard` rellena el contexto con autenticación de servidor antes de RBAC.
- La autorización contrasta usuario, tenant, organización, expiración y roles con sesiones y membresías activas.
- `observerHistory` conserva `ops:dashboard:read` y filtra por tenant antes de contar y seleccionar los últimos diez. Solo existe un consumidor de `getHistory()` en el árbol API revisado.
- El filtro, repositorio de sesiones, token, RBAC y servicio Observer no cambiaron entre el squash y el SHA desplegado. El cambio posterior #1092 endurece el fallback de cabeceras: solo opt-in local explícito en development/test; el resto falla cerrado sin autoridad.
- No se identificaron vulnerabilidades nuevas críticas/altas en este alcance. No se revisó exhaustivamente el resto del ecosistema ni se ejecutaron pruebas autenticadas en producción.

**Deuda de revisión automatizada: evidencia retrospectiva localizada y reconciliada.** [#1091](https://github.com/Semse-projet/project-manager-app/pull/1091) corrigió los huecos de tests de #1083; [Codex completó code review sin hallazgos](https://github.com/Semse-projet/project-manager-app/pull/1091#issuecomment-6639444507) sobre su HEAD exacto. Es evidencia de seguimiento sobre ese alcance y su delta, no una revisión humana, ni una revisión previa de #1083. El check Devin indica PASS, pero su descripción dice que omitió la revisión por falta de créditos: **no se cuenta como revisión ejecutada**. No se acredita una segunda herramienta de revisión solo por ese check.

Los casos de #1091 cubren payload alterado, firma incorrecta, expiración, refresh/no sid, sesión cross-tenant, escalada de rol, revocación y configuración sin secreto; O.HI5 agrega autorización persistida y falla en CI si falta DATABASE_URL. La prueba sigue usando un fixture de Observer y no ejecuta el AppModule completo.

## Pruebas y procedencia
| Verificación | Procedencia / resultado | Estado y límite |
|---|---|---|
| O.HI4 ampliada | [unit-coverage #126778086109](https://github.com/Semse-projet/project-manager-app/actions/runs/41888156911/job/126778086109): O.HI4 PASS; suite 3718 PASS, 0 FAIL, 38 SKIP | CI OBSERVADO; no ejecución local propia |
| O.HI5 ampliada | [integration #126778085392](https://github.com/Semse-projet/project-manager-app/actions/runs/41888156762/job/126778085392): O.HI5 PASS; suite 147 PASS, 0 FAIL, 7 SKIP | CI OBSERVADO, PostgreSQL aislado |
| CI #1091 | quality-gates, unit-coverage, E2E e integration SUCCESS | Checkout sintético db5d0d9… de bec9cd6… sobre be748bbf…; no extender al SHA desplegado completo |
| API health | GET /v1/health → 200, 03:33:25 UTC | EJECUTADA en producción |
| Identidad anónima | GET /v1/auth/me → 401, 03:33:25 UTC | EJECUTADA |
| Historial anónimo | GET /v1/ops/observer/history → 401, 03:33:26 UTC | EJECUTADA |
| Cabecera tenant sintética sin sesión | Mismo endpoint → 401, 03:33:27 UTC | EJECUTADA; no prueba sesión válida |
| Bearer sintético inválido | Mismo endpoint → 401, 03:33:27 UTC | EJECUTADA |
| OPS_ADMIN A/B, cabecera falsificada con sesión válida y cuenta sin permiso → 403 | Faltan sesiones autorizadas y fixtures sintéticos conocidos | BLOQUEADA por acceso |

Las tres solicitudes al historial se correlacionaron en logs HTTP de API deployment `969f35ab…` a 03:33:27.061 / .528 / .737 UTC, todas 401. No se guardaron cuerpos ni datos de usuarios. El script termina con código **2** por la sección autenticada bloqueada: no se presenta como PASS global.

## Credenciales y limitaciones
El entorno de ejecución no declara credenciales/variables de smoke en el runtime ni están configuradas las variables OBSERVER_TOKEN_A/B/DENIED y OBSERVER_TENANT_A/B. Tampoco se encontraron nombres SMOKE/TEST/QA en la configuración de la API mediante describe-service. No se extrajeron secretos de producción, ni se falsificaron sesiones con AUTH_SECRET, ni se reutilizaron contraseñas de ejemplos.

Se preparó `observer-production-smoke.py`, de solo lectura, sin redirects y sin imprimir tokens ni cuerpos. Para acreditar aislamiento requiere, además de las tres sesiones, un oráculo sintético conocido no vacío por tenant mediante OBSERVER_EXPECTED_A/B (`{count, snapshots}`). Dos respuestas vacías no demuestran aislamiento. Los datos del oráculo no se publican.

El recurso opcional `scripts/verify_http.py` de la skill no pudo leerse con el proveedor; las pruebas se ejecutaron mediante el runner anterior. No se atribuye ejecución a ese script.

## Cierre documental y pendientes
- La excepción de fusión de [#6631231808](https://github.com/Semse-projet/project-manager-app/pull/1083#issuecomment-6631231808) y la condición de mantenedor único confirmada por el propietario se conservan. No se fabrican revisiones humanas ni aprobaciones retroactivas.
- Se sustituye el resumen obsoleto BUILDING por la evidencia terminal histórica y la observación actual, identificando sus SHA diferentes.
- Persiste una contradicción documental preexistente: consciousness.spec.md §2 llama globales a estas métricas, mientras la Constitución art. VII y el código exigen aislamiento tenant para history. Se registra como corrección documental pendiente, sin ampliar la autorización cross-tenant ni promover estados SDD.
- #1084 y #1089 siguen separados; no se fusionaron ni se desplegaron sus cambios de capacidad como parte de esta tarea.
- Próximo cierre de producción: configurar por canal seguro sesiones de cuentas de prueba A/B y sin permiso, con fixture conocido; ejecutar el runner, verificar identidades/200/401/403 y ausencia de datos ajenos, correlacionar deployment/logs y adjuntar resultado. Responsable del acceso: propietario; ejecución y documentación: asistente.

## Errata y propuesta de alineación del spec

El §2 de `docs/specs/api/consciousness.spec.md` conserva la frase «No requieren tenant específico — son métricas de plataforma». Esa generalización **no describe** el comportamiento autorizado ni implementado de `observer/history`. La Constitución art. VII y el filtro del controlador prevalecen para esta ruta.

Redacción propuesta para sustituir esa generalización en la migración documental del spec:

> El permiso ops:dashboard:read no concede lectura cross-tenant. En GET /v1/ops/observer/history, el tenant procede del contexto autenticado por el servidor y una cabecera x-tenant-id no lo sustituye. El historial se filtra por ese tenant antes del conteo y de seleccionar los últimos diez. Sin snapshots propios, count es cero y snapshots es una lista vacía.

El contrato actual, dentro del envelope `data`, es `{count, snapshots}`; cada snapshot resumido tiene `observedAt`, `healthScore`, `alerts` (conteo), `criticalSignals` y `ragMode`. El spec antiguo lo describe como un array de snapshots completos.

La edición directa de ese spec legacy exige migrarlo a SDD 2.0 según `scripts/spec-validate.mjs --base-ref`. Su estado histórico VERIFIED exigiría declarar activación y evidencia productiva completa, que esta sesión no ha obtenido. Por eso este PR registra la errata y el reemplazo concreto, sin fabricar metadata, cambiar estados ni eludir el validador. La migración del spec sigue pendiente y debe reconciliar la evidencia de toda su capacidad, no solo history.

