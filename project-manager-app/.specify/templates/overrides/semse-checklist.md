---
type: checklist
feature: "[FEATURE_NAME]"
spec: "docs/specs/[domain]/[feature].spec.md"
version: "2.0"
date: "[YYYY-MM-DD]"
---

# Checklist: [FEATURE_NAME]

## Requisitos

- [ ] Cada escenario P1 es verificable
- [ ] Scope y no-objetivos evitan ambigüedad
- [ ] API/UI/agent contracts no se contradicen

## Seguridad

- [ ] Permisos se validan en backend
- [ ] Tenant, org, ownership y resource scope están probados
- [ ] Step-up/aprobación existe para acciones críticas
- [ ] No hay secretos ni PII en logs/evidencia

## Datos y eventos

- [ ] Migración es reproducible y compatible
- [ ] Backfill, rollback o forward-fix están definidos
- [ ] Estado + outbox son atómicos cuando aplica
- [ ] Consumers son idempotentes y replayables

## Evidencia y dinero

- [ ] Evidencia no se confunde con aprobación automática
- [ ] Payment Governance bloquea releases incompatibles
- [ ] Cálculos financieros excluyen fallos/reversals

## Entrega

- [ ] Tests, build, typecheck y lint pasan
- [ ] CI, merge, deploy y activación tienen evidencia separada
- [ ] Healthcheck no sustituye smoke funcional
- [ ] Canary, métricas y rollback están definidos
- [ ] `production_evidence` no contiene secretos

## Documentación

- [ ] Spec index regenerado
- [ ] API surface/event catalog/matriz/roadmap actualizados si aplica
- [ ] Investigación externa y decisiones registradas
