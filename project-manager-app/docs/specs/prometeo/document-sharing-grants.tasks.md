---
type: tasks
feature: "document-sharing-grants"
domain: "prometeo"
plan: "docs/specs/prometeo/document-sharing-grants.plan.md"
version: "2.0"
status: "PENDING"
branch: "integration/p0-prometeo-main-reconcile-20261017"
date: "2026-10-18"
---

# Tareas: Prometeo Document Sharing Grants

> El spec rector está **REVIEW**. Las casillas de código indican artefactos presentes en rama, no autorización, merge, deploy ni verificación productiva.

## Fase 0 — Gobernanza
- [x] [T-001] Spec SDD 2.0 registrado en índice con status REVIEW.
- [x] [T-002] Documentar plan, análisis de brechas y checklist.
- [ ] [T-003] Obtener aprobación del dueño + revisor de seguridad de contrato y composite FK; entonces actualizar spec e índice (no autoaprobar).
- [ ] [T-004] Obtener decisión formal del ADR-046 y resolver compatibilidad con ADR-040/ResourceScope.

## Fase 1 — Tests/contratos
- [x] [T-010] Tests de tenant/org/proyecto, grants concurrentes, auditoría transaccional, revocación, delete y FK.
- [x] [T-011] Firmar sesiones sintéticas HTTP sobre Postgres en CI.
- [ ] [T-012] Validar mismo HEAD contra Ollama local real, proveedor cloud bloqueado y 20k proyectos; no sustituir por mocks.
- [ ] [T-013] Verificar que pruebas de fallback de Copilot y embeddings privados pasan en CI final.

## Fase 2 — Datos
- [x] [T-020] Modelo Prisma y migración aditiva con FK compuesta incluidos en PR #987.
- [x] [T-021] Consulta grant relacional acotada, no OR lineal por proyecto.
- [ ] [T-022] Auditar el índice `UNIQUE(id,tenantId,projectId)` en copia staging; migraciones y checksums.
- [ ] [T-023] Ensayar rollback de app sin down-migration destructiva y forward-fix en caso de FK legacy.
- [ ] [T-024] Inventario de `public_training` y consentimiento en issue #992.

## Fase 3 — API/Agentes
- [x] [T-030] Rutas de grant/revoke con autorización, auditoría e idempotencia incluidas en rama.
- [x] [T-031] Fail-closed de Project Copilot, hilos por tenant/usuario/proyecto, RAG live job, local-only embeddings.
- [x] [T-032] API Surface y owning specs deben registrar contratos, eventos y rutas (pendiente de verificación tras commit documental).
- [ ] [T-033] UX de compartición explícita y revocación aprobada; no exponer biblioteca pública por defaults históricos.

## Fase 4 — CI / revisión
- [ ] [T-040] `pnpm spec:validate:strict` y `pnpm spec:index --check` terminales en HEAD con docs.
- [ ] [T-041] TS/lint, cobertura, tests DB/HTTP, E2E todos PASS del mismo SHA.
- [ ] [T-042] Auditoría humana independiente con comentarios resueltos; no basta Codex automático.
- [ ] [T-043] Confirmar no exposición cross-org/tenant, egress privado o historia de otro proyecto.

## Fase 5 — Release
- [ ] [T-050] Staging aislado independiente de T008, con secretos/DB/almacenamiento separados.
- [ ] [T-051] Canary autenticado, métricas, comparación y rollback ensayado.
- [ ] [T-052] Aprobar spec/ADR, merge y migración en orden controlado con SHA/provenance.
- [ ] [T-053] Activación gradual, smoke productivo sin datos reales expuestos, registro de evidencia.

## Criterio de Done
- [ ] Spec APPROVED por autoridad independiente; ADR Accepted.
- [ ] CI+Postgres+E2E terminales sobre SHA exacto.
- [ ] Staging/reversión y decisión de datos heredados firmadas.
- [ ] Merge, deploy, migración y activación con evidencia distinta.
