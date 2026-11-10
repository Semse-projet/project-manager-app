---
type: tasks
feature: "worker-independence-growth-program"
domain: "labor"
plan: "docs/specs/labor/worker-independence-growth-program.plan.md"
version: "2.0"
status: "PENDING"
branch: "docs/worker-independence-growth-20261024"
date: "2026-10-24"
---

# Tareas — Programa de independencia y crecimiento

## F0 — Contratos y privacidad (bloquea toda implementación)

- [x] [WPI-001] Inventariar contrato existente de Labor Engine, FreeProject, BO-05, BO-08, BO-12 e identidad (documentos de `main`, no runtime).
- [x] [WPI-002] Escribir propuesta de spec de programa y ADR, estado DRAFT/Proposed.
- [ ] [WPI-003] Revisar con owner, Security, Legal/Privacy y Architecture.
- [ ] [WPI-004] Censar APIs reales de exportación, evidencias/Media Library, signed URLs, grants y almacenamiento.
- [ ] [WPI-005] Resolver D-01..D-08: retención, fotos, grants, privacidad de compensación, firmas, oficios, pagos, exportación.
- [ ] [WPI-006] Ratificar ADR y registrar invariantes compatibles con FreeProject/TimeEntry.
- [ ] [WPI-007] Especificar slice F1 propio, aprobado e indexado.

## F1 — Registro y exportación personal

- [ ] [WPI-101] Escribir pruebas negativas A/B mismo tenant, C externo, User sin Org y OPS_ADMIN limitado.
- [ ] [WPI-102] Probar que `TimeEntry purpose=personal` jamás aparece en supervisor/admin/costos.
- [ ] [WPI-103] Definir exportación mínima segura, fuentes, paginación, timezone, correcciones y medios autorizados.
- [ ] [WPI-104] Implementar con Labor Engine/FreeProject canónicos; sin duplicar persistencia.
- [ ] [WPI-105] Tests offline/idempotencia, conversión, suspensión y revocación.

## F2 — Transparencia y acuerdos

- [ ] [WPI-201] Establecer compatibilidad y estado real de BO-05 sin reintroducir W-2/1099.
- [ ] [WPI-202] Definir términos, consentimiento, versiones, autoría y revisión humana en spec separada.
- [ ] [WPI-203] Comprobar que una oferta no crea firma legal, Membership ni acceso retroactivo.

## F3 — Pagos y desacuerdos

- [ ] [WPI-301] Definir orígenes y estados: declarado, aprobado, reportado, confirmado.
- [ ] [WPI-302] Integrar correcciones auditables BO-08 y mecanismo de discrepancias, sin ejecutar pagos.
- [ ] [WPI-303] Revisar overtime/retención Legal/Payroll antes de cualquier cálculo funcional.

## F4 — Credenciales y progreso

- [ ] [WPI-401] Reutilizar BO-12 sin badges automáticos ni niveles de competencia.
- [ ] [WPI-402] Investigación específica por oficio/licencia/jurisdicción.
- [ ] [WPI-403] Crear reglas opt-in para portafolio, validación de fuente y revisión de terceros.

## F5 — Cotización/contratos empresariales

- [ ] [WPI-501] Inventariar ProTools/Marketplace/BuildOps y flujos de contrato.
- [ ] [WPI-502] Definir cotizaciones por alcance, costos, seguros y licencias, con permisos existentes.

## Gates de entrega (CI al final)

- [ ] [WPI-901] Review independiente security/governance y SDD `analyze`.
- [ ] [WPI-902] Smoke autenticado ES/EN, A/B/cross-tenant y staging sintético.
- [ ] [WPI-903] Prueba de rollback sin perder originales.
- [ ] [WPI-904] `pnpm spec:index` + `pnpm spec:validate:strict` y regresión/build/typecheck.
- [ ] [WPI-905] PR revisado, CI terminal, merge autorizado separadamente.
- [ ] [WPI-906] Deployment/canary/activación solo con autorización y evidencia.

**Ningún checkbox de implementación significa que se haya desplegado producción.**