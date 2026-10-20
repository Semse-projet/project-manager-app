# Plan — BO-05/06 remediación v0.2

**Estado:** contrato y plan aprobados por Samuel el 2026-10-20; implementación en #1018. Fases descritas como secuencia de trabajo, con ejecución real y pendientes en tareas/checklist. No repetir decisiones ya ratificadas.

## Fases

1. **G0:** aprobar contrato reconciliado, binding de dueño y migración antes de código. No implementar con la spec todavía en REVIEW.
2. **G1 / ownership:** modelo propuesto `OrgOwnership` con PK orgId, tenantId, ownerUserId, verifiedByUserId, verifiedAt, evidenceRef privado y timestamps. FK compuesta (orgId,tenantId) a Org con unique aditivo correspondiente; FK de usuarios a User. El guard verifica además Membership ACTIVE del dueño en esa misma org/tenant en cada request. No asumir que User global tiene tenantId. No asignar automáticamente organizaciones legacy a ningún CLIENT. Un registro sin owner vinculante niega gestión a CLIENT.
3. **G1 / autoridad:** no exponer endpoint de autoasignación. Preparar conciliación administrativa de owner con evidencia verificada, acceso OPS_ADMIN vigente, motivo, ticket y auditoría en la misma transacción. Registrar el evento en catálogo y aprobar su contrato antes de implementarlo. Reasignación/transferencia no forma parte de este slice; si se requiere, usar spec separada. Registro automático en creación de nuevas organizaciones solo tras contrato de identidad y consentimiento correspondiente, no desde campo del request.
4. **G2 / backend:** mantener permiso org:offers:manage limitado a CLIENT/OPS_ADMIN; en requireManage añadir comprobación persistida para CLIENT. OPS_ADMIN conserva Membership ACTIVE objetivo/tenant y permiso; no introducir bypass global. Verificar owner/rol en create/list/revoke/confirm/end. Resolver revocación/cambio concurrente de autoridad de forma transaccional antes de efectos.
5. **G3 / UI:** binding explícito de org y limpieza de estado/races; selección de destinatarios WORKER efectivos mediante contrato real, no deducida de solo userId. Corregir microcopy de compensación para incluir gestores autorizados sin prometer solo dos personas. Completar finalización con engagementId permitido cuando contrato lo exponga; no habilitar firma.
6. **G4 / pruebas:** negativas por rol/owner/tenant/estado, identidad confiable, clasificación no persistida, compensación, legalConfirmed, estado y audit. PostgreSQL para integridad, concurrencia y rollback de auditoría. CI/build/typecheck/lint y staging autenticado.

## Migración y compatibilidad propuestas

Crear una nueva migración aditiva para OrgOwnership y constraint compuesto; nunca editar `20261017120000_business_offers`. No ejecutar DML de backfill automático. Mantener legacy sin vínculo y fail-closed; conciliación solo por proceso auditado y autorizado. Probar constraints con dos tenants y orgs, user inexistente y Membership suspendida/revocada. Aplicación anterior ignora nueva tabla: por ello no activar ofertas mientras exista una instancia que autorice solo por CLIENT. Mantener flag OFF durante rollout y rollback.

## Auditoría y fallos

Usar los cinco eventos business_offer/business_engagement existentes. Estado + auditoría deben quedar atómicos para operaciones críticas según gobernanza; validar comportamiento actual y corregir en slice aprobado si falla. El registro de ownership necesita su evento/catálogo aprobado antes de código. No incluir compensación, documentos privados o evidencia de identidad en logs. No llamar aprobación legal a legalConfirmed:true.

## Rollback

Revertir código bajo flag OFF; conservar tabla/ownership/auditoría y engagements. Un rollback de app no debe reactivar autorización CLIENT más amplia; impedir reactivación hasta verificar política. No borrar historia ni ejecutar reset. Migración aplicada se conserva y se corrige por forward-fix si hace falta.
