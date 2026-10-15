---
type: checklist
feature: "Labor Engine — guard de ownership y destino en mutaciones de FreeProject (S0)"
spec: "docs/specs/labor/free-project-mutation-guard.spec.md"
version: "2.0"
date: "2026-10-15"
---

# Checklist: guard de ownership y destino en mutaciones de FreeProject (S0)

> Estado al abrir: spec en `DRAFT`. Las casillas marcadas reflejan sólo lo
> que el diseño ya define; ninguna afirma código, CI ni producción.

## Requisitos

- [x] Cada escenario P1 es verificable (spec §4, N1–N14 con código esperado)
- [x] Scope y no-objetivos evitan ambigüedad (spec §2; S1–S3 explícitamente fuera)
- [x] API/UI/agent contracts no se contradicen (PATCH documentado con su contrato manual real, sin afirmar que aplica el schema Zod; UI sin cambios; sin agente)
- [ ] Decisiones D1–D10 resueltas por el owner

## Seguridad

- [ ] Permisos se validan en backend — diseño listo; pendiente de código
- [ ] Tenant, org, ownership y resource scope están probados — tests definidos, no escritos
- [ ] Excepción de ownership por persona registrada en `DOMAIN_INVARIANTS.md` (D10)
- [ ] RBAC de las tres rutas cubierto por test de metadata (N13)
- [x] Step-up/aprobación: no aplica (acción personal sin dinero)
- [x] Los logs y el audit **nuevos** de S0 no llevan secretos ni PII (spec §8: sólo ids y códigos de razón)
- [ ] Log preexistente con la dirección completa en `google-maps.ts:98-100` cuando falla el geocoding de un PATCH/POST con `location` — fuera de S0, pendiente de D9
- [x] Posible exposición previa declarada: sin AuditLog previo no se puede atribuir (spec §7, D6)

## Datos y eventos

- [x] Migración: no aplica
- [x] Rollback: revert del PR, sin datos que deshacer
- [x] Estado + audit atómicos: AuditLog en la misma transacción que la mutación (D4); sin bus ni outbox
- [ ] Rollback de la transacción verificado contra PostgreSQL real, no sólo con stubs
- [ ] Acciones de AuditLog registradas en `EVENT_CATALOG.md` (si D4 aprobada)

## Evidencia y dinero

- [x] Evidencia no se confunde con aprobación automática: no aplica
- [x] Payment Governance: convertir no crea escrow/contrato/factura/membresía
- [x] Cálculos financieros: no aplica

## Entrega

- [ ] Tests, build, typecheck y lint pasan
- [ ] CI, merge, deploy y activación tienen evidencia separada
- [x] Healthcheck no sustituye smoke funcional (spec §8)
- [x] Canary, métricas y rollback están definidos (spec §8, plan §8)
- [ ] `production_evidence` no contiene secretos ni PII

## Documentación

- [x] Spec index regenerado
- [ ] API surface/event catalog actualizados si aplica (implementación)
- [x] Investigación externa y decisiones registradas (spec §11, §13)
