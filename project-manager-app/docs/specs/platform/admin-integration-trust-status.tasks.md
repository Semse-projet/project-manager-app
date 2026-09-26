---
type: tasks
feature: "Admin Integration Trust Status"
domain: "platform"
plan: "docs/specs/platform/admin-integration-trust-status.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "feat/admin-integration-trust-status"
date: "2026-09-25"
---

# Tareas: Admin Integration Trust Status

- [x] T-001 Crear y aprobar spec/plan/checklist.
- [x] T-010 Escribir tests de los cinco estados.
- [x] T-011 Ampliar schemas sin romper settings existentes.
- [x] T-020 Implementar servicio de estado y probes read-only.
- [x] T-030 Añadir endpoints API/BFF con RBAC.
- [x] T-031 Rehacer Integraciones para separar toggle y conexión.
- [x] T-032 Corregir documentación de la variable WhatsApp.
- [ ] T-040 Ejecutar tests, typecheck/build y spec strict.
- [ ] T-050 Revisar diff y abrir PR sin merge automático.
- [ ] T-060 Revisar variables Railway por nombre y desplegar solo tras CI.

## Criterio de Done

- [ ] Código y pruebas verdes.
- [ ] CI/merge/deploy/activación registrados separadamente.
- [ ] Ningún secreto aparece en UI, logs o evidencia.
