---
id: "core.org-invitations"
title: "Invitaciones personales a una organización (BO-01)"
domain: "core"
sdd_version: "2.0"
version: "0.2"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "PASS"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
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
last_verified: "2026-10-20"
---
# BO-01 / BO-03 / BO-04 — Invitaciones y remediación de seguridad

## Autoridad y estado

Contrato v0.2 **APPROVED** por Samuel el 2026-10-20, incluido en #1017. Su aprobación permite implementar y probar la remediación; no acredita revisión independiente, revisión legal ni activación real.

La remediación está implementada en #1018, todavía UNMERGED/NOT_DEPLOYED/INACTIVE. El código base de #975 ya estaba integrado por `60a79b94e8d0ff5222f77463fca4781f289f991f`. No confundir esa base con la remediación nueva.

Checkpoint validado `25cbd26ec4459021827073351ed0d49e94d954b9`: CI `39385100548` y API Integration `39385100446` SUCCESS. La prueba posterior con Redis real identificó una carrera de conexión inicial, corregida compartiendo la promesa; el nuevo HEAD requiere su CI propio. La metadata CI conserva el último checkpoint observado, no sustituye consultar el HEAD de GitHub antes de integrar.

Fuente padre: `docs/program/semse-4d-field-memory/COMPANY_INVITATIONS_DETAILED_SPEC.md`; identidad DEC-R1 (#877/#881/#885). Persisten pendientes de navegador multi-org/rol, PostgreSQL específico de invitaciones, ingress Railway, aprobación exacta de textos y revisión independiente; ver tareas/checklist e informe de #1018.

## Alcance actual

- BO-01: crear, listar, cancelar, rotar y aceptar invitaciones WORKER con cuenta propia.
- BO-03 ya existente: entrega por EmailService y registro público del invitado, sujeto a sus flags adicionales. No crear cuentas mediante el flujo de aceptación autenticado.
- BO-04: gestión web para los roles ya autorizados, preview público, aceptación autenticada y registro condicionado.
- Remediar transporte del token, contexto organizativo, razón de cancelación, acceso PRO y límite por cliente a través del BFF.
- Excluir nuevas concesiones de roles, firma, nómina y ampliación del permiso de invitaciones. La restricción dueño + OPS_ADMIN de ofertas no se importa automáticamente a este dominio.

## Contrato de aceptación

- AC-01: cada gestión exige permiso RBAC **y** Membership ACTIVE del actor en la organización objetivo dentro del tenant. Organizaciones o tenants ajenos → 404. Un permiso en Org A no autoriza Org B.
- AC-02: solo es invitable WORKER; cualquier otro rol → 422 y sin efectos.
- AC-03: token aleatorio de al menos 256 bits; persistir solo SHA-256. Devolver una vez al invitador únicamente con entrega email desactivada. No incluir token en listados, AuditLog, logs o telemetría.
- AC-04: aceptación autenticada exige que email normalizado de la cuenta coincida con la invitación; ajeno/inexistente → respuesta neutra. No aceptar identidad enviada en campos arbitrarios.
- AC-05: transición PENDING→ACCEPTED con guard de estado y vencimiento; dos aceptaciones concurrentes crean una sola Membership. Repetición por el mismo destinatario mantiene idempotencia.
- AC-06: invitaciones terminales/vencidas no se aceptan; conservar el contrato de errores existente, incluida respuesta neutra para actores no verificados.
- AC-07: reenviar invalida el token anterior. Cancelar requiere razón escrita por el actor, recortada, 1–500 caracteres. BFF rechaza ausencia/blanco/exceso con 400 antes de llamar a la API. Nunca fabricar una razón.
- AC-08: Membership ACTIVE existente → idempotente; SUSPENDED/REVOKED → 409, sin restauración implícita.
- AC-09: creación pendiente vigente idempotente según org/contacto. No exponer tokens históricos al reintentar.
- AC-10: flag principal OFF → todas las rutas de invitaciones denegadas y cero efectos. Registrar por separado intención de configuración y valor efectivo observado; esta revisión no consultó producción.
- AC-11: rate limit existente por org/actor para crear y por cliente para preview/accept/register. Debe funcionar entre réplicas y para acceso directo y vía BFF. No confiar en X-Forwarded-For arbitrario ni eliminar el límite como reparación. Ver AC-16.
- AC-12: enlaces nuevos usan `/invitations/accept#token=…`; productores UI y correo comparten el formato. Leer el fragmento solo en memoria y limpiar de inmediato con history.replaceState **antes** de preview/telemetría. No guardar token en localStorage, sessionStorage ni cookies. Remontajes/StrictMode no deben perder el token durante el recorrido vivo ni provocar aceptación automática. Recargar después del scrub exige reabrir el enlace recibido; no persistir el secreto para evitarlo.
- AC-13: enlaces legacy `?token=` no se convierten silenciosamente en formato seguro: ya expusieron el secreto a la petición inicial. Rechazarlos con mensaje neutro para solicitar reenvío/rotación; limpiar URL sin reenviar el token a otras rutas. No declarar limpiados logs históricos. No aceptar tokens simultáneos/ambiguos en query y fragmento.
- AC-14: gestión muestra nombre e ID de organización verificados, vinculados a sesión/contexto autorizado. Nunca seleccionar `orgs[0]`. Si falta contexto, no listar ni mutar hasta selección explícita validada. Al cambiar de org, borrar filas/enlaces/errores previos y descartar respuestas antiguas para impedir mezcla visual o acciones sobre contexto anterior.
- AC-15: un PRO autorizado por RBAC y Membership debe poder llegar a la gestión desde una ruta permitida en su superficie (propuesta: `/worker/team` con componente compartido). No abrir `/client/*` globalmente. WORKER sin permiso recibe denegación de API aunque llegue a la UI.
- AC-16: la identidad de cliente solo puede provenir de un ingress/proxy cuya confianza esté probada y delimitada. El BFF puede aplicar límites distribuidos desde ese ingreso o transmitir una aserción autenticada de proxy al API. No usar contador en RAM ni `trustProxy=true` global. **Antes de implementar elegir y documentar topología, fuente confiable, almacenamiento compartido, política ante caída y pruebas anti-spoofing**; si no puede demostrarse, bloquear activación de estas rutas, sin declarar resuelto el P1.
- AC-17: preview es público y solo expone la proyección mínima; accept requiere sesión. Register es público solo bajo los tres flags requeridos, con entrega por correo obligatoria y token no devuelto al invitador. El BFF no admite email/tenant/org del cliente para crear identidad; los deriva en servidor.
- AC-18: respuestas con tokens/credenciales usan no-store; sanitizar logs, referrers y errores. Auditoría con eventos existentes del catálogo; cualquier acción nueva requiere catálogo aprobado antes de código.

## Datos y entrega

`OrgInvitation` ya existe y tiene migración versionada `20261014120000_org_invitations`; esta remediación no propone cambiarla ni editar migraciones aplicadas. Verificar estado real con `prisma migrate status` y aplicar cambios aprobados exclusivamente mediante `prisma migrate deploy`; **no usar db push/reset en producción**. `migration_status: PENDING` expresa reconciliación operativa no demostrada, no que se haya creado una migración en este PR.

Flags existentes: `SEMSE_ORG_INVITATIONS_ENABLED`, `SEMSE_INVITATION_EMAIL_DELIVERY`, `SEMSE_INVITED_REGISTRATION_ENABLED`. No modificar sus valores productivos en esta fase.

Merge/deploy requieren contrato formal autorizado, pruebas dirigidas y CI del SHA actual. Activación exige canary sintético A/B y verificación de límites, entrega de correo y aislamiento. Rollback: desactivar los flags afectados y revertir el código compatible; no borrar invitaciones, Memberships o auditoría ya creadas. El rollback no deshace aceptaciones ni elimina exposición histórica de URLs.

## Aprobación del propietario — 2026-10-20

Samuel aprobó expresamente los contratos v0.2 de #1017 y la propuesta de propietario explícito: «También apruebo los contratos y corrige todo los errores». Autoriza implementar y probar la remediación descrita; no constituye revisión independiente, aprobación legal ni activación productiva. Las menciones REVIEW anteriores describen el checkpoint documental previo y quedan sustituidas por esta aprobación.
