---
id: "ui.workspace-functional-hub"
title: "Workspace funcional integrado de SEMSE Project"
domain: "ui"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "medium"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "apps/web/app/workspace"
  - "apps/web/lib/stores/workspaceStore.ts"
related_tests:
  - "tests/unit/workspace-functional-model.test.ts"
  - "tests/unit/workspace-functional-shell.test.mjs"
  - "tests/unit/workspace-store-coordination.test.ts"
  - "tests/unit/workspace-bff-validation.test.ts"
  - "tests/unit/workspace-navigation-search.test.ts"
  - "tests/unit/workspace-projects-panel.test.ts"
  - "tests/unit/workspace-evidence-panel.test.ts"
  - "tests/unit/workspace-budget-panel.test.ts"
  - "tests/unit/workspace-planning-panel.test.ts"
  - "tests/unit/workspace-prometeo-access.test.mjs"
  - "tests/unit/workspace-session-query.test.ts"
related_endpoints: []
related_events: []
related_agents:
  - "prometeo"
last_verified: "NOT_VERIFIED"
privacyCritical: false
auditLog: false
sse: false
fsmTransicion: "none"
paymentGovernance: "unchanged"
---
# Spec: Workspace funcional integrado

## 1. Problema y resultado

El shell actual muestra secciones genéricas y referencias de misión, sin integrar los módulos operativos existentes. El usuario aprobó explícitamente los ocho resultados el 2026-11-14, en la sesión Manus de mejora del workspace; también confirmó el Blueprint correspondiente. Este spec formaliza exactamente ese alcance, sin aprobar programas DRAFT/REVIEW de otros dominios.

## 2. Alcance

Incluye inicio y referencias veraces, búsqueda de navegación, proyectos e hitos autorizados, evidencia real, presupuestos/propuestas, planificación de consulta, acceso al widget Prometeo existente y preferencias visuales/móvil. Es una ampliación UI sobre el shell IMPLEMENTED de `api-sense-workspace`; la nueva hidratación usa lecturas existentes de sus módulos propietarios, no modifica la API del shell.

Excluye pagos, autenticación, permisos, middleware, API, Prisma, pipelines, calendario persistido, ejecución/cancelación de misiones durables, otro chat, nuevas fórmulas económicas, aprobación de hitos, adjudicación de ofertas, sincronización de preferencias y persistencia de IDs de negocio en el navegador. Sin merge ni deploy a producción.

## 3. Actores, permisos y límites

CLIENT, PRO/WORKER y OPS_ADMIN usan sus sesiones existentes. `context.permissions` del shell son roles, no permisos efectivos: resolver el rol de presentación con el contrato existente, sin elevarlo. El registro de navegación solo limita presentación; la autorización real permanece en los BFF/API por tenant, org y recurso. Rol desconocido no muestra enlaces operativos ni lanza lecturas de negocio. No cambiar auth ni policy. Las consultas de dominio pueden aprovisionar contexto según su API existente; no ejecutarlas automáticamente al entrar al shell. Datos de presupuesto no se envían automáticamente a Prometeo. Ninguna lectura, referencia ni inferencia autoriza un cambio de negocio.

## 4. Escenarios y criterios

### P1 Inicio y referencias

Mostrar etiquetas españolas, referencia activa y acción para continuar. Validar título no vacío y máximo 200 caracteres. Abrir una referencia no crea Project ni ejecución durable; indicar explícitamente «Referencia de trabajo · sin ejecución vinculada». Descargarla solo cierra contexto. Esperar confirmación antes de limpiar formulario, conservarlo ante error, impedir envío repetido.

### P2 Navegación

Mantener seis secciones existentes; añadir búsqueda local de destinos activos del navigationRegistry permitidos al rol resuelto y etiquetas en español, sin inventar rutas ni exponer planned. El historial existente permite volver a secciones (máximo backend 20). Distinguir enlaces externos al shell de consultas embebidas. Estado UI no concede permisos.

### P3 Proyectos e hitos

Selector de proyectos obtenidos de BFF existente, búsqueda local y estado canónico. Distinguir Project.id, Project.jobId y BuildOpsProject.id/canonicalProjectId. Consultar hitos por endpoint existente del Project o por su Job autorizado; nunca enviar un filtro ignorado y mostrarlo como aplicado. Separar vacío, falta de acceso y error con reintento. Sin métricas de riesgo/avance fabricadas. Atajos cliente /client/projects y profesional /worker/jobs; no /pro/projects.

### P4 Evidencia

Abrir los flujos existentes que suben bytes reales y registran evidencia canónica. Filtros locales tipo/estado/hito sobre datos autorizados; incluir manual_review, errores de trabajos/hitos y fallos parciales por archivo. No presentar el formulario técnico que registra keys sin archivo como carga de usuario final. Ubicación declarada no es verificada. El recorrido 360 sigue exclusivamente local, sin registro automático ni ampliación de estaciones/multipart.

### P5 Presupuestos y propuestas

Accesos por rol a estimador/propuestas/estimados existentes. Cliente consulta ofertas recibidas del Job autorizado, no my-bids del profesional. Comparar importe, plazo, nota, estado y diferencia con rango real si existe; misma moneda o advertencia de incompatibilidad. Sin rango: mostrar indisponibilidad. No adjudicar ni alterar importes. Estimado preliminar UNVERIFIED/confianza heurística no es cotización verificada.

### P6 Planificación

