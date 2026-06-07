# Refinamiento cliente: dashboard, navegación y wizard

Fecha: 2026-04-21
Área: `apps/web/app/(app)/client`

## 1. Auditoría rápida

### Rutas auditadas
- `/client/dashboard`
- `/client/jobs`
- `/client/jobs/[jobId]`
- `/client/jobs/new`
- `/client/payments`
- `/client/milestones`
- `/client/documents`
- `/client/projects`
- `/client/projects/[projectId]/copilot`

### Problemas detectados
- Las tarjetas resumen del dashboard no estaban centralizadas ni reutilizaban un patrón común.
- La navegación de regreso al dashboard existía de forma inconsistente, repetida e inline.
- El listado de trabajos soportaba pocos filtros para los estados que el dashboard necesitaba abrir.
- El detalle del trabajo no exponía el “resumen del proyecto” como un bloque interactivo y claro.
- `Publicar trabajo` ya tenía buena base, pero el stepper no era navegable y la claridad del paso dependía demasiado del contenido interior.
- `payments` todavía no terminaba de respetar deep-links desde el dashboard (`tab`, `jobId`).
- Había un `href` duplicado roto en el empty state del dashboard.
- Los headers del área cliente repetían breadcrumb, título, subtítulo y CTA con variaciones mínimas e inline.

## 2. Plan aplicado

- Centralizar rutas cliente en un helper compartido.
- Crear componentes reutilizables para:
  - volver al dashboard
  - tarjetas resumen clickeables
- consolidar header de página para breadcrumb + título + subtítulo + acciones
- Hacer que dashboard y jobs compartan filtros reales por estado.
- Convertir el resumen del detalle del trabajo en cuatro puntos interactivos con anclas reales.
- Endurecer `payments` para aceptar navegación contextual desde dashboard.
- Refinar `jobs/new` usando su propio patrón como estándar:
  - stepper clickeable
  - resumen de paso
  - radar lateral de proyecto
  - CTA de cancelación clara

## 3. Implementación

### Archivos nuevos
- `apps/web/app/lib/client-routes.ts`
- `apps/web/app/components/client/ClientDashboardBackLink.tsx`
- `apps/web/app/components/client/ClientSummaryCardLink.tsx`
- `apps/web/app/components/client/ClientBreadcrumbs.tsx`
- `apps/web/app/components/client/ClientDetailDrawer.tsx`
- `apps/web/app/components/client/ClientPageHeader.tsx`
- `apps/web/app/api/semse/ratings/route.ts`
- `apps/web/app/(app)/client/disputes/page.tsx`

### Archivos modificados
- `apps/web/app/(app)/client/dashboard/page.tsx`
- `apps/web/app/(app)/client/jobs/page.tsx`
- `apps/web/app/(app)/client/jobs/[jobId]/page.tsx`
- `apps/web/app/(app)/client/jobs/new/page.tsx`
- `apps/web/app/(app)/client/payments/page.tsx`
- `apps/web/app/(app)/client/milestones/page.tsx`
- `apps/web/app/(app)/client/documents/page.tsx`
- `apps/web/app/(app)/client/disputes/page.tsx`
- `apps/web/app/(app)/client/projects/page.tsx`
- `apps/web/app/(app)/client/projects/[projectId]/copilot/page.tsx`
- `apps/web/app/(app)/client/reviews/page.tsx`

### Cambios funcionales

#### Dashboard
- Tarjetas resumen ahora usan un wrapper reutilizable y son clickeables.
- Navegación de tarjetas:
  - `Trabajos activos` -> `/client/jobs?filter=active`
  - `Esperando propuestas` -> `/client/jobs?filter=pending`
  - `Completados` -> `/client/jobs?filter=completed`
  - `Presupuestos activos` -> `/client/payments?tab=escrow`
- `Trabajos recientes` mantiene:
  - item individual -> detalle del trabajo
  - `Ver todos` -> listado general
- Se corrigió el empty state roto del dashboard.

#### Listado de trabajos
- Filtros reales ampliados:
  - `all`
  - `active`
  - `pending`
  - `posted`
  - `review`
  - `completed`
