# Implementación Épica P0 Projects Archivo por Archivo

Fecha: 2026-04-05

Objetivo:

Traducir la épica `Projects` a un plan de implementación real sobre el repo actual, archivo por archivo.

Documentos relacionados:

- [dtos_exactos_integracion_semse_webassistant_2026-04-05.md](/home/yoni/labsemse/reportes/planning/dtos_exactos_integracion_semse_webassistant_2026-04-05.md)
- [historias_jira_linear_integracion_semse_webassistant_2026-04-05.md](/home/yoni/labsemse/reportes/planning/historias_jira_linear_integracion_semse_webassistant_2026-04-05.md)

## Alcance de esta épica

Entregar el primer `Project Workspace` real, sustentado en `SEMSE`.

Incluye:

- listado canónico de proyectos
- detalle de proyecto
- jobs y milestones relacionados
- warnings y trust en el workspace
- activity básica del proyecto

No incluye todavía:

- docs completos
- AI completa
- field ops
- payments interactivos
- disputes
- rag

---

## Estado actual del repo

### API

Ya existe módulo `projects`:

- [projects.controller.ts](/home/yoni/app%20semse/project-manager-app/apps/api/src/modules/projects/projects.controller.ts)
- [projects.service.ts](/home/yoni/app%20semse/project-manager-app/apps/api/src/modules/projects/projects.service.ts)
- [projects.repository.ts](/home/yoni/app%20semse/project-manager-app/apps/api/src/modules/projects/projects.repository.ts)

Ya están implementados:

- `GET /v1/projects`
- `GET /v1/projects/:projectId`
- `GET /v1/projects/:projectId/milestones`
- `GET /v1/projects/:projectId/payments`
- `GET /v1/projects/:projectId/escrow`
- `PATCH /v1/projects/:projectId/status`

### Web

Hay superficie útil en:

- [apps/web/app/dashboard/page.tsx](/home/yoni/app%20semse/project-manager-app/apps/web/app/dashboard/page.tsx)
- [apps/web/app/dashboard/dashboard-client.tsx](/home/yoni/app%20semse/project-manager-app/apps/web/app/dashboard/dashboard-client.tsx)
- [apps/web/app/page.tsx](/home/yoni/app%20semse/project-manager-app/apps/web/app/page.tsx)
- [apps/web/app/(app)/layout.tsx](/home/yoni/app%20semse/project-manager-app/apps/web/app/%28app%29/layout.tsx)

### Schemas

Paso 1 ya dejó listos DTOs nuevos en:

- [project.view.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/project.view.ts)
- [activity.view.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/activity.view.ts)
- [trust.view.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/trust.view.ts)

---

## Gap real de la épica Projects

Lo que falta para que `Projects` quede realmente integrado:

1. enriquecer el detalle del proyecto
2. agregar activity del proyecto
3. exponer un `ProjectWorkspaceView` real
4. crear pantalla de listado de proyectos en web
5. crear pantalla de workspace por `projectId`
6. conectar trust y warnings

---

## Diseño técnico objetivo

## Endpoints objetivo para esta épica

- `GET /v1/projects`
- `GET /v1/projects/:projectId`
- `GET /v1/projects/:projectId/jobs`
- `GET /v1/projects/:projectId/milestones`
- `GET /v1/projects/:projectId/activity`
- `GET /v1/projects/:projectId/workspace`

### Nota

`/workspace` no es obligatorio, pero es recomendable.

Si no se quiere agregar:

- el frontend puede componer con varias llamadas

Si se quiere mayor robustez:

- `GET /v1/projects/:projectId/workspace` entrega `ProjectWorkspaceView`

Recomendación:

- implementar `/workspace`
- mantener subrecursos también

---

## Cambios por carpeta

## 1. `packages/schemas`

### Archivo

- [project.view.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/project.view.ts)

### Cambios propuestos

- revisar si `ProjectView` necesita:
  - `trustLevel`
  - `warningCount`
  - `primaryJobTitle`
