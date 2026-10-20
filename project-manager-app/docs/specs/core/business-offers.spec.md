---
id: "core.business-offers"
title: "Ofertas internas y engagement empresa-profesional (BO-05)"
domain: "core"
sdd_version: "2.0"
version: "0.2"
status: "REVIEW"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags:
  - "SEMSE_BUSINESS_OFFERS_ENABLED"
production_evidence: []
related_files:
  - "apps/api/src/modules/organizations/offers.service.ts"
  - "apps/api/src/modules/organizations/offers.controller.ts"
  - "apps/api/src/modules/organizations/invitations.service.ts"
  - "packages/db/prisma/schema.prisma"
related_tests:
  - "apps/api/test/business-offers.test.ts"
related_endpoints: []
related_events:
  - "business_offer.sent"
  - "business_offer.responded"
  - "business_offer.revoked"
  - "business_engagement.activated"
  - "business_engagement.ended"
related_agents: []
last_verified: "2026-10-20"
---
# BO-05 / BO-06 — Ofertas y engagement: contrato reconciliado

## Estado y evidencia

**REVIEW**, v0.2: no declara aprobada la remediación ni sus gates. La autorización del propietario para continuar correcciones (2026-10-19/20) conserva las decisiones funcionales ya registradas el 2026-10-18; no es aprobación legal ni revisión independiente. La metadata de entrega describe la remediación pendiente, no borra el hecho de que #976 ya fue fusionado por `861eec821d86746423cbd1d8f8f14af672019f8c`.

Base inspeccionada `a03bb2b5a211c286874a9f08438b78f29a8e2de5`. El código actual deniega PRO para gestión, usa NOT_RECORDED, oculta clasificación y exige legalConfirmed:true en controller. **Todavía no demuestra owner-only**: `OffersService.requireManage` comprueba roles de Membership ACTIVE y `Org` no tiene vínculo explícito con su dueño. CLIENT por sí solo no satisface OPEN-04. Los tests actuales llaman «owner» a un CLIENT; esa etiqueta no prueba propiedad.

## Decisiones vigentes del propietario — no volver a votar

| ID | Decisión ratificada 2026-10-18 | Efecto obligatorio |
|---|---|---|
| OPEN-03 | No registrar W-2/1099 ni inferir clasificación | No admitir/persistir/exponer clasificación; columna heredada con NOT_RECORDED para altas nuevas. Conservar legalConfirmed:true como declaración separada, sin convertirla en validación legal independiente. |
| OPEN-04 | Solo dueño y OPS_ADMIN gestionan; sin HR delegado | CLIENT con permiso no demuestra ser dueño. PRO, supervisor y CLIENT no dueño quedan fuera de emisión, listado de gestión, revocación, confirmación y terminación. |
| OPEN-06 | Compensación solo para gestores autorizados y destinatario | Supervisor sin acceso. Sin grant nuevo ni excepción implícita. OPS_ADMIN autorizado forma parte de los gestores; la UI no debe prometer «solo ustedes dos». |
| OPEN-14 | Planificar firma, sin activar firma real | BO-S1 necesita su propio contrato, identidad, consentimiento, custodia, validación de documento y UAT; no implementarlo por este slice. |

La tabla de supuestos 2026-10-17 queda sustituida por estas decisiones. No conservar como normas paralelas W2/1099, gestión por PRO o grants al supervisor.

## Invariantes

- Oferta no es contrato legal, firma, nómina, licencia ni grant de acceso.
- Destinatario es WORKER ACTIVE de la organización; ya aceptó invitación. Aceptar/confirmar/terminar engagement **no crea, suspende ni revoca Membership**. La gestión de grants de BO-07 es independiente.
- Sin reutilización de Job/Bid/Contract del Marketplace. Una persona puede tener varios engagements con organizaciones aisladas.
- El patrón no responde por el trabajador; Prometeo puede redactar, no emitir/aceptar por sí mismo.
- SSN y documentos sensibles no se admiten en notas ni se envían a LLM.
- Historial preservado; modificaciones de condiciones se realizan mediante revocación y nueva oferta, sin editar condiciones ya enviadas. Enmiendas versionadas y estado SUSPENDED son futuros, no capacidades actuales.

## Criterios de aceptación