- El título y copy del header cambia según el filtro activo.
- Los filtros y la búsqueda ahora sincronizan con la URL (`filter`, `q`).

#### Detalle del trabajo
- Nuevo bloque visible: `Resumen del proyecto`.
- Cuatro puntos interactivos con profundidad real:
  - presupuesto y escrow
  - milestones
  - evidencias
  - operación y agentes
- Cada punto ahora abre un panel lateral contextual con:
  - lectura operativa
  - métricas cortas
  - siguiente foco humano
  - CTA para abrir la vista general relacionada
  - CTA para saltar al bloque principal de la página
- El detalle ya no depende solo de anclas: ahora tiene una segunda capa de inspección operativa.
- El bloque de evidencias del detalle también quedó endurecido:
  - intenta resolver preview/descarga con múltiples llaves reales del payload
  - distingue entre acceso directo y acceso solo vía proyecto
  - ya no muestra evidencia como inventario pasivo; ahora tiene acciones útiles por archivo

#### Navegación global cliente
- Se unificó `Volver al dashboard` con componente compartido.
- Se aplicó en vistas clave del cliente.
- Se agregó una capa más sólida: breadcrumbs compartidos para contexto de navegación.
- Se agregó `ClientPageHeader` como pieza reusable para unificar:
  - breadcrumbs
  - título
  - subtítulo
  - CTA/acciones
- Ya se aplicó en:
  - dashboard
  - trabajos
  - detalle de trabajo
  - publicar trabajo
  - pagos
  - milestones
  - documentos
  - proyectos
  - copiloto de proyecto
  - reseñas
- Se hizo una pasada adicional de cableado fino para corregir CTAs ambiguos:
  - `Nuevo proyecto` que realmente abría `Publicar trabajo`
  - acción rápida del dashboard que decía `Mis proyectos` pero abría trabajos
  - CTA de `copiloto` en detalle de trabajo sin `projectId` garantizado
- El `copilot` se profundizó como superficie operativa:
  - ahora sincroniza `tab` y `q` en URL para soportar deep-links y contexto persistente
  - agrega una franja horizontal de accesos rápidos hacia pagos, hitos, documentos y búsqueda guiada
  - los resultados de búsqueda ya exponen una salida útil al área cliente correcta o a análisis contextual en chat
  - las acciones sugeridas del copiloto ahora ofrecen una segunda vía útil además de `Ejecutar acción`

#### Disputas
- Se abrió una vista cliente dedicada:
  - `/client/disputes`
- La pantalla ya no es solo informativa:
  - lista disputas reales desde backend
  - permite abrir una disputa nueva desde cliente sobre un trabajo elegible
  - permite marcar una disputa como resuelta desde el panel cliente cuando el backend lo permite
- La vista conecta disputa con contexto operativo:
  - proyecto
  - trabajo relacionado cuando se puede resolver
  - filtro por estado
  - filtro por proyecto
- Se integró a la navegación principal:
  - acción rápida nueva en dashboard para disputas abiertas
  - acceso directo desde el detalle del trabajo cuando el estado es `dispute`
  - `copilot` ahora ya no manda disputas solo al chat: puede abrir el panel dedicado de disputas del proyecto

#### Payments
- La pantalla ya respeta deep-link inicial de:
  - `tab`
  - `jobId`
- El dashboard ya puede abrir la vista de escrow con intención real.
- Los cambios de tab y proyecto ahora también se escriben de vuelta en querystring.
- Si el `jobId` no existe, la página se limpia y sigue operando.
- Readiness mantiene fallback cuando el endpoint no responde.

#### Reviews
- La vista ya no usa lista mock.
- Ahora consume ratings reales del actor vía BFF:
  - `GET /api/semse/ratings`
- Se muestran reseñas reales tanto:
  - emitidas por el cliente
  - recibidas por el cliente
- La pantalla ahora tiene tabs operativos:
  - `Emitidas`
  - `Recibidas`
