---
type: checklist
feature: "document-sharing-grants"
spec: "docs/specs/prometeo/document-sharing-grants.spec.md"
version: "2.0"
date: "2026-10-18"
---

# Checklist: Prometeo grants P0 — REVIEW

## Resultado de análisis spec ↔ plan ↔ tareas ↔ constitución (2026-10-18)

- Hallazgo **BLOCKING**: spec REVIEW y ADR PROPOSED, código ya implementado en rama; **no se justifica merge/activación** hasta aprobación independiente.
- Hallazgo **BLOCKING**: no se ha ejecutado aceptación en staging dedicado, inventario de datos históricos ni rollback.
- Hallazgo **BLOCKING**: falta comprobar CI terminal del HEAD documental actual, además de resolver revisión SDD/ADR.
- Hallazgo **OPEN**: la migración introduce `UNIQUE(id,tenantId,projectId)` y FK `ON UPDATE RESTRICT`; plan explicita compatibilidad mixta, forward-fix y no realizar down-migration automática.
- Cubierto documentalmente: actor → ResourceScope → grant activo exacto → SQL → RAG/citas; auditoría transaccional; eventos catalogados; local-only y degradación FTS.
- Alcance fuera de la aprobación: `public_training` heredado, conocimiento promovido (#992), staging/producción y nuevos modelos externos.

## Requisitos y seguridad
- [x] Escenarios cross-org, cross-tenant, proyecto, job eliminado y bypass de hilos especificados.
- [x] Contratos HTTP, agente, fallback y códigos de error descritos.
- [ ] Aprobación humana independiente de owner/security.
- [ ] Prueba contra proveedor externo capturando cero egress con datos privados.
- [ ] Revisar step-up/consentimiento explícito antes de activar UI.

## Datos y eventos
- [x] Plan de migración y rollback/forward-fix escrito.
- [x] Acciones de AuditLog catalogadas y grant revocable descrito.
- [ ] Validar índices/constraints y migración con datos históricos representativos en staging.
- [ ] Ejecutar rollback de aplicación con DB expandida sin eliminar auditoría.
- [ ] No permitir publicación de documentos ni consentimiento inferido.

## Entrega
- [ ] Todos los checks terminales green sobre HEAD de esta documentación.
- [ ] Revisión de seguridad externa e incidencias/threads resueltas formalmente.
- [ ] Staging aislado y canary con sesiones reales sintéticas.
- [ ] Evidence/Payment Governance y rutas de agente comprobadas.

## Documentación
- [x] Nuevo spec vinculado al plan, tareas, checklist y ADR propuesta.
- [x] Contratos API/eventos y políticas que pertenecen al slice identificados.
- [ ] Spec cambia a APPROVED **solo** con firma/aprobación de autoridad.
- [ ] `production_evidence` se completa únicamente tras un despliegue auténtico.