- agregar `ProjectWorkspaceView` final si cambian campos reales de API

### Archivo

- [activity.view.ts](/home/yoni/app%20semse/project-manager-app/packages/schemas/src/activity.view.ts)

### Cambios propuestos

- asegurar shape suficiente para timeline
- opcional:
  - `icon`
  - `severity`
  - `link`

### Archivo nuevo opcional

- `projects.api.ts`

### Uso

- centralizar tipos de query:
  - `ListProjectsInput`
  - `GetProjectWorkspaceInput`

### Resultado esperado

- frontend y backend comparten los mismos DTOs del workspace

---

## 2. `apps/api/src/modules/projects`

### Archivo

- [projects.controller.ts](/home/yoni/app%20semse/project-manager-app/apps/api/src/modules/projects/projects.controller.ts)

### Trabajo

Agregar:

- `GET :projectId/jobs`
- `GET :projectId/activity`
- `GET :projectId/workspace`

### Criterios

- cada endpoint usa `RequirePermissions`
- cada endpoint resuelve actor desde request context
- cada respuesta usa `ok(requestId, data)`

### Archivo

- [projects.service.ts](/home/yoni/app%20semse/project-manager-app/apps/api/src/modules/projects/projects.service.ts)

### Trabajo

Agregar métodos:

- `jobs()`
- `activity()`
- `workspace()`

### Detalle

`workspace()` debe:

1. cargar detalle del proyecto
2. cargar jobs
3. cargar milestones
4. cargar trust snapshot si existe
5. cargar activity reciente
6. derivar warnings

### Archivo

- [projects.repository.ts](/home/yoni/app%20semse/project-manager-app/apps/api/src/modules/projects/projects.repository.ts)

### Trabajo

Agregar consultas:

- `listJobsByProject()`
- `listActivityByProject()`
- `getTrustSnapshotByProject()` si hay storage disponible

### Posible detalle

Hoy el repository ya maneja:

- project
- payments
- escrow
- lifecycle context

Falta expandirlo a lectura compuesta de workspace.

### Riesgo

- meter demasiada composición en repository

Recomendación:

- repository trae datos
- service arma `ProjectWorkspaceView`

### Archivo

- [projects.policy.ts](/home/yoni/app%20semse/project-manager-app/apps/api/src/modules/projects/projects.policy.ts)

### Trabajo

Verificar si:

- `projects:read` cubre jobs y activity
- `projects:financials:read` queda solo para pagos/escrow

### Resultado esperado

- permisos claros por subrecurso

---

## 3. `apps/api/src/common`

### Archivo relevante

- `domain-store` y derivados

### Trabajo

Si el service usa tipos internos demasiado mínimos, ampliar records o usar directamente DTOs de `@semse/schemas`.

### Recomendación

No seguir creciendo records internos ad hoc si ya existen views compartidas.

---

## 4. `apps/web`

## 4.1 Página de listado

### Archivo nuevo recomendado

- `apps/web/app/projects/page.tsx`

### Responsabilidad

- cargar `GET /v1/projects`
- renderizar `ProjectsPage`

### Componentes nuevos recomendados

- `apps/web/components/projects/projects-page.tsx`
- `apps/web/components/projects/project-card.tsx`
- `apps/web/components/projects/project-filters-bar.tsx`

### Estado de UI requerido

- loading
- empty
- error
- ready

## 4.2 Página de workspace

### Archivo nuevo recomendado

- `apps/web/app/projects/[projectId]/page.tsx`

### Responsabilidad

- cargar `GET /v1/projects/:projectId/workspace`
- renderizar el shell del proyecto

### Componentes nuevos recomendados

- `apps/web/components/projects/project-workspace-page.tsx`
- `apps/web/components/projects/project-header.tsx`
- `apps/web/components/projects/project-sidebar.tsx`
- `apps/web/components/projects/project-overview-card.tsx`
- `apps/web/components/projects/project-milestones-panel.tsx`
- `apps/web/components/projects/project-jobs-panel.tsx`
- `apps/web/components/projects/project-warnings-panel.tsx`
- `apps/web/components/projects/project-activity-feed.tsx`

