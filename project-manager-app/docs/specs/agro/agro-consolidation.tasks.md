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
| T-050 | Membresía en servicios existentes (tareas/animales/evidencia) | ⏳ | siguiente PR |
| T-051 | Dual-write AgroFarmTask → JobTask(domain=agro) + backfill | ⏳ | plan §7.3 del AS-IS |
| T-052 | Eventos `agro.*` en EVENT_CATALOG + outbox | ⏳ | requiere aprobación de catálogo |
| T-053 | Subida binaria de evidencia Agro (flujo presignado) | ⏳ | |
| T-054 | ASR/visión para el intake (privacyCritical → Ollama/vision-service) | ⏳ | |
| T-055 | Pantallas Agro en apps/mobile (hoy el reporte es web responsive) | ⏳ | |
