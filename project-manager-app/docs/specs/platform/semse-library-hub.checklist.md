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

## Verificación estática de documentación (sin CI ni ejecución del proyecto)

- [x] Ambos archivos `*.snapshot.json` se pudieron interpretar como JSON.
- [x] Los snapshots contienen 7 apps + 13 paquetes de primer nivel y 8 requisitos de `vision-service`.
- [x] Recuento independiente sobre los snapshots: 213 `dependencies`, 61 `devDependencies`, 2 `peerDependencies`, 210 nombres únicos, 29 con múltiples declaraciones y 7 con rangos textuales diferentes.
- [x] El informe `semse-library-hub.direct-reconciliation.md` concuerda con los contadores.
- [x] El PR #1048, comprobado al final de esta revisión, sólo contiene rutas bajo `project-manager-app/docs/` (10 archivos).
- [x] El SDD sigue en `DRAFT`, no `APPROVED`, y no se modificó runtime.
- [ ] **Pendiente:** `pnpm spec:validate:strict`, `pnpm spec:index`, tests/CI, revisión de licencia/CVE, comparación con lockfile y aprobación técnica del SDD. No se infiere PASS de esta inspección documental.
