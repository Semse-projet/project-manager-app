---
type: checklist
feature: "Decision Ledger"
spec: "docs/specs/prometeo/decision-ledger.spec.md"
version: "2.1"
date: "2026-11-06"
---

# Checklist: Decision Ledger

## Requisitos
- [ ] Escenarios P1 con Gherkin y trazados a pruebas (sección 9 del spec)
- [ ] Alcance claro: solo decisiones ya autorizadas; sin decisiones financieras en V1
- [ ] Q-1 a Q-9 resueltas por el owner

## Seguridad
- [ ] El ledger registra, no autoriza
- [ ] Autoridad, política y aprobación validadas contra tenant y organización
- [ ] Aislamiento por tenant y organización probado (2 × 2)
- [ ] Lectura autorizada contra el recurso del sujeto (sin IDOR)
- [ ] Catálogos cerrados de `subjectType`, `decisionKind` y `authorityType`
- [ ] `rationale` redactado, acotado y sin cuerpos de conversaciones
- [ ] Fuentes sin `tenantId` rechazadas
- [ ] Flag ausente o desconocido se trata como `off`

## Datos y eventos
- [ ] Migración aditiva, probada sobre una copia y autorizada
- [ ] Inmutabilidad garantizada por *trigger*, no solo por código
- [ ] Unicidad de idempotencia y de sucesor probadas bajo concurrencia
- [ ] Sin cascada destructiva hacia `Tenant`
- [ ] FSM en `STATE_MACHINES.md` y eventos en `EVENT_CATALOG.md` antes del código
- [ ] Referencias a H05 por `executionId`, sin copiar resúmenes
- [ ] Falla del registro dentro de la transacción del productor definida (Q-7)

## Usabilidad y operación
- [ ] Respuesta, paginación y catálogo de errores documentados
- [ ] Métricas con nombre, SLO y responsable aprobados
- [ ] Runbook de corrección y anulación
- [ ] `shadow` sin filas; `canary` con un tenant y un productor

## Entrega
- [ ] Tests, build, typecheck y lint en verde
- [ ] `spec:validate:strict`, índice y cobertura en verde
- [ ] CI, merge, despliegue y activación evidenciados por separado
- [ ] Plan de rollback hacia adelante probado
