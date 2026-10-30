---
type: checklist
feature: "Smart Intake — Tarifas regionales y rango de estimado"
spec: "docs/specs/api/smart-intake-regional-rates.spec.md"
version: "2.0"
date: "2026-10-30"
---

# Checklist: Smart Intake — Tarifas regionales y rango de estimado

## Requisitos

- [x] Cada escenario P1–P4 es verificable (hay umbrales numéricos y estados esperados)
- [x] Scope y no-objetivos evitan ambigüedad
- [ ] Preguntas abiertas Q1–Q4 resueltas (bloquea `APPROVED`)
- [ ] API/UI contracts no se contradicen (revisar tras Q2)

## Seguridad

- [ ] Permisos se validan en backend (`pricing:location:manage` solo `OPS_ADMIN`)
- [ ] Un cliente anónimo o autenticado no puede leer ni escribir overrides
- [ ] Multiplicadores acotados a [0.5, 2.0] y motivo obligatorio
- [ ] El intake público no hace llamadas de red a BLS
- [ ] No hay secretos ni PII en logs/evidencia (no se loguea `city` completa)

## Datos y eventos

- [ ] Migración aditiva y reproducible (solo fase C)
- [ ] Rollback definido: apagar flag y borrar filas
- [ ] El refresh de OEWS no pisa una anulación manual
- [ ] Sin eventos de dominio nuevos; `AuditLog` con before/after

## Evidencia y dinero

- [x] El estimado es informativo: no mueve ni retiene dinero
- [ ] Etiqueta de confianza coherente con el ancho del rango
- [ ] Los supuestos declaran región, fuente y uso de tarifa nacional

## Entrega

- [ ] Tests, build, typecheck y lint pasan
- [ ] CI, merge, deploy y activación tienen evidencia separada
- [ ] Healthcheck no sustituye el smoke funcional en Chrome
- [ ] Canary con tres estados y métricas definidos
- [ ] `production_evidence` no contiene secretos

## Documentación

- [ ] Spec index regenerado (`pnpm spec:index`)
- [ ] API surface actualizada con `/v1/pricing/location-costs`
- [ ] Investigación externa y decisiones registradas (plan §9)
