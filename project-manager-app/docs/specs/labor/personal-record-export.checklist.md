---
type: checklist
feature: "personal-record-export"
spec: "docs/specs/labor/personal-record-export.spec.md"
version: "2.0"
date: "2026-10-24"
---

# Checklist F1 — Propiedad individual, integridad de exportación y no filtración

## Diseño

- [x] Contrato DRAFT, código NOT_STARTED, CI NOT_RUN y activación INACTIVE.
- [x] Separados F1A (histórico actual) y F1B (continuidad sin Org/cross-tenant).
- [x] Referencias EPIC #935/S1 #933; TimeEntry canónico.
- [x] Diagnóstico estático `limit:500`, CSV visible e índices / campos del modelo.
- [ ] Owner aprueba F1A explícitamente sin afirmar F1B completado.
- [ ] Decisiones Identity/Security/Privacy sobre continuidad y derechos de terceros.

## Auth y datos

- [ ] Usuario A solo sus registros, B mismo tenant y C otro tenant denegados.
- [ ] Actor no elige `tenantId` ni `createdBy` en export.
- [ ] Usuario sin compañía en SEMSE puede crear/recuperar propios records (prueba real).
- [ ] Tras suspensión, personal record no es visible al patrón anterior ni al nuevo por defecto.
- [ ] `OPS_ADMIN` no se salta propiedad personal implícitamente.
- [ ] Logs, trazas, URLs y auditoría sin notas/ubicaciones/secretos.

## Exactitud, integridad y formato

- [ ] 1,201 entradas exportadas sin truncamiento o duplicación.
- [ ] Orden compuesto estable y snapshot/corte declarado con pruebas concurrentes.
- [ ] Periodos, ISO UTC, zona IANA, DST, turnos nocturnos y descansos exactos.
- [ ] CSV seguro para hojas de cálculo ante `= + - @`, tabs, espacios y Unicode.
- [ ] `pending_sync` identificado o excluido según tipo de exportación.
- [ ] Nombres históricos de FreeProject archivados, sin acceso a proyectos ajenos.
- [ ] CSV de vista diferenciada de exportación completa; un CSV no es backup ni firma.
- [ ] Sin fotografías, ubicaciones precisas, tarifas de terceros por defecto.

## Integración y entrega

- [ ] API/DTO/versiones y mensajes ES/EN no pierden contexto del formulario.
- [ ] No segundo cronómetro ni nueva autoridad de tenant.
- [ ] Actualización coordinada con #933; evitar dos sistemas de paginación.
- [ ] Pruebas negativas, revisión independiente, staging sintético y rollback.
- [ ] Al final: `pnpm spec:index`, `pnpm spec:validate:strict`, lint/typecheck/build y CI terminal.
- [ ] Merge, deploy, canary y activación requieren autorización y evidencia separadas.

**Actualmente:** especificación documental sin aprobación; no pruebas ni código de implementación.
