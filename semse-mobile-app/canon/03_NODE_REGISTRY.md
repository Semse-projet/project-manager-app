# SEMSE Mobile Node Registry

## Nodos canonicamente esenciales

### N01 `mobile_shell`

- proposito: renderizar navegacion, layout, encabezado y shells base
- codigo: `src/components/AppLayout.tsx`, `AppHeader.tsx`, `BottomNav.tsx`, `ClientBottomNav.tsx`

### N02 `worker_operations_surface`

- proposito: trabajo diario del profesional y operacion de campo
- superficies: jobs, evidence, tasks, materials, incidents, tracker, travel, payments, disputes

### N03 `client_operations_surface`

- proposito: publicacion, seguimiento y control de proyectos por cliente
- superficies: publish, proposals, project, milestones, documents, payments, disputes, reviews

### N04 `dev_control_surface`

- proposito: exploracion tecnica, ops, docs y diagnostico
- superficies: apis, docs, environments, logs, cicd, agents, testing, incidents

### N05 `mobile_auth_identity`

- proposito: identidad local, sesion, rol activo y permisos visibles
- destino tecnico: `src/lib/auth/`, `packages/auth`, `apps/api/src/modules/auth`

### N06 `mobile_api_gateway`

- proposito: conectar la app a BFF/API canonica
- destino tecnico: `src/lib/api/`

### N07 `agentic_mobile_bridge`

- proposito: enlazar acciones inteligentes, copiloto y recomendaciones con guardrails
- destino tecnico: `src/lib/agentic/`

### N08 `organizational_memory_bridge`

- proposito: acceso controlado a memoria de workspace, semantic search y RAG
- destino tecnico: `src/lib/memory/`, `src/lib/rag/`

### N09 `observability_feedback`

- proposito: eventos de producto, trazas, metricas, feedback y mejora continua
- destino tecnico: `src/lib/observability/`, `src/lib/metrics/`, `src/lib/improvement/`

### N10 `ethical_guardrails`

- proposito: limites eticos, explicabilidad, aprobacion humana y politicas de uso
- destino tecnico: `src/lib/ethics/`, `src/lib/agentic/guardrails.ts`
