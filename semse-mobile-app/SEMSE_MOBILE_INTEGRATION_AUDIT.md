# SEMSE Mobile Integration Audit

- Fecha: 2026-04-23
- Estado: inicial
- Alcance: inventario funcional y mapa de absorcion hacia el ecosistema canonico

## 1. Veredicto rapido

La app movil trae suficiente valor para ser reutilizada casi completa como capa de experiencia:

- navegacion movil ya resuelta;
- lenguaje visual coherente con SEMSE;
- cobertura amplia de dominios worker, client y dev;
- kit UI reutilizable abundante;
- portal tecnico interno util para operadores y equipos.

No esta lista para enchufarse directo al core.
Su estado actual es:

- UX fuerte;
- dominio simplificado;
- datos mock;
- contratos locales desacoplados de `@semse/schemas`;
- cero integracion real con auth, API, storage, ops o agent runtime.

## 2. Inventario de superficies

### Worker / professional

Rutas principales en `src/App.tsx`:

- `/`
- `/trabajos`
- `/trabajo/:id`
- `/evidencias`
- `/nueva-evidencia`
- `/tareas`
- `/materiales`
- `/incidentes`
- `/field-ops`
- `/tracker`
- `/viajes`
- `/hospedaje`
- `/gastos`
- `/anticipos`
- `/liquidacion`
- `/pagos`
- `/disputas`
- `/perfil`
- `/herramientas`
- `/mensajes`

### Client

- `/cliente`
- `/cliente/publicar`
- `/cliente/publicar-detalle`
- `/cliente/trabajos`
- `/cliente/detalle-job`
- `/cliente/comparar`
- `/cliente/match`
- `/cliente/proyecto-activo`
- `/cliente/aprobar`
- `/cliente/pagos`
- `/cliente/documentos`
- `/cliente/disputas`
- `/cliente/reviews`
- `/cliente/perfil`
- `/cliente/ajustes`

### Dev portal

- `/dev`
- `/dev/apis`
- `/dev/explorer`
- `/dev/docs`
- `/dev/sdks`
- `/dev/ambientes`
- `/dev/monitoreo`
- `/dev/logs`
- `/dev/herramientas`
- `/dev/bd`
- `/dev/cicd`
- `/dev/agentes`
- `/dev/testing`
- `/dev/incidencias`
- `/dev/perfil`

## 3. Componentes estructurales reutilizables

### Shell movil

- `src/components/AppLayout.tsx`
- `src/components/AppHeader.tsx`
- `src/components/BottomNav.tsx`
- `src/components/ClientBottomNav.tsx`
- `src/components/SideMenu.tsx`
- `src/components/BottomSheet.tsx`
- `src/components/RoleToggle.tsx`

### Shell dev portal

- `src/components/DevLayout.tsx`

### UI kit

La carpeta `src/components/ui/` contiene un set grande de primitives:

- formularios
- dialogs
- drawers
- tabs
- tables
- chart
- command
- sidebar
- calendar
- navigation
- menus
- feedback

Esto es valioso aunque despues parte deba converger a `project-manager-app/packages/ui`.

## 4. Modelo local actual

La app hoy define tipos locales en:

- `src/types/index.ts`
- `src/data/mockData.ts`
- `src/data/clientMockData.ts`

Los dominios locales cubren:

- jobs
- tasks
- materials
- evidences
- incidents
- trips
- expenses
- payments
- disputes
- advances
- hotel reservations
- field units
- client jobs
- proposals
- milestones
- client projects
- escrow payments
- contract docs

## 5. Mapeo hacia el ecosistema canonico

### Ajuste general obligatorio

Antes de conectar esta app:

- los tipos locales deben alinearse o reemplazarse por `@semse/schemas`
- los fetches deben ir contra el BFF o API canonica
- el auth local debe alinearse con `packages/auth` y `apps/api/src/modules/auth`
- la navegacion debe mapearse a entidades reales del dominio canonico

### Worker / professional -> correspondencia canonica