- Si no hay ratings, la pantalla degrada con empty state honesto.
- Se corrigió el ordenamiento por fecha:
  - ahora usa fecha cruda normalizada
  - ya no ordena sobre una fecha renderizada/formateada

#### Documents
- Se mantuvo sobre data real de evidencias.
- Se quitaron CTAs engañosos:
  - `Subir evidencia` falso se reemplazó por `Revisar hitos`
  - cuando un archivo no trae `url`, los botones ahora llevan al proyecto relacionado en vez de quedar como adorno roto
- Se agregaron métricas rápidas:
  - archivos totales
  - archivos con acceso directo
  - archivos validados
- Se endureció la lectura de enlaces reales:
  - ahora intenta resolver `url`, `previewUrl`, `downloadUrl`, `signedUrl`, `fileUrl` y variantes desde `metadata`
  - si no existe enlace directo, la UI muestra que el acceso es “Desde proyecto” en vez de fingir descarga directa
  - también expone `bucketKey`/`key` como rastro operativo corto cuando existe

#### Publicar trabajo
- El wizard sigue con 4 pasos, pero ahora:
  - el stepper es clickeable para pasos ya habilitados
  - cada paso muestra encabezado y contexto propio
  - hay un radar lateral corto con categoría, referencia de presupuesto y ventana estimada de propuestas
  - el primer paso tiene `Cancelar` claro al dashboard
  - se agregó `Ver mis trabajos` en header
  - categorías muestran mejor organización con número de especialidades

## 4. Validación

### Compilación
- `./node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json` ✅

### Revisión funcional validada por código
- No quedaron imports rotos en los archivos tocados.
- Las rutas nuevas/corregidas son consistentes con `client-routes.ts`.
- El dashboard ya abre vistas filtradas útiles.
- El detalle del trabajo ya tiene resumen clickeable con data real.
- El detalle del trabajo ahora tiene drawers operativos por contexto.
- `payments` ya puede abrirse contextualizado desde el dashboard.
- `reviews` ya usa ratings reales y dejó de depender de demo local.
- `reviews` ya permite leer ambos lados del historial relacional, no solo una mitad.
- `documents` ya usa acciones honestas según el dato disponible.
- `documents` ya soporta mejor payloads reales heterogéneos del backend para preview y descarga.
- `job detail` ya comparte esa misma lógica de evidencia resuelta, no solo la página de documentos.
- `Publicar trabajo` conserva el patrón visual y gana navegación más clara.
- La navegación cliente ya no depende solo de back-links sueltos; ahora tiene breadcrumbs compartidos y consistentes.
- Los headers cliente ya no están duplicados ni divergentes entre páginas: comparten la misma pieza base y mismo patrón visual.
- `dashboard` y `copilot` ya usan ese mismo patrón, así que el área cliente quedó mucho más uniforme incluso en sus superficies principales.
- Los CTAs principales del cliente ya quedaron más honestos respecto a su destino real; se redujo navegación engañosa por copy impreciso.
- `copilot` ya no funciona solo como consola conversacional; ahora conecta mejor análisis, búsqueda y operación.
- `disputes` dejó de ser un hueco funcional del área cliente: ahora tiene superficie propia y conectada.
- `disputes` ahora también tiene workspace operativo real:
  - selección de disputa activa
  - propuesta de resolución editable
  - criterio del copiloto para decidir si las partes todavía pueden resolverlo por sí solas
  - escalación asistida a tercero humano cuando el copiloto detecta fricción persistente
  - preparación de paquete de evidencia con planificación de subida y ruta multipart cuando aplica
  - lectura de aprobaciones humanas pendientes asociadas, para no dejar la escalación en caja negra
  - lectura de evidencia contextual existente del trabajo vinculado
  - registro rápido de referencia de evidencia desde el propio panel:
    - key/url/referencia
    - tipo de evidencia
    - milestone opcional
  - accesos directos a preview/respaldo cuando el payload ya trae enlaces válidos
  - traza de decisión visible dentro del workspace:
    - estado base de la disputa
    - recomendaciones del copiloto
    - solicitud de escalación
    - approval asociada cuando existe
