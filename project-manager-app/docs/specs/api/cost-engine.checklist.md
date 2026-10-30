---
type: checklist
feature: "Motor de costos unificado"
spec: "docs/specs/api/cost-engine.spec.md"
version: "2.0"
date: "2026-10-30"
---

# Checklist: Motor de costos unificado

## Requisitos

- [x] Cada escenario P1–P5 es verificable
- [x] Scope y no-objetivos evitan ambigüedad
- [ ] Preguntas abiertas Q1–Q9 resueltas (bloquea `APPROVED`)
- [ ] API/UI contracts no se contradicen (revisar tras Q1, Q4 y Q6)

## Seguridad

- [ ] Permisos por capa se validan en backend
- [ ] `platformFeeRate` e `taxRate` no se pueden escribir desde capas inferiores
- [ ] Contratista y organización no leen ni escriben datos de otros tenants u organizaciones
- [ ] Los márgenes del contratista no se exponen al cliente
- [ ] Límites, motivo ≥ 10 caracteres y auditoría en todo cambio
- [ ] No hay secretos ni PII en logs/evidencia

## Datos y eventos

- [ ] Migración aditiva y reproducible (fase 3)
- [ ] Rollback definido: apagar flags y borrar filas
- [ ] Sin eventos de dominio nuevos; `AuditLog` con before/after
- [ ] Los estimados guardados no cambian al leerse

## Evidencia y dinero

- [ ] Cambios de comisión e impuesto no alteran contratos, hitos ni escrow existentes
- [ ] Aprobación reforzada para parámetros con impacto en pagos
- [ ] El recalculo externo de márgenes reproduce cada motor (tests golden)

## Entrega

- [ ] Tests, build, typecheck y lint pasan
- [ ] CI, merge, deploy y activación tienen evidencia separada
- [ ] Modo sombra con informe revisado antes de activar
- [ ] El healthcheck no sustituye el smoke funcional en Chrome
- [ ] `production_evidence` no contiene secretos

## Documentación

- [ ] Spec index regenerado (`pnpm spec:index`)
- [ ] API surface actualizada con `/v1/pricing/cost-parameters`
- [ ] ADR de las decisiones clave
- [ ] Investigación externa y decisiones registradas