## 4.3 Cliente API

### Archivo recomendado

- `apps/web/lib/semse/projects.ts`

### Responsabilidad

- centralizar fetchers:
  - `listProjects`
  - `getProjectWorkspace`

### Regla

- no duplicar fetch inline en cada componente

## 4.4 Navegación

### Archivo a revisar

- [nav.tsx](/home/yoni/app%20semse/project-manager-app/apps/web/app/nav.tsx)

### Trabajo

- agregar entrada `Projects`
- ajustar jerarquía para que sea la base del workspace

---

## Diseño del endpoint `/workspace`

## Request

```http
GET /v1/projects/:projectId/workspace
```

## Response

```ts
ApiResponse<ProjectWorkspaceView>
```

## Composición del payload

```ts
{
  project,
  jobs,
  milestones,
  trust,
  warnings,
  recentActivity
}
```

## Reglas de warnings

Warnings iniciales sugeridos:

- proyecto bloqueado
- disputa activa
- milestones rechazadas
- milestones submitted sin evidencia
- trust level alto
- escrow inexistente cuando el proyecto lo requiere

## Dónde calcularlos

En `projects.service.ts`

No en el frontend.

---

## Flujo end-to-end esperado

## Caso 1: Listado

1. `WebAssistant /projects`
2. llama `GET /v1/projects`
3. recibe `ProjectSummaryView[]`
4. renderiza tarjetas
5. click abre `/projects/:projectId`

## Caso 2: Workspace

1. `WebAssistant /projects/:projectId`
2. llama `GET /v1/projects/:projectId/workspace`
3. recibe `ProjectWorkspaceView`
4. renderiza:
   - header
   - overview
   - jobs
   - milestones
   - warnings
   - activity

---

## Checklist de implementación exacta

## Backend

- actualizar schemas si falta un campo real
- agregar `jobs`, `activity`, `workspace` en controller
- implementar composición en service
- implementar queries en repository
- asegurar permisos
- devolver `requestId`

## Frontend

- crear `projects/page.tsx`
- crear `projects/[projectId]/page.tsx`
- crear fetchers tipados
- crear componentes del workspace
- integrar navegación
- manejar `loading/empty/error`

## QA

- proyecto visible para `OPS_ADMIN`
- proyecto visible para cliente owner
- proyecto visible para pro asignado
- acceso denegado a org no relacionada
- workspace con warnings correctos

---

## Riesgos al implementarla

### Riesgo 1

- usar detalle minimalista actual de `ProjectRecord` y no enriquecerlo
- efecto:
  workspace pobre y muchos fetches satélite

### Riesgo 2

- mover lógica de warnings al frontend
- efecto:
  drift de negocio

### Riesgo 3

- no crear endpoint compuesto `/workspace`
- efecto:
  más latencia y mayor complejidad de invalidación en frontend

### Riesgo 4

- duplicar pantalla `dashboard` y `projects/:id`
- efecto:
  dos entradas compitiendo por el mismo caso de uso

---

## Decisión recomendada sobre pantallas existentes

### [dashboard/page.tsx](/home/yoni/app%20semse/project-manager-app/apps/web/app/dashboard/page.tsx)

Opciones:

1. migrarla a `/projects`
2. convertirla en overview global de operaciones

Recomendación:

- no usarla como detalle de proyecto
- dejar `projects/:projectId` como workspace canónico

---

## Resultado esperado de esta épica

Al terminar esta épica:

- `SEMSE` ya expone la forma base del workspace
- `WebAssistant` ya navega proyectos reales
- existe una raíz estable para conectar `Docs`, `AI`, `Field Ops`, `Payments` y `Disputes`

En términos prácticos, esta épica reduce el mayor riesgo actual:

- seguir construyendo módulos sobre una noción difusa o duplicada de proyecto