| Superficie movil | Dominio canonico |
|---|---|
| `trabajos`, `detalle trabajo` | `JobsModule`, `ProjectsModule`, `apps/web/app/(app)/worker/jobs` |
| `evidencias`, `nueva evidencia` | `EvidenceModule`, worker evidence web |
| `tareas` | `TasksModule` |
| `materiales` | `MaterialsModule` |
| `incidentes` | `IncidentsModule` |
| `field-ops` | `FieldOpsModule` |
| `tracker` | `FieldOps tracker` |
| `viajes`, `hospedaje`, `gastos`, `anticipos`, `liquidacion` | `TravelModule` |
| `pagos` | `PaymentsModule` |
| `disputas` | `DisputesModule` |
| `perfil` | `UsersModule`, `RatingsModule`, auth/session |
| `mensajes` | todavia sin modulo canonico fuerte |

### Client -> correspondencia canonica

| Superficie movil | Dominio canonico |
|---|---|
| `publicar`, `publicar-detalle` | jobs create / client jobs |
| `trabajos`, `detalle-job` | jobs + projects + contracts |
| `comparar`, `match` | `MatchingModule`, trust, proposals |
| `proyecto-activo` | project + milestones + evidence + escrow |
| `aprobar` | milestones review loop |
| `pagos` | escrow / payments |
| `documentos` | contracts + evidence + uploads |
| `disputas` | disputes |
| `reviews` | ratings |
| `perfil`, `ajustes` | auth + user profile |

### Dev portal -> correspondencia canonica

| Superficie movil | Dominio canonico |
|---|---|
| `apis`, `explorer` | `docs/architecture/SEMSE_API_SURFACE_V1.md`, swagger, BFF |
| `docs` | `program/`, `vision/`, `project-manager-app/docs/` |
| `agentes` | `packages/agents`, `modules/agents`, `modules/autonomy` |
| `bd` | Prisma schema, migrations |
| `monitoreo`, `logs`, `incidencias` | `ops`, `domain-events`, observabilidad futura |
| `ambientes`, `cicd`, `testing` | runbooks, workflows, local bootstrap, CI |

## 6. Lo que conviene absorber casi intacto

Estas piezas tienen alto valor y baja resistencia:

- layout movil general
- bottom nav worker
- bottom nav client
- app header
- dev portal shell
- taxonomy de pantallas
- lenguaje visual movil
- widgets de dashboard
- muchas paginas de travel, worker y client como base de UX

## 7. Lo que no debe absorberse tal cual

- tipos de dominio locales como fuente final de verdad
- mocks como contrato funcional
- rutas desacopladas de entidades reales del backend
- dev portal si termina duplicando `apps/web/app/(app)/admin/*`
- mensajes si no existe primero un backend claro

## 8. Riesgos de integracion

### Riesgo 1: duplicacion de frontend

Si se integra sin estrategia, terminaremos con:

- `apps/web` canonico;
- `semse-mobile-app`;
- dos UX para el mismo dominio;
- dos juegos de tipos;
- dos fuentes de verdad de navegacion.

### Riesgo 2: dominio superficial

La app movil habla bien la UX de SEMSE pero simplifica:

- jobs
- milestones
- proposals
- escrow
- disputes
- travel

Eso obliga a un trabajo de alineacion, no solo de fetch.

### Riesgo 3: reuse del kit UI sin criterio

No todo el `ui/` local debe pasar directo a `packages/ui`.
Hay que separar:

- primitives utiles;
- wrappers propios de la app movil;
- componentes solo decorativos.

## 9. Estrategia quirurgica recomendada

### Fase 1

Congelar e inventariar esta app como fuente estable.

### Fase 2

Revisar pantalla por pantalla y etiquetar cada una como:

- `reusable as-is`
- `reusable with schema adaptation`
- `needs backend-first redesign`

### Fase 3

Conectar primero dominios con mayor madurez canonica:

1. auth
2. jobs
3. evidence
4. travel
5. disputes
6. payments

### Fase 4

Extraer a shared:

- layout patterns
- nav patterns
- cards
- list items
- form sections

### Fase 5

Decidir convergencia estructural:

- mantener `semse-mobile-app` como app separada del ecosistema
- o migrarla progresivamente al monorepo como futura `apps/mobile`

## 10. Siguiente trabajo recomendado

1. revisar pantalla por pantalla
2. clasificar cada vista
3. mapear cada vista a endpoint o modulo canonico existente
4. priorizar el primer lote de integracion real

## 11. Decision tomada en esta sesion

La app movil:

- si se conserva;
- si se usara practicamente toda su UX;
- no se conectara en bloque;
- se integrara de forma quirurgica y por dominio para preservar valor y evitar duplicacion caotica.
