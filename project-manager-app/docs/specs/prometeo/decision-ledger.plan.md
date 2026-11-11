---
type: plan
feature: "Decision Ledger"
domain: "prometeo"
spec: "docs/specs/prometeo/decision-ledger.spec.md"
version: "2.1"
status: "DRAFT"
branch: "feat/decision-ledger"
date: "2026-11-06"
---

# Plan técnico: Decision Ledger

## Snapshot
Reescrito el 2026-11-06 contra `main` y el spec v1.1. El spec está en `REVIEW`: este plan no autoriza código ni migración. Refrescar `main` antes de implementar.

## Constitution check
- [ ] ADR-044 aceptado con fecha y acta aprobada
- [ ] spec `APPROVED` (Q-1 a Q-9 resueltas)
- [ ] migración revisada y autorizada por el owner
- [ ] FSM y eventos registrados en `docs/foundation` antes del código
- [ ] pruebas escritas primero y en rojo
- [ ] sin autoridad ni almacén paralelo; no reemplaza `AgentDecision`, `AgentApproval`, `AuditLog` ni `PolicyDecision`
- [ ] CI, merge, despliegue y activación registrados por separado

## Arquitectura
Registro de solo-agregar con tres tablas (`DecisionRecord`, `DecisionSourceRef`, `DecisionEffectRef`), un servicio interno `recordAuthorizedDecision(input, tx?)` y lectura por API. El estado de una decisión se **deriva** de la cadena de filas, no se guarda.

## Datos
Migración aditiva con: las tres tablas, índices del spec, unicidad `(tenantId, idempotencyKey)` y `(tenantId, supersedesDecisionId)`, `onDelete: Restrict` hacia `Tenant` y un *trigger* que rechaza `UPDATE` y `DELETE` (precedente: `prevent_job_scope_snapshot_update`). Sin `db push`.

## Seguridad
- Autoridad, política y aprobación validadas contra el mismo tenant y organización.
- Fuentes sin `tenantId` no se aceptan.
- 404 de otro tenant, 403 de otra organización; lectura autorizada contra el recurso del sujeto.
- `rationale` redactado y acotado; sin cuerpos de conversaciones.
- Flag ausente o desconocido = `off`.

## Eventos e idempotencia
Misma transacción del productor cuando comparten base de datos; si no, `DomainOutboxEvent` con consumidor idempotente. Clave de idempotencia derivada de la fuente; 409 si llega con otro contenido.

## Fases
A. FSM y eventos en `docs/foundation`; pruebas en rojo → B. esquema, migración y *trigger* → C. servicio y repositorio → D. lectura y permisos → E. integración del primer productor en `shadow` (sin filas) → F. verificación local → G. PR, CI y merge → H. despliegue, canary con un tenant y un productor.

## Rollback
- Flag en `off`: no se escriben más decisiones.
- **El historial no se borra** ni se revierte la migración con `DROP`: la corrección es hacia adelante, con filas `CORRECTION` o `VOID`.
- Revertir el código deja la tabla intacta.
- Punto de recuperación y procedimiento de restauración: Q-6 y la skill de verificación de respaldos.

## Gates
- [ ] archivos exactos confirmados contra `main`
- [ ] pruebas primero
- [ ] `spec:validate:strict` en verde
- [ ] migración probada sobre una copia
- [ ] CI terminal; despliegue terminal
- [ ] canary autenticado
