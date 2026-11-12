# 2026-11-12 — Pantallas web para Liens, Forge y Satellites

## Objetivo

Varios módulos tienen API en producción pero ninguna pantalla en `apps/web`. Esta sesión diseñó e implementó pantallas
para los que ya tienen un spec aprobado.

## Alcance y specs que lo autorizan

| Módulo | Pantallas | Spec |
|---|---|---|
| Liens | `/admin/liens`, `/client/liens`, `/worker/liens` | `tools.lien-rights-management` (APPROVED) |
| Forge | `/admin/forge`, `/admin/forge/[runId]` | `semse-forge-sdd` + `forge-run-lifecycle` (APPROVED) |
| Satellites | `/admin/satellites` | `satellites.semse-sdk` (APPROVED), `satellites.outbound-webhooks` (IMPLEMENTED) |

**Fuera de alcance, a propósito:**
- Organizations: las invitaciones ya tienen pantalla (`/client/team`). Crews/worksites y task-allocations siguen en
  `DRAFT`, así que no se implementaron (AGENTS.md exige spec aprobado).
- Push notifications: solo existe el registro de dispositivo, que es un flujo móvil; no hay pantalla web que tenga sentido.
- Geofence: el spec `core.geofence-policy` está en `DRAFT`.

No se tocó la API, Prisma, CI ni Railway.

## Qué se construyó

- **BFF** (19 rutas) bajo `app/api/semse/{liens,forge,satellites,admin/liens}`. Todas pasan por el helper nuevo
  `_authenticated-proxy.ts`, que usa `fetchSemseDataForAuthenticatedRequest`: sin sesión firmada responde 401 y nunca
  cae a la identidad estática OPS_ADMIN del servidor.
- **Cliente de API**: `app/lib/module-surfaces-api.ts`, con tipos que reflejan las respuestas reales de la API.
- **Kit de UI** `components/module-surface/ui.tsx`: usa solo tokens (`var(--ok)` + `color-mix`) y funciona en tema
  claro y oscuro. No se usó `StatusBadge` de `@semse/ui` porque fija colores Tailwind del tema oscuro.
- **Liens**:
  - selector de proyecto canónico;
  - calendario de plazos por estado, con cuenta regresiva;
  - generación de avisos;
  - tabla de avisos con preview en `iframe sandbox`;
  - envío por correo certificado con confirmación explícita, porque es facturable vía Lob;
  - firma de waivers con pad de firma y declaración obligatoria.
- **Forge**:
  - tablero con métricas de mission-control, filtros y búsqueda;
  - creación de runs;
  - detalle con stepper de ciclo de vida;
  - transiciones permitidas por la FSM, con confirmación para bloquear, revertir o cerrar;
  - aprobaciones (aprobar/rechazar), tareas y despacho de la siguiente tarea;
  - agentes y bitácora.
- **Satellites**:
  - emisión de tokens con scopes de mínimo privilegio, mostrando el token una sola vez;
  - revocación con confirmación;
  - auditoría y eliminación de webhooks, con estado `SUSPENDED` tras 5 fallos seguidos.
- **Navegación**: hijos nuevos en `admin-navigation.ts`, 5 nodos en `navigation-registry.ts`, entradas en los menús de
  cliente y worker, y claves `nav.lienRights`, `nav.forge` y `nav.satellites` en ES/EN.

## Hallazgos durante la implementación

1. **Los liens cuelgan del `Project` canónico (1:1 con un Job), no del `BuildOpsProject`.**
   `/client/projects/[projectId]` usa IDs de BuildOps, que no sirven para liens. Por eso las pantallas usan un selector
   alimentado por `GET /v1/projects` (con `?projectId=` en la URL). Ese endpoint no devuelve título; el selector muestra
   los IDs de proyecto y de job.
2. **Los usuarios `PRO` entran con el rol de app `worker`.** El middleware no les permite abrir `/client/*`, así que
   hizo falta `/worker/liens`: el profesional es quien genera y envía avisos y firma waivers.
3. **`GET .../liens/notices` excluye los avisos en `DRAFT`.** La pantalla conserva en memoria los borradores recién
   generados (respuesta de `generate-notice`) para poder previsualizarlos y enviarlos. Si se recarga la página antes de
   enviar, el borrador deja de verse. Lo que corresponde es que la API exponga los borradores.
4. `FORGE_RUN_TRANSITIONS` se replica en la web porque `apps/web` no depende de `@semse/forge`. La API sigue siendo la
   autoridad; hay que mantenerlo sincronizado con `packages/forge/src/state-machine.ts`.

## Verificación (local)

