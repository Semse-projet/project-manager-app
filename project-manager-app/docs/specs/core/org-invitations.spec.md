---
id: "core.org-invitations"
title: "Invitaciones personales a una organización (BO-01)"
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
  - "SEMSE_ORG_INVITATIONS_ENABLED"
production_evidence: []
related_files:
  - "apps/api/src/modules/organizations/organizations.controller.ts"
  - "apps/api/src/modules/organizations/invitations.service.ts"
  - "packages/auth/src/rbac.ts"
  - "packages/db/prisma/schema.prisma"
related_tests:
  - "apps/api/test/org-invitations.test.ts"
related_endpoints:
  - "POST /v1/organizations/:orgId/invitations"
  - "GET /v1/organizations/:orgId/invitations"
  - "POST /v1/organizations/:orgId/invitations/:id/cancel"
  - "POST /v1/organizations/:orgId/invitations/:id/resend"
  - "POST /v1/invitations/preview"
  - "POST /v1/invitations/accept"
related_events: []
related_agents: []
last_verified: "2026-10-14"
---
# BO-01 — Invitaciones personales a una organización

Diseño padre: `docs/program/semse-4d-field-memory/COMPANY_INVITATIONS_DETAILED_SPEC.md` (§5–§8). Depende de DEC-R1 (#877/#881/#885, merged en main).

**Autorización:** el propietario pidió implementar y llevar a producción Business OS (2026-10-14). Este slice autoriza rama + PR. Merge, migración y despliegue siguen sus gates; la activación para empleados reales exige el flag y las decisiones OPEN-01/03/04.

## Alcance
Incluido: modelo aditivo `OrgInvitation`; permisos `org:members:invite` y `org:invitations:read|cancel`; crear, listar, cancelar, reenviar (rotación de token), vista previa y aceptación para una persona que **ya tiene cuenta** y la verifica; todo detrás de `SEMSE_ORG_INVITATIONS_ENABLED` (default apagado → 404).

Excluido (slices posteriores): `register-invited` para cuentas nuevas, envío por email/SMS/WhatsApp (el token se devuelve una sola vez a quien invita), cuadrillas, oferta/contratación (BO-05), invitar roles admin/owner.

## Contrato
- AC-01: invitar exige `org:members:invite` **y** membresía ACTIVE del actor en la Org objetivo del mismo tenant. Otra Org/tenant → 404.
- AC-02: roles invitables solo `WORKER`. Cualquier otro (`PRO`, `CLIENT`, `OPS_ADMIN`) → 422. El rol lo fija el servidor al crear; el aceptante no puede cambiarlo.
- AC-03: el token son ≥256 bits aleatorios; solo se guarda `tokenHash` (sha256). Se devuelve una vez al crear o reenviar, nunca en GET ni en logs.
- AC-04: aceptar exige sesión autenticada cuyo email normalizado coincide con el destinatario; sin coincidencia → 404 neutro (no revela la invitación).
- AC-05: transición PENDING→ACCEPTED atómica (`updateMany` con estado+vencimiento); dos aceptaciones concurrentes crean una sola Membership; la repetida devuelve el estado idempotente.
- AC-06: estados terminales (ACCEPTED/CANCELED/EXPIRED/DECLINED) y vencidas no se aceptan → 410 si el solicitante es el destinatario verificado.
- AC-07: reenviar rota el token (el anterior deja de valer). Cancelar exige motivo.
- AC-08: aceptar crea `Membership` ACTIVE con el rol de la invitación. Si ya existe ACTIVE → idempotente; SUSPENDED/REVOKED → 409 sin restaurar.
- AC-09: invitar al mismo contacto con una PENDING vigente es idempotente por `(orgId, contactHash, PENDING)`.
- AC-10: flag apagado → todas las rutas 404; no hay efectos secundarios.
- AC-11: rate limit por org/actor en crear y por IP en preview/accept.

## Modelo
`OrgInvitation(id, tenantId, orgId, inviterUserId, contactEmail(normalizado), contactHash, roleKey, tokenHash UNIQUE, status, expiresAt, acceptedByUserId?, acceptedAt?, canceledAt?, canceledByUserId?, cancelReason?, lastSentAt?, createdAt, updatedAt)`. Migración aditiva, sin backfill ni DML (en producción se aplica con `db push`, ver gate de despliegue).

## Gates de entrega
1. Tests rojos primero. 2. `spec:validate:strict`, build, typecheck. 3. PR draft con SHA y evidencia. 4. Merge solo con CI verde y autorización. 5. Despliegue con flag apagado y verificación de esquema en Railway. 6. Canary con cuentas sintéticas A/B antes de activar.

## Slice BO-04 — Capa web (flag sigue apagado)

Incluye: rutas BFF `apps/web/app/api/semse/organizations/[orgId]/invitations/**` y `invitations/{preview,accept}`; funciones en `semse-api.ts`; páginas `/client/team` (invitar, listar, reenviar, cancelar; enlace mostrado una sola vez) y `/invitations/accept` (vista previa y aceptación con la cuenta propia). Textos ES/EN. Con el flag apagado la API responde 404 y la UI muestra "aún no habilitadas". Sin cambios de API, esquema ni permisos. No incluye entrada en la navegación ni envío de correo.

## Slice BO-03 — Registro de invitados y entrega por correo (flags apagados)

Dos flags nuevos, ambos apagados: `SEMSE_INVITATION_EMAIL_DELIVERY` y `SEMSE_INVITED_REGISTRATION_ENABLED` (este último exige además los dos anteriores).

- **Entrega por correo:** al crear o reenviar, el enlace con el token se envía al `contactEmail` por `EmailService` (Resend con dominio propio verificado). Con esta entrega activa el token **no se devuelve** a quien invita (`token: null`, `emailSent`), porque si no el invitador podría registrarse como el invitado. Con ella apagada se conserva el comportamiento de BO-01.
- **`POST /v1/invitations/register` (público, 5/min):** `{ token, name, password }`. La prueba de control del correo es haber recibido el token por email. Crea `User` + `UserProfile` + `Membership` WORKER ACTIVE en la Org que invita, **sin crear Org**, consume la invitación de forma atómica (PENDING→ACCEPTED con guard de vencimiento) e inicia sesión con rol WORKER en esa Org.
- Token inválido, vencido o ya usado → 404 neutro. Si ya existe una cuenta con ese correo → 409 (debe iniciar sesión y aceptar con `/accept`). Auditoría con `membership.created`.
- **Fuera de este slice:** pantalla pública de registro en la web (la BFF actual exige sesión) y verificación de correo como atributo del `User`.
