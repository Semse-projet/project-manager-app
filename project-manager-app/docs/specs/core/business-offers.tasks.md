# Tareas — BO-05/06 v0.2

**Documentación preparada; implementación pendiente.**

- [x] G0.1 Reconciliar OPEN-03/04/06/14 ya aprobadas; retirar reglas antiguas incompatibles.
- [x] G0.2 Contrastar Org, Membership, requireManage y tests; identificar que CLIENT no prueba propiedad.
- [x] G0.3 Escribir plan de vínculo explícito, migración aditiva sin backfill y denegación legacy.
- [ ] G0.4 Aprobación formal del contrato, modelo/conciliación de owner y evento de auditoría.
- [ ] G1.1 Tests rojos: dueño vinculado autorizado; segundo CLIENT activo no dueño rechazado en create/list/revoke/confirm/end.
- [ ] G1.2 Tests rojos: OPS_ADMIN válido en org objetivo; sin membership o tenant distinto rechazado; roles de otra org no se prestan.
- [ ] G1.3 Tests negativos: PRO, WORKER, supervisor, suspendido/revocado y owner sin vínculo; cero exposición de compensación.
- [ ] G1.4 Tests PostgreSQL de FK, unicidad, tenant/org, auditoría atómica y conciliación legacy sin inferencias.
- [ ] G1.5 Implementar nueva migración, policy y conciliación autorizada; registrar eventos antes de emitirlos.
- [ ] G2.1 Tests controller/service: no clasificación persistida/expuesta y rechazo/ignorancia segura de extras según schema; legalConfirmed:false/ausente rechazado.
- [ ] G2.2 Tests de aceptación concurrente/idempotente, confirmación y terminación sin cambio de Membership; rollback real ante fallo de auditoría.
- [ ] G2.3 Implementar correcciones derivadas de esos tests sin ampliar comportamiento.
- [ ] G3.1 Tests UI de org explícita, carreras y limpieza de compensación/legalOk; corregir microcopy y selección WORKER efectiva.
- [ ] G3.2 Completar finalización desde UI con engagementId autorizado y razón real; navegación según rol sin ampliar permisos.
- [ ] G4.1 CI/build/typecheck/lint/tests, spec:validate:strict, revisión independiente y staging A/B.
- [ ] G4.2 Reconciliar migraciones/flags, revisión legal exigida y canary antes de activar. BO-S1 sigue sin implementación.
