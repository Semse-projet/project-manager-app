# Tareas — BO-05/06 v0.2

**Implementación en #1018.** CI/PostgreSQL real del checkpoint `25cbd26` pasaron. Tests de UI, alcance completo y activación aún pendientes; no confundir implementación con aceptación.

- [x] G0.1 Reconciliar OPEN-03/04/06/14 ya aprobadas; retirar reglas antiguas incompatibles.
- [x] G0.2 Contrastar Org, Membership, requireManage y tests; identificar que CLIENT no prueba propiedad.
- [x] G0.3 Escribir plan de vínculo explícito, migración aditiva sin backfill y denegación legacy.
- [x] G0.4 Aprobación formal del contrato, modelo/conciliación de owner y evento de auditoría.
- [x] G1.1 Tests rojos: dueño vinculado autorizado; segundo CLIENT activo no dueño rechazado en create/list/revoke/confirm/end.
- [x] G1.2 Tests rojos: OPS_ADMIN válido en org objetivo; sin membership o tenant distinto rechazado; roles de otra org no se prestan.
- [ ] G1.3 Tests negativos: PRO, WORKER, supervisor, suspendido/revocado y owner sin vínculo; cero exposición de compensación.
- [x] G1.4 Tests PostgreSQL de FK, unicidad, tenant/org, auditoría atómica y conciliación legacy sin inferencias.
- [x] G1.5 Implementar nueva migración, policy y conciliación autorizada; registrar eventos antes de emitirlos.
- [ ] G2.1 Tests controller/service: no clasificación persistida/expuesta y rechazo/ignorancia segura de extras según schema; legalConfirmed:false/ausente rechazado.
- [ ] G2.2 Tests de aceptación concurrente/idempotente, confirmación y terminación sin cambio de Membership; rollback real ante fallo de auditoría.
- [x] G2.3 Implementar correcciones derivadas de esos tests sin ampliar comportamiento.
- [ ] G3.1 Tests UI de org explícita, carreras y limpieza de compensación/legalOk; corregir microcopy y selección WORKER efectiva.
- [ ] G3.2 Completar finalización desde UI con engagementId autorizado y razón real; navegación según rol sin ampliar permisos.
- [ ] G4.1 CI/build/typecheck/lint/tests, spec:validate:strict, revisión independiente y staging A/B.
- [ ] G4.2 Reconciliar migraciones/flags, revisión legal exigida y canary antes de activar. BO-S1 sigue sin implementación.

## Evidencia y pendientes parciales

- G0.4: aprobación explícita registrada en spec; no aprobación independiente.
- G1.1/G1.2: pruebas de servicio distinguen owner persistido, otro CLIENT, OPS_ADMIN y org/tenant ajenos. G1.4: prueba PostgreSQL BO-05 SUCCESS en API Integration `39385100446`; no backfill inferido.
- G1.3: PRO/WORKER/CLIENT no dueño y legacy sin vínculo cubiertos; completar matriz explícita suspendido/revocado/supervisor. No marcar todo el ítem por inferencia.
- G2.1/G2.2: servicios y auditoría atómica cubiertos; siguen pendientes la cobertura controller completa y concurrencia real de aceptación (la prueba DB concurrente actual corresponde a provisioning de owner).
- G3.1/G3.2: UI implementada con contexto/engagementId/razón; smoke del nuevo SHA y carreras de UI sin ejecutar.
- G4.1: CI/build/SDD/cobertura/E2E checkpoint PASS; revisión independiente y staging del código nuevo no ejecutados. G4.2 permanece pendiente.
