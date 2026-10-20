# Checklist — BO-05/06 v0.2

## Gobierno y análisis
- [x] OPEN-03/04/06/14 ratificadas por propietario el 2026-10-18, preservadas sin nueva votación.
- [x] Spec, plan y tareas reconciliados con decisiones vigentes.
- [x] Identificada diferencia entre CLIENT con permiso y dueño persistido.
- [x] Eliminadas promesas incompatibles sobre Membership, clasificación, PRO y grants al supervisor.
- [x] Contrato/modelo ownership APPROVED por Samuel el 2026-10-20; evento documentado antes de código.

## Pruebas y entrega
- [ ] Pruebas primero; dueño verificado positivo y CLIENT no dueño negativo para las cinco operaciones de gestión.
- [ ] OPS_ADMIN acotado a tenant/org/membership vigente; no bypass por headers o rol de otra org.
- [ ] Compensación solo a gestores autorizados y destinatario; nunca supervisor ni otro CLIENT.
- [ ] W-2/1099 no persistido/expuesto; datos históricos inventariados sin borrado implícito.
- [ ] Oferta/engagement no crean ni cambian Membership; aceptación separada de confirmación legal declarada.
- [ ] Estado + auditoría atómicos; concurrencia e integridad con PostgreSQL real.
- [ ] Legacy sin owner falla cerrado; conciliación auditada sin escoger primer CLIENT.
- [ ] UI con contexto explícito y sin respuestas obsoletas; finalización autorizada y microcopy exacta.
- [ ] Flag OFF → 404 y sin efectos; valor real verificado por separado.
- [ ] Migración nueva validada, compatibilidad/rollback probado sin reabrir permisos amplios.
- [ ] spec:validate:strict, typecheck/build/lint/tests y CI del SHA actual.
- [ ] Revisión independiente, revisión legal requerida y canary antes de uso real.

BO-S1 firma queda planificado, sin autorización de activación ni código de proveedor.

Checkpoint `25cbd26`: CI/API Integration SUCCESS; FK/unicidad/owner y rollback real pasaron en PostgreSQL. No marcar ítems compuestos cuando su parte de UI, matriz completa, migración/rollback operacional o revisión independiente esté pendiente.
