---
type: checklist
feature: "Admin Integration Trust Status"
spec: "docs/specs/platform/admin-integration-trust-status.spec.md"
version: "2.0"
date: "2026-09-25"
---

# Checklist: Admin Integration Trust Status

## Requisitos y seguridad

- [x] Los cinco estados son mutuamente distinguibles.
- [x] Permisos backend y tenant están definidos.
- [x] Las respuestas excluyen secretos y cuerpos externos.
- [x] `PUT /v1/admin/settings` no puede sobrescribir ni fabricar `integrations.checks`.
- [x] Los probes son lecturas con timeout.

## Datos y entrega

- [x] Sin migración; JSON compatible hacia atrás.
- [ ] Tests, builds y spec tooling pasan.
- [ ] CI, merge, deploy y activación tienen evidencia separada.
- [ ] Smoke autenticado confirma UI y endpoints.

## Rollback

- [x] Revertir código no requiere borrar datos.
- [x] Fuga de secreto o efecto externo inesperado obliga rollback.