- AC-01: gestión requiere tenant correcto, Membership ACTIVE y permiso en organización objetivo **y** dueño verificado o OPS_ADMIN autorizado. Fuera de tenant/organización accesible → 404; actor interno sin capacidad/propiedad → 403, sin compensación ni mutación. No prestar roles de otra org.
- AC-02: destinatario autenticado solo lee/responde ofertas propias, sin poder alterar recipientUserId ni consultar compensación de otro. Conservar aislamiento al cambiar sesión/org y respuesta neutra para recursos ajenos.
- AC-03: transición atómica y reintentos según estado. Aceptaciones concurrentes crean un solo engagement; no auditar éxito si la escritura falla. Añadir pruebas de fallo de auditoría antes de cerrar atomicidad.
- AC-04: ACCEPTED crea PENDING_CONFIRMATION, no ACTIVE. Confirmación expresa legalConfirmed:true, posterior a aceptación, solo por gestor autorizado; activación del engagement no crea accesos ni equivale a firma.
- AC-05: terminar exige razón real y estado permitido; no tocar Membership, otras orgs, pagos ni grants de BO-07.
- AC-06: condiciones enviadas inmutables y cadena de historia conservada; no anunciar enmiendas versionadas si no están implementadas.
- AC-07: SEMSE_BUSINESS_OFFERS_ENABLED OFF → 404 y cero efectos en todos los caminos. Valor efectivo de producción no verificado por este documento.
- AC-08: auditoría solo con nombres de EVENT_CATALOG; datos sensibles redaccionados. Revisión de atomicidad y fallos forma parte de las pruebas, no se da por aprobada desde presencia del evento.
- AC-09: fixtures distinguen dueño real, segundo CLIENT activo no dueño, OPS_ADMIN autorizado, PRO, WORKER, supervisor, suspendido, revocado, otra org y otro tenant. Probar las cinco operaciones de gestión y lecturas de compensación. Ninguna variable de test llamada owner sustituye vínculo persistido.
- AC-10: retirar payloads de classification; comprobar que no se persiste clasificación recibida aunque se envíe un campo extra. No prometer borrado histórico sin inventario autorizado y migración separada.
- AC-11: UI usa organización explícita y visible de sesión/contexto validado; no `orgs[0]`; al cambiar descarta respuestas anteriores y limpia personas/ofertas/compensación/confirmación legal.
- AC-12: terminar engagement desde UI exige exponer únicamente el engagementId permitido al gestor y su FSM. Esta pieza BO-06 sigue pendiente; no declararla cerrada desde el endpoint existente.

## Propuesta técnica de ownership — pendiente de aprobación formal

Persistir un vínculo explícito único organización→usuario dueño, acotado por tenant, separado del rol CLIENT. Propuesta: tabla `OrgOwnership` con `orgId`, `tenantId`, `ownerUserId`, referencia de verificación privada y datos de auditoría; unicidad por organización y claves foráneas consistentes con Org/User. Verificar Membership ACTIVE y rol/permiso de gestión **en cada operación**, además del vínculo. La selección exacta de campos/constraints queda definida en el plan antes de modificar Prisma.

No inferir dueño de la primera/última Membership, fecha de registro, nombre, tipo de Org, rol CLIENT o quien emitió una oferta. Organizaciones legacy sin prueba quedan sin dueño autorizado, con gestión bloqueada; conciliación manual auditada mediante OPS_ADMIN autorizado y evidencia del propietario legítimo. No asignar automáticamente filas legacy ni migrar datos mediante este PR documental.

Conservar para OPS_ADMIN el perímetro existente de Membership ACTIVE en la organización destino y tenant; no introducir un bypass global. Un dueño que solo tenga PRO no recibe el permiso retirado de PRO; cambiar esa decisión requeriría alcance nuevo.

La transferencia de propiedad, HR delegado y elevación de privilegios quedan fuera de este slice. Si ownership exige modificar identidad, aprobar el contrato y migración correspondiente antes de implementación; no improvisar un bypass local en OffersService.

## Datos, FSM y compatibilidad

Modelo vigente: BusinessOffer con positionTitle, startsAt?, compensationNote?, expiresAt, status; BusinessEngagement vinculado a offerId/userId/orgId/tenantId. FSM de oferta: SENT → ACCEPTED | DECLINED | REVOKED; vencimiento temporal impide responder. FSM implementada de engagement: PENDING_CONFIRMATION → ACTIVE; PENDING_CONFIRMATION o ACTIVE → ENDED según guard actual. No añadir estados por deducción.

Migración histórica `20261017120000_business_offers` ya versionada; no editarla. Su aplicación real queda pendiente de reconciliación. Ownership requiere nueva migración aditiva **planificada, no creada/aplicada aquí**. Compatibilidad: app anterior ignora el vínculo; app nueva deniega gestión cuando falta. No activar nueva gestión hasta desplegar guard en todas las instancias. Rollback de código no elimina datos ni revierte engagements/auditoría; mantener flags OFF evita reabrir el permiso anterior más amplio.

## Gates pendientes

1. Aprobar formalmente spec/plan de remediación y vínculo owner; no volver a preguntar OPEN-03/04/06/14.
2. Tests negativos primero, implementación, CI SHA actual y PostgreSQL real para owner/membership/aislamiento/concurrencia/auditoría.
3. Revisión independiente y aceptación del contrato legal aplicable antes de personas reales; legalConfirmed:true no reemplaza ese requisito.
4. Canary sintético, verificación de flags/rollback y reconciliación de migraciones antes de activar.
5. BO-S1 firma sigue planificado y no forma parte del cierre BO-05.
