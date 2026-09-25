# Reporte de sesión — Agro T-050: miembros de finca operan los servicios Agro existentes

Fecha: 2026-09-25 · Rama: `claude/semse-agro-consolidation-c23tpv` · Sigue al PR #675

## Problema

Tras #675 un trabajador podía reportar incidencias y declarar capacidades,
pero las tareas, los animales, la evidencia y el inventario seguían siendo
solo del propietario (`farm.ownerId === userId`, si no → 404). Además los
endpoints operativos exigían `agro:write`, que `WORKER` no tiene.

## Cambios

- `agro-farm-policy.ts`: nuevas acciones `farm.manage`, `farm.audit_read`,
  `farm.finance`, `task.create|update|execute`, `animal.operate|status`,
  `evidence.create|update_any`, `inventory.consume|manage`. `task.execute`
  admite al responsable o una tarea sin asignar (`isAssignee`).
- `authorizeFarmAction()`: con `AgroFarmAccessService` aplica la política; sin
  él (tests unitarios antiguos) mantiene solo al propietario.
- Servicios migrados: finca (la lista incluye las fincas donde el usuario es
  miembro, con `viewerRole`), tareas (el responsable debe ser miembro),
  animales, evidencia, inventario (consumo = campo; entradas, ajustes o
  movimientos con costo = supervisión), dashboard (sin datos económicos ni
  actividad para roles sin permiso), sync offline (misma política; el alcance
  del trabajador se aplica en el `WHERE`).
- Los endpoints operativos pasan de `agro:write` a `agro:report`; `DEMO_AGRO`
  recibe `agro:report` (sigue siendo solo Agro).
- Web: el dashboard tolera los datos económicos ocultos; la pantalla de tareas
  oculta "Nueva tarea" y "Cancelar" según `viewerRole` y **muestra los errores
  de iniciar/completar/bloquear**, que antes se perdían sin un modal abierto
  (fallo previo).

## Hallazgo de seguridad corregido (R10)

`GET v1/agro/animals/:id`, `animal-groups/:id`, `tasks/:id`, `evidence/:id` e
`inventory/items/:id` devolvían el registro sin comprobar la finca: cualquier
usuario con `agro:read` podía leer datos de fincas ajenas si conocía el id. El
fallo es previo, pero #675 dio `agro:read` a `WORKER` y amplió la exposición.
Ahora esos endpoints usan `get…ForUser(id, userId)`, que exige ser miembro
(404 si no). Lo cubre el E2E. Revisé el resto de controllers Agro: los demás
comprueban la finca o no tocan datos de finca (catálogo, simulador).

## Sin cambios (decisión pendiente)

Los servicios económicos (costos, ventas, rentabilidad, producción, simulador,
ciclos, trazabilidad, cumplimiento, reporte de auditoría) siguen siendo solo
del propietario. Ampliarlos a MANAGER es una decisión de producto.

## Verificación

- Build del API, `tsc` del web y eslint de los archivos tocados.
- `agro-membership-operations-integration.test.ts`: E2E HTTP contra Postgres
  con 5 identidades (propietario, supervisor, trabajador, veterinaria y un
  usuario ajeno a la finca): lectura, límites de estructura y finanzas,
  tareas propias/ajenas/sin asignar, animales, evidencia, inventario,
  dashboard sin datos económicos y sync.
- Suites Agro + Prometeo + demo: 320/320.
- Playwright 390px: el trabajador ve la finca en `/agro`; el dashboard no
  muestra costos (el propietario sí); no ve "Nueva tarea"/"Cancelar";
  completa su tarea (queda COMPLETED); al intentar la ajena ve el aviso y la
  tarea sigue PENDING.
