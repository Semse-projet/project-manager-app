# Tareas — Consolidación Semse Agro

| ID | Tarea | Estado | Evidencia |
|---|---|---|---|
| T-000 | Auditoría AS-IS, gap matrix, arquitectura y plan de migración | ✅ | AGRO_AS_IS_AUDIT_2026-09-25.md |
| T-001 | Fix R1–R4 (tipos de tarea/unidad; rutas Prometeo) | ✅ | commit `fix(agro): …R1–R4` |
| T-002 | Tests de política y RBAC antes de los servicios | ✅ | agro-farm-policy.test.ts |
| T-010 | Schema + migración aditiva + seed de la taxonomía | ✅ | migrate deploy local + diff sin drift |
| T-011 | AgroFarmAccessService + política de finca | ✅ | 12 tests |
| T-012 | Workforce: catálogo, miembros, oficios, capacidades, verificación, revocación | ✅ | 26 tests |
| T-020 | IncidentOps: FSM, severidad, relaciones, asignación, tareas, comentarios, evidencia | ✅ | 20 tests |
| T-021 | E2E HTTP con Postgres real (10 pasos) | ✅ | agro-workforce-incidents-integration.test.ts |
| T-030 | Prometeo intake + tools | ✅ | 11 tests |
| T-040 | UI Incident Center / detalle / reporte móvil | ✅ | Playwright 390px |
| T-041 | UI Workforce (matriz + perfil + verificación) | ✅ | Playwright 390px |
| T-050 | Membresía en servicios existentes (finca, tareas, animales, evidencia, inventario, dashboard, sync) | ✅ | agro-membership-operations-integration.test.ts + Playwright |
| T-056 | MANAGER accede a datos económicos (`farm.finance`: costos, ventas, rentabilidad, reporte semanal) | ✅ | agro-membership-operations-integration.test.ts |
| T-057 | Pestañas de la finca según el rol (`viewerActions` del API + `useFarmTabs` en la web) | ✅ | agro-farm-policy.test.ts + integración + Playwright |
| T-051 | Tenant de la finca + espejo AgroFarmTask → JobTask(domain=agro) + backfill (spec `agro-task-jobtask-convergence.spec.md`) | ✅ | agro-jobtask-mirror-integration.test.ts |
| T-058a | Asignar tenant a una finca que quedó sin él (`POST farms/:farmId/tenant`, solo propietario, solo al tenant de su sesión) | ✅ | agro-jobtask-mirror-integration.test.ts |
| T-058b | Conectar Agro a "mis tareas" entre dominios (`GET /v1/tasks`, permiso nuevo `tasks:read:self`); el cambio de lecturas de Agro a JobTask no procede aún (spec §3ter) | ✅ | agro-jobtask-mirror-integration.test.ts + domain-rbac-permissions.test.ts + agro-farm-policy.test.ts |
| T-052 | Eventos `agro.*` en EVENT_CATALOG + outbox | ⏳ | requiere aprobación de catálogo |
| T-053 | Subida binaria de evidencia Agro (flujo presignado, spec `agro-evidence-upload.spec.md`) | ✅ | verificación manual (presign→PUT→registro→descarga) |
| T-054 | ASR/visión para el intake (privacyCritical → Ollama/vision-service) | ⏳ | |
| T-055 | Pantallas Agro en apps/mobile (hoy el reporte es web responsive) | ⏳ | |
