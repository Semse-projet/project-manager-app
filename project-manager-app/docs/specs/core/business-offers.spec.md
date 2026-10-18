---
id: "core.business-offers"
title: "Ofertas internas y engagement empresa-profesional (BO-05)"
domain: "core"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
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
last_verified: "2026-10-17"
---
# BO-05 — Oferta interna y Engagement

Diseño preliminar marcado **PROPOSED**. No autoriza código, migración ni activación. Fuente: plan Astra `03_producto/06_CONTRATACION_Y_PORTABILIDAD.md` y `04_ejecucion/16_DECISIONES_PENDIENTES.md`. Depende de BO-01 (invitación e identidad).

## Bloqueos que impiden implementar
| ID | Qué falta | Quién decide |
|---|---|---|
| OPEN-03 | Qué contrato real se formaliza (W-2 vs contractor según hechos) | Patrón + asesor legal |
| OPEN-04 | Quién puede extender oferta o suspender | Producto/Security |
| OPEN-06 | Qué salario ve el supervisor | Producto/Privacy |
| OPEN-14 | Firma real Documenso: OFF hasta identidad, consentimiento, custodia y UAT | Legal/Security |

Hasta resolverlas, este spec solo fija el contrato técnico y los invariantes. El código se inicia tras aprobación explícita del propietario.

## Invariantes (no negociables)
- Una oferta no es un contrato legal ni crea empleado, `Membership` ni permisos por sí sola.
- Flujo separado de Marketplace: no reutiliza `Job`/`Bid`/`Contract`.
- La `Membership` se crea solo cuando existe aceptación de la persona **y** confirmación del patrón/HR (engagement ACTIVE).
- El patrón no acepta por el trabajador; nadie simula firma. Prometeo solo redacta, nunca ofrece ni acepta.
- Clasificación (`W2`, `1099`, `OTHER`) la declara el patrón; el sistema no la usa para eludir obligaciones y exige confirmación legal antes de activar.
- No se almacenan SSN ni documentos sensibles en notas, ni se envían a LLM.
- Un usuario con dos empresas conserva un `User` y engagements aislados por Org.
- La compensación solo la ven emisor autorizado y destinatario; el supervisor no, salvo grant explícito.

## Modelo propuesto
`BusinessOffer(id, tenantId, orgId, invitationId?, issuedByUserId, recipientUserId?, positionTitle, classificationDeclared, terms JSON versionado, status, version, expiresAt, respondedAt?, createdAt, updatedAt)`
`BusinessEngagement(id, tenantId, orgId, userId, offerId, status, startsAt, endsAt?, activatedByUserId?, endedReason?, createdAt, updatedAt)`
FSM oferta: DRAFT → SENT → ACCEPTED | DECLINED | EXPIRED | REVOKED. FSM engagement: PENDING_CONFIRMATION → ACTIVE → SUSPENDED → ENDED. Cada enmienda crea una nueva versión inmutable de la oferta.

## Contrato de aceptación (cuando se desbloquee)
- AC-01: crear/enviar exige permiso dedicado y membresía ACTIVE del emisor; otra Org → 404.
- AC-02: aceptar exige sesión del destinatario verificado (reutiliza la verificación de BO-01); otro usuario → 404 neutro.
- AC-03: transiciones atómicas con guard de estado; repetir es idempotente.
- AC-04: ACCEPTED no crea acceso; solo la confirmación del patrón activa el engagement y la Membership WORKER.
- AC-05: terminar un engagement revoca grants de esa Org sin afectar otras Orgs del usuario.
- AC-06: las condiciones versionadas son inmutables; la historia se conserva.
- AC-07: flag apagado → 404 sin efectos.
- AC-08: eventos de auditoría solo con nombres de `EVENT_CATALOG.md`; si falta alguno, se añade al catálogo antes del código.

## Fuera de alcance
Firma Documenso real, nómina, cobros y licenciamiento (OPEN-15), selección de oficios, cuadrillas y horarios.

## Decisiones adoptadas — supuestos conservadores (2026-10-17)
El propietario pidió avanzar con supuestos conservadores. **Son supuestos de implementación, no aprobación legal**: el flag `SEMSE_BUSINESS_OFFERS_ENABLED` sigue apagado y no se activa con empleados reales hasta que OPEN-03/04/06/14 se ratifiquen por escrito.

| ID | Supuesto implementado | Alternativa descartada |
|---|---|---|
| OPEN-03 | La clasificación (`W2`/`1099`/`OTHER`) la declara el patrón y solo se registra; la oferta no es contrato legal. Activar el engagement exige `legalConfirmed: true` del patrón. | Inferir clasificación o tratar la aceptación como contrato |
| OPEN-04 | Solo roles con `org:offers:manage` (CLIENT, PRO, OPS_ADMIN como en invitaciones) emiten, revocan, confirman y terminan. Sin delegado HR. | Delegación a supervisor |
| OPEN-06 | La compensación (`compensationNote`) solo la ven quienes gestionan ofertas y el destinatario; no existe rol supervisor con acceso. | Visibilidad por supervisor |
| OPEN-14 | Sin firma real ni Documenso. | Firma con proveedor |

Cambios respecto al diseño propuesto: la oferta solo se dirige a un `WORKER` ACTIVE de la Org (ya aceptó BO-01); el engagement **no crea ni modifica Membership**; terminar un engagement no suspende la Membership (la revocación de grants llega con BO-07); sin enmiendas versionadas en este slice (revocar y emitir nueva oferta). Eventos añadidos al catálogo: los cinco de `related_events`.

## Slice BO-06 — Capa web de ofertas (flag sigue apagado)

Incluye: rutas BFF `apps/web/app/api/semse/organizations/[orgId]/offers/**`, `.../engagements/[engagementId]/end` y `offers/{mine,[offerId]/respond}`; funciones en `semse-api.ts`; páginas `/client/offers` (emitir, revocar, confirmar engagement con casilla de confirmación legal) y `/worker/offers` (ver y responder las propias). ES/EN. Sin cambios de API, esquema ni permisos. Con el flag apagado la API responde 404 y la UI muestra "aún no habilitadas".

Pendiente: terminar un engagement desde la UI (la vista de oferta no expone todavía el `engagementId`), entrada en la navegación y firma (OPEN-14).
