---
type: checklist
feature: "semse-library-hub"
spec: "docs/specs/platform/semse-library-hub.spec.md"
version: "2.0"
date: "2026-10-25"
---

# Checklist de auditoría, gobernanza y futura habilitación

## Requisitos y alcance
- [x] Es infraestructura común, no librería exclusiva de Prometeo.
- [x] Sin servicio nuevo en Railway; las capacidades especiales son bajo demanda.
- [x] Solo se eligen librerías/capacidades necesarias y aprobadas.
- [x] No se mezclan Biblioteca Técnica/RAG, Tool Registry, catálogo de paquetes y Capability Registry.
- [ ] Ratificar contratos finales API/UI/roles antes de implementar.

## Seguridad y licencias
- [ ] Permisos y scope tenant/org/resource demostrados en tests de ejecución.
- [ ] Código de paquetes arbitrarios / hot install bloqueado en test adversarial.
- [ ] SBOM completo, advisories, hashes y licencias verificadas.
- [ ] Aprobación independiente en dependencias de riesgo elevado.
- [x] Diseño exige revocación inmediata por incidente y revisión trimestral.
- [x] No crear copia vendorizada de paquetes sin evaluación de licencia y costo.

## Recursos y rentabilidad
- [x] Costo de licencia, runtime, integración, mantenimiento y riesgo separados.
- [ ] Medir baseline incremental CPU/RAM en Railway/entorno autorizado.
- [ ] Medir concurrencia/timeout/cleanup/abort y failure isolation en Worker.
- [ ] Medir valor del piloto real y registrar si ROI neto es favorable.
- [ ] Probar ausencia de saturación en flujos de pagos, Evidence y jobs.

## Datos y eventos
- [x] F0 documental sin Prisma/migración.
- [ ] F2: decidir persistencia y estados; migración reversible si aplica.
- [ ] F2: agregar eventos/auditoría al catálogo sólo si se implementan.
- [ ] F3: idempotencia y reintento sin doble efecto o consumo.

## Entrega
- [x] Inventario preliminar de manifiestos con SHA y límites.
- [x] Plan por slices y ADR registrados.
- [ ] SDD pase de DRAFT a APPROVED mediante revisión.
- [ ] `pnpm spec:index` y `pnpm spec:validate:strict` verificados (CI último).
- [ ] Tests, build/typecheck/lint del primer slice ejecutable.
- [ ] CI terminal, merge SHA, deployment y activación separados.
- [ ] Smoke autenticado real y evidencia, jamás inferir de health 200.
- [ ] Nota final de auditoría actualizará estado sin inventar cobertura.