- se corrigió infraestructura web faltante para approvals del copiloto:
  - `GET /api/semse/agents/approvals`
  - `GET /api/semse/agents/approvals/:approvalId`
- `DisputeResolutionWorkspace` ahora acepta `audience="admin"` con:
  - playbook de tercero con instrucciones de lectura antes de decidir
  - panel de aprobaciones pendientes accionables (aprobar/rechazar sin salir del workspace)
  - traza enriquecida que registra cada decisión del tercero
  - prop `onApprovalDecide` para que la página padre pueda inyectar lógica extra post-decisión
- comentarios por disputa — panel "Argumentos y acuerdos" en workspace:
  - BFF: `GET /api/semse/disputes/:id/comments` y `POST /api/semse/disputes/:id/comments`
  - helpers `fetchDisputeComments` y `addDisputeComment` en semse-api
  - feed cronológico con color por rol (cliente/profesional/ops/sistema)
  - textarea con envío por botón o Ctrl+Enter
  - cada comentario enviado queda también en la traza de decisión
  - mensaje contextual varía según rol: ops ve instrucción distinta a partes
- `admin/disputes/page.tsx` conectado al workspace compartido:
  - botón "Abrir workspace" en cada tarjeta de disputa
  - columna lateral sticky con `DisputeResolutionWorkspace` audience=admin
  - panel original de resolución rápida sigue disponible cuando el workspace no está activo
  - cierre de circuito: admin puede ver evidencia, traza del copiloto y decidir approvals desde la misma pantalla
- el área profesional ya tiene superficie equivalente en:
  - `/worker/disputes`
  - con el mismo workspace de análisis, evidencia y escalación
  - pero respetando permisos reales: el profesional no cierra directamente la disputa
- el dashboard y el detalle del profesional ya enlazan al panel de disputas, así que el flujo dejó de depender de navegación improvisada.

## 5. Pendientes sanos

- Si luego se quiere cerrar el loop fino de producto:
  - extender `documents` para soportar subida directa del cliente si negocio lo requiere
  - si backend expone `jobId` dentro del contexto de proyecto, cerrar el último tramo de precisión y enviar desde `copilot` a pagos, hitos y detalle del trabajo ya filtrados por trabajo, no solo a la vista general
- `JobDisputeHistory` — nuevo componente compartido en `components/disputes/`:
  - inyectado en `/client/jobs/[jobId]` y `/worker/jobs/[jobId]`
  - carga disputas del trabajo y muestra estado, razón, resolución, conteo de argumentos
  - borde rojo cuando hay disputas activas, verde cuando todas resueltas
  - link directo al panel de disputas correspondiente por audiencia
- cierre de bucle financiero en `admin/disputes`:
  - al resolver, se genera auto-comment "Sistema · Finanzas" con instrucción de pago según el tipo de resolución (a favor del profesional / cliente / parcial / legal)
  - cuando disputa resuelta en workspace, aparece CTA "Confirmar en Pagos" que lleva a `/admin/finance`
  - `handleResolve` ahora usa `workspaceDisputeId` cuando está activo, no solo `selected`
- en `disputes`, el siguiente paso fuerte ya no es abrir la superficie sino cerrar el circuito:
    - adjuntar evidencia contextual real desde el propio panel
    - mostrar aprobaciones/decisiones pendientes cuando el copiloto solicite tercero
    - dejar trazabilidad visible de quién pidió escalación, por qué y qué recomendó el copiloto
- `admin/disputes` tiene ahora priorización operativa real:
  - filtro "Approval pendiente" con contador (correlaciona approvals del copiloto con disputa)
  - filtro "Con argumentos" para disputas con comentarios activos
  - badge amarillo "APPROVAL PENDIENTE" visible en cada tarjeta cuando aplica
  - contador de comentarios (ícono + número) en cada tarjeta
  - KPI "Approval pendiente" en el header con el total global
  - auto-comment de sistema al decidir una approval: las partes ven "Ops aprobó/rechazó" sin entrar a ops
