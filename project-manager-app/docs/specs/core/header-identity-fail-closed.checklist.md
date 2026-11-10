---
type: checklist
feature: "Identidad por cabeceras sólo con opt-in explícito"
spec: "docs/specs/core/header-identity-fail-closed.spec.md"
version: "2.0"
date: "2026-11-04"
---

# Checklist: Identidad por cabeceras sólo con opt-in explícito

## Requisitos

- [x] Cada escenario P1 es verificable (AC-HI-01 a 11)
- [x] Scope y no-objetivos evitan ambigüedad (§2 del spec)
- [x] Contratos API y configuración no se contradicen

## Seguridad

- [ ] Permisos se validan en backend (sin cambios; verificar con tests)
- [ ] Tenant scope probado en OI con bearer válido y cabecera de otro tenant
- [x] Step-up/aprobación: no aplica
- [ ] Sin secretos ni identidades en el log de arranque (revisar diff)

## Datos y eventos

- [x] Migración: no aplica
- [x] Rollback: revertir PR
- [x] Outbox/consumers: no aplica

## Evidencia y dinero

- [x] No aplica

## Entrega

- [ ] Tests, build, typecheck y lint pasan
- [ ] CI, merge, deploy y activación con evidencia separada
- [x] Healthcheck no sustituye smoke funcional (smoke OI exigido en §8 del spec)
- [x] Rollback definido
- [x] `production_evidence` sin secretos (vacío hasta deploy autorizado)

## Documentación

- [ ] Spec index regenerado
- [ ] `docs/auth.md` y `.env.example` actualizados
- [x] Investigación externa y decisión registradas