Consultar tareas existentes, agrupar vencidas/próximas/sin fecha según dueDate y filtrar proyecto/estado/prioridad. Destacar blocked/urgent sin estados nuevos. Solo lectura: no editar, reprogramar, arrastrar con guardado ni crear calendario. Sin fechas inventadas para hitos y sin UUID de misión como projectId. Atajos a tareas/hitos/detalles reales.

### P7 Prometeo

Reutilizar exactamente el widget y sus flujos existentes desde el workspace, con acceso explícito en Inicio. No otro chat/backend. Mostrar disponibilidad/error/reintento de la infraestructura existente sin anunciar salud no comprobada. Aceptar sugerencia solo abre referencia y refresca store; no ejecuta negocio. Respetar permisos backend actuales. Si el contrato impide reutilizar, informar bloqueo sin simulación ni ampliación.

### P8 Configuración, concurrencia y móvil

Configurar abre `navigate('settings','configuration')`. Plegar paneles de escritorio, densidad cómoda/compacta y restaurar valores; persistir solo esos booleanos/enum visuales, sin IDs ni datos sensibles. Una sola capa móvil, contenedores limitados al viewport, foco inicial/trampa Tab/restauración de foco/Escape y scroll bloqueado de fondo, selección accesible y reduced-motion. Estado store/contexto coherente; requests serializadas o respuesta obsoleta ignorada, carga inicial/pending/refresh diferenciados. Al fallar conservar última vista confirmada y permitir reintento. Reset invalida responses en vuelo para evitar contaminación de otra sesión.

Excepción necesaria de seguridad de presentación: un 401 confirmado en cualquier lector del workspace o contexto Prometeo retira los datos privados y el contexto relacionado, invalida respuestas pendientes y conserva solo etiquetas de sección hasta confirmar la sesión de nuevo. Un 403 por recurso conserva las consultas independientes autorizadas. Clasificar por status HTTP estructurado con fallback para lectores heredados; no por una lista exclusiva de frases. Los IDs de controles accesibles son únicos por instancia, también cuando coexisten escritorio y diálogo. Esto no altera autenticación ni policy backend.

## 5. Contratos

Solo BFF y helpers existentes `/api/semse/workspace/**`, `/projects`, `/jobs/:jobId/milestones`, `/jobs/:jobId/evidence`, `/jobs/:jobId/bids`, `/buildops/tasks`, `/buildops/projects`, y widget Prometeo. Cada panel valida contexto/rol antes de pedir datos y descarta respuesta al cambiar selección/desmontar. IDs se codifican en URLs. Los errores 401/403 no se transforman en datos vacíos. No nuevos endpoints ni cambios de schema.

UI: idle, loading, refreshing, pending, ready, empty, forbidden, error/degraded. Los controles de negocio permanecen fuera de esta entrega. Preferencias validadas en lectura y escritura de almacenamiento; fallo de storage no bloquea el workspace.

## 6. FSM y eventos

Solo FSM existente del shell: none → loaded → none y operational/configuration. El contexto de presentación no es autoritativo de dominio. No nuevos eventos, SSE, outbox ni transiciones de Job/Project/Milestone/Payment/Dispute. Navegación no produce eventos de negocio según regla anti-ruido. Prometeo conserva su auditoría propia.

## 7. Datos y migración

Sin modelos Prisma, migración/backfill ni cambios de almacenamiento de negocio. Preferencias visuales locales sin PII. Rollback: revertir exclusivamente el commit frontend de esta rama; conservar backend y datos. No modificar migraciones históricas.

## 8. Observabilidad y entrega

Modo implementación con evidencia local; producción no consultada. PR borrador sin merge/deploy/activación. CI se registra por su resultado real y distinto de tests locales. Mantener `production_evidence: []` y `activation_status: INACTIVE`; no promover VERIFIED por build o existencia de componentes.

## 9. Tests requeridos

Pruebas de etiquetas/roles/nav activa, validación de referencias/preferencias, respuestas fuera de orden/reset/formulario conservado, separación de IDs, filtros de datos y estados de error. Contratos y UI estáticos más pruebas de funciones reales y store. Typecheck/lint/build frontend cuando el entorno permita resolver dependencias; registrar blockers preexistentes. No consultar ni escribir datos productivos.

## 10. Mapa de implementación

`apps/web/app/workspace/components` y `lib`: shell y paneles funcionales. `apps/web/lib/stores/workspaceStore.ts`: coordinación UI. Componentes Prometeo y páginas cliente/worker/BuildOps conservan ownership y solo reciben fixes necesarios aprobados. `tests/unit/workspace-*`: regresión. Spec/plan/tasks/checklist y reporte en docs; índice generado.

## 11. Investigación y análisis

Inspección del repositorio GitHub suministrado, HEAD 7029da63e719b264f7b2bfaff7eb4b716fe167b9; revisión independiente de las seis secciones. Sin nuevas búsquedas de proveedores ni servicios porque se reutiliza código existente. Drift conocido: spec del shell process-local frente a repositorio Prisma; no se altera ese backend. Copilot REVIEW no autoriza ampliar lógica del asistente; únicamente se reutiliza su montaje/contrato UI existente.

## 12. Gates de cierre

Spec aprobado por alcance explícito y Blueprint, plan/tasks/checklist consistentes, pruebas derivadas y diff acotado. Code COMPLETE solo cuando se implementen y revisen todos los resultados; CI/merge/deploy/activación pendientes por separado. No se solicita ni efectúa fusión/despliegue en esta tarea.