- `tsc --noEmit` de `apps/web`: 0 errores.
- `eslint` sobre todos los archivos tocados: limpio.
- `pnpm build:web`: OK; aparecen las 5 páginas y las 19 rutas BFF.
- `pnpm test:unit`: 1568/1597 en la primera corrida. Los 14 fallos eran de entorno: faltaban `apps/api/dist` y el
  cliente Prisma. Tras `pnpm db:generate` y `pnpm --filter @semse/api build`, esos 14 archivos pasan (147 tests,
  0 fallos). Los tests de navegación pasan 8/8.
- Revisión visual con `next start` y Playwright, interceptando `/api/semse/**` con datos sintéticos (sin API real):
  - liens en tema oscuro y claro, y el diálogo de firma;
  - Forge (lista y detalle);
  - Satellites en escritorio y a 390 px.

  A raíz de esta revisión se movieron las acciones fuera del encabezado y se dio ancho mínimo a las tablas, para el
  móvil.

**No verificado:** el flujo contra la API real (no hay Postgres/API en este sandbox), CI de GitHub y el despliegue.

## Siguientes pasos sugeridos

- Que `GET /v1/projects` devuelva el título del proyecto o del job, para un selector legible.
- Exponer en la API los avisos en `DRAFT` (o un filtro de estado).
- E2E con Playwright para firmar un waiver y aprobar un run, siguiendo `semse-functional-test`.
- Cuando crews/task-allocations pasen a `APPROVED`, diseñar sus pantallas con este mismo kit.

## Continuación — Obras y cuadrillas (BO-07)

El propietario aprobó `core.crews-worksites` en esta sesión (registrado en el spec como "Aprobación del propietario —
2026-11-12", versión 0.2). `spec:validate:strict` da 0 errores y `SPEC_INDEX.md` se regeneró.

- **Pantallas**: `/client/crews` y `/worker/crews`. CLIENT y PRO tienen `org:crews:manage`, y PRO entra con el rol de
  app `worker`. Funciones: crear obras, crear cuadrillas con supervisor y obra opcional, agregar o quitar personas y
  archivar con confirmación (es definitivo: no hay endpoint para desarchivar).
- **Estados de la pantalla**: 404 significa flag `SEMSE_CREWS_ENABLED` apagado y se muestra como "aún no habilitado";
  403 se muestra como "tu rol no puede gestionar cuadrillas"; también hay un estado para quien no pertenece a ninguna
  empresa. La UI no activa el flag.
- **BFF**: `organizations/[orgId]/{worksites,crews,crews/[crewId]/members,members/remove,archive}`, todas por el proxy
  autenticado. El `GET crews` existente pasó al proxy autenticado (ninguna pantalla lo usaba).
- **Huecos de la API**:
  - `GET .../crews` no devuelve los miembros (el roster solo lo ve el supervisor), así que el gestor puede agregar y
    quitar personas pero no ver la lista actual.
  - `GET .../members` devuelve `roleId` (un ID interno) y no la clave de rol, así que el selector no puede filtrar
    WORKER; la API valida con 422.
  - Cambiar cualquiera de los dos amplía el contrato y requiere actualizar el spec.
- **Pendiente para después**: geofence (`core.geofence-policy`, en DRAFT). El propietario tiene tres teléfonos para las
  pruebas en dispositivo que exige el spec: un Motorola (Android) y dos iPhone.

## Ampliación de la API de cuadrillas (spec v0.3)

Pedida por el propietario para cerrar los dos huecos anteriores. Los cambios son aditivos: sin migración, sin eventos
nuevos y sin tocar `GET /members`, que pertenece a otro contrato.

- **AC-10**: `GET /v1/organizations/:orgId/crews` incluye `members: [{ userId, addedAt }]` activos por cuadrilla, con
  la misma regla de privacidad que el roster.
- **AC-11**: endpoint nuevo `GET /v1/organizations/:orgId/workers`. Devuelve solo las membresías WORKER ACTIVE
  (`userId`, `since`), con el mismo permiso (`org:crews:manage`), alcance y flag que el resto.
- **Web**:
  - cada cuadrilla lista sus miembros y cada uno tiene botón para quitarlo;
  - "Agregar" ofrece solo trabajadores que no están ya en la cuadrilla;
  - el supervisor se elige solo entre trabajadores.

  Contra una API anterior a v0.3, la pantalla vuelve al comportamiento previo (todas las membresías, sin lista de
  miembros).
- **Tests**: los 2 casos nuevos se escribieron primero y fallaban; también se amplió el chequeo RBAC del controlador.
  `crews-worksites.test.ts` pasa 12/12 y la suite completa de `@semse/api` pasa 4018 tests con 0 fallos.
  `tsc` y `eslint` de la API y la web están limpios, `build:web` OK y `spec:validate:strict` da 0 errores.
