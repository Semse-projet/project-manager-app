---
id: "discovery.semse-4d-company-invitations"
title: "SEMSE — Alta de compañías, invitaciones URL y membresías laborales"
type: "design-draft"
domain: "core"
sdd_version: "2.0-proposed"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags:
  - "SEMSE_ORG_INVITATIONS_ENABLED (propuesta)"
production_evidence: []
related_files:
  - "apps/api/src/modules/auth/auth.controller.ts"
  - "apps/api/src/modules/auth/auth.service.ts"
  - "apps/api/src/modules/auth/auth.repository.ts"
  - "apps/api/src/modules/organizations/organizations.controller.ts"
  - "apps/api/src/modules/organizations/organizations.service.ts"
  - "apps/api/src/modules/users/users.controller.ts"
  - "packages/auth/src/rbac.ts"
  - "packages/db/prisma/schema.prisma"
  - "apps/mobile/src/"
related_specs:
  - "docs/specs/core/org-membership-status.spec.md"
  - "docs/specs/core/universal-identity-multi-role.spec.md"
  - "docs/architecture/ADR-040-ws01c-identity-organization-context.md"
  - "docs/program/semse-4d-field-memory/ORGANIZATION_ENROLLMENT_AND_4X10_SHIFTS.md"
last_verified: "2026-10-11"
---

# Especificación detallada: organización del patrón e invitación segura a trabajadores

**Estado:** especificación lista para revisión de producto/seguridad, **NO autorización de ejecución, no implementación terminada**. Se conserva en `docs/program/` y NO se registra en `SPEC_INDEX` como capacidad aprobada hasta pasar la revisión SDD 2.0. Referencias y endpoints futuros se marcan expresamente como **PROPUESTOS**.

## 0. Decisión de producto y respuesta al caso real
Para una compañía de staffing de electricidad con 2, 15, 30 o 200 trabajadores:
1. **El patrón tiene una cuenta personal SEMSE** y es propietario/administrador de **una organización (Org)** que representa a la compañía. *No* se comparte usuario/contraseña corporativa.
2. **Cada trabajador tiene una cuenta personal (User)**, que puede pertenecer a una o varias organizaciones mediante `Membership` con roles independientes.
3. Desde **Equipo → Invitar trabajadores**, el patrón selecciona contactos, rol inicial y, si existe, proyecto/cuadrilla, y SEMSE genera **un enlace único, verificable, temporal y revocable por invitado**.
4. La invitación puede distribuirse por correo, SMS, WhatsApp (enlace copiado o integración autorizada); no es obligatorio abrir una cuenta nueva si la persona ya tiene SEMSE. Un enlace de empresa genérico que acepte a cualquiera sin verificación **NO** concede acceso.
5. El trabajador verifica su correo/teléfono según el destino, **acepta explícitamente** y se vincula a la `Org` autorizada. Se asigna a la obra/cuadrilla en un paso distinto; no todo miembro ve todas las obras.
6. El encargado de 15 trabajadores administra **su cuadrilla** (tareas y evidencia); el patrón administra **su organización** (trabajadores y tiempo autorizado). El supervisor de la constructora usa su propio sistema y recibe únicamente comparticiones autorizadas.
7. Baja/suspensión deja sin acceso futuro a esa organización, conserva historial verificable de horas/fotos según política y no afecta membresías en otras empresas.

**URL representativa, NO real desplegada:** `https://<dominio-configurado-de-SEMSE>/invite/<invitationId>#t=<secreto-opaco>`. La parte `#t=` es ejemplo para reducir exposición en logs HTTP; su compatibilidad con Universal/App Links, vista previa y plataformas se debe probar antes de fijar contrato. Al abrirse, la app web lee el secreto solo en memoria, lo intercambia mediante POST con el backend, limpia inmediatamente la URL (`history.replaceState`), evita scripts de terceros y usa `Referrer-Policy: no-referrer`. El servidor jamás acepta solo `invitationId` como credencial. En móvil el enlace universal debe mantener un fallback HTTPS seguro; no depender del esquema `semse://` como única ruta. Usar dominio real de entorno únicamente cuando esté verificado/configurado.

## 1. Auditoría AS-IS confirmada por lectura de archivos de GitHub (2026-10-11)
| Superficie existente | Hallazgo comprobado | Decisión |
|---|---|---|
| `packages/db/prisma/schema.prisma` | `User` global; `Org` con `tenantId`, `type`, `name`; `Membership` con clave `(userId,orgId,roleId)`, `status` por fila con default ACTIVE | Reutilizar, sin inventar `CompanyWorkspace` ni crear nueva base de identidades |
| `auth.controller.ts` | `POST /v1/auth/register` crea cuenta personal con rol CLIENT/PRO; login ya existe | Registro de trabajador invitado necesita ruta/ramificación propia, no heredar automáticamente la semántica de alta PRO |
| `auth.repository.ts: createUserWithOrg()` y `AuthService.register()` | **Cada registro CLIENT/PRO crea también una Org nueva** y Membership ACTIVE; el `tenantId` por defecto deriva de configuración | **GAP CRÍTICO:** no enviar al invitado a registro normal como solución completa; crearía compañías duplicadas y posiblemente tenant incorrecto |
| `OrganizationsController` | Solo hay GET lista/detalle/miembros bajo `v1/organizations` | No se verificó endpoint para generar invitaciones, crearlas ni aceptarlas; implementar extensión tras inventario de otros módulos |
| `packages/auth/src/rbac.ts` | Existe rol `WORKER` con acciones de field-ops/evidence; CLIENT/PRO tienen `org:members:read` pero no se observó `org:members:invite` | Crear permisos puntuales y guards; no conceder altas por heredar PRO o permiso de lectura |
| `docs/specs/core/org-membership-status.spec.md` | Documenta INVITED/ACTIVE/SUSPENDED/REVOKED; falta verificar estado operativo de todo el lifecycle | Solicitud `OrgInvitation` puede ser PENDING aun sin User; al aceptarse crea/activa Membership, no se presupone una fila previa INVITED para invitado desconocido |
| `AuthService.loginWithPassword()` | Elige primera Membership ACTIVE; las sesiones JWT tienen `orgId` y `roles`. `authenticateRequest` no consulta BD cada vez (comentario sobre incidente de latencia) | **GAP DE AUTORIZACIÓN:** una revocación no puede confiar solo en caducidad del JWT para recursos sensibles; añadir invalidación/evaluación confiable sin recrear el incidente de rendimiento |
| ADR-040 + F10 multi-rol | No introducir otro mecanismo de selección de organización que compita con contexto/proyecto real | Contexto de acceso siempre resuelto del recurso abierto y membership efectiva, nunca de preferencia UI ni del link |

**Alcance de evidencia:** repositorio y código inspeccionado; no se ejecutaron CI, migraciones ni smoke de producción. La documentación anterior puede estar desactualizada respecto a otros flujos: inventariarlos en preflight antes de modificar código.

## 2. Objetivos medibles y límites de producto
**MVP:** una compañía invita 15 trabajadores; cada uno entra con identidad propia, ve quién lo invitó y qué empresa, acepta en web o móvil, queda ACTIVE solo en esa Org, recibe obra/cuadrilla autorizada y puede iniciar tareas/asistencia conforme a permisos. Administrador puede reenviar, revocar, auditar; trabajador puede salir o ser suspendido sin perder su cuenta personal.

**No objetivos MVP:** crear una red social por códigos abiertos, trasladar nóminas entre empresas, permitir que una constructora lea HR/payroll del staffing, hacer que un QR público conceda ADMIN, obligar a todos los trabajadores a tener teléfono inteligente, activar geolocalización por aceptar la invitación, generar contratos laborales sin consentimiento específico o empezar a trabajar automáticamente al unirse.

**KPIs:** tasa de aceptación en 7 días; mediana de tiempo invitación→ACTIVE; invitaciones fallidas por causa; duplicación de usuarios y orgs (cero no autorizados); accesos indebidos entre organizaciones (objetivo cero); revocación efectiva, cobertura de auditoría y trabajadores con alternativa sin dispositivo.

## 3. Roles y matriz mínima de autorización
| Actor | Crear Org | Invitar WORKER | Invitar lead | Invitar admin/owner | Consultar equipo | Revocar | Ver tiempo propio |
|---|---|---|---|---|---|---|---|
| Dueño verificado de la compañía | Solo alta/claim controlada | Sí, su Org | Sí, proyecto/cuadrilla autorizados | Admin: step-up y aprobación según política; owner: flujo extraordinario | Su Org | Su Org, sujeto a protección último owner | Sí |
| Admin delegado | No salvo concesión excepcional | Sí | Por alcance autorizado | No, por defecto | Su Org/recursos autorizados | Solo roles inferiores y scope autorizado | Sí |
| Encargado de cuadrilla | No | No por defecto (puede solicitar) | No | No | Solo su cuadrilla | No salvo delegación explícita | Sí |
| Trabajador | No | No | No | No | Perfil y asignaciones propias | Renunciar a propia participación mediante flujo seguro | Sí |
| Supervisor GC externo | No | No | No | No | Solo intercambio de obra explícitamente compartido | No | No, salvo permiso contractual expreso |
| Prometeo | No automáticamente | Solo propuesta autorizada | Solo propuesta | Nunca autoconcederse | Lecturas autorizadas | Solo solicitud aprobada | Solo por permiso |

**Permisos propuestos:** `org:create:verified`, `org:members:invite`, `org:members:invite:lead`, `org:members:manage`, `org:invitations:read`, `org:invitations:cancel`, `org:members:admin_grant`. Deben ligarse a política de recurso `tenantId+orgId`, no solo a cadena RBAC global. Para el rol de encargado preferir autorización contextual `CrewMembership`/proyecto sobre convertir `WORKER` en un admin global. Alta de propietario debe preservar al menos un owner activo y probado; nunca degradarlo/borrarlo por error. La matriz precisa debe ratificarse con auth owner y los roles existentes, antes de codificar.

## 4. Historias de usuario y recorridos de UI
### HU-01 — Alta del patrón
- Un usuario existente `PRO` que registró su empresa **no debe crear otra Org** para su primer equipo: selecciona su Org existente, completa datos administrativos mínimos y asume solo un owner grant si está verificado.
- Usuario nuevo elige registro personal + "Registrar mi empresa"; se reconcilia con flujo existente `createUserWithOrg` (no crear Org adicional).
- El sistema impide crear Org con identidad/tenant incorrectos o reclamar una existente por simple coincidencia de nombre comercial; duplicados requieren revisión legal/administrativa.
- Panel inicial: nombre, zona horaria, datos de contacto, oficios, propietario y confirmación de políticas de tratamiento de datos.

### HU-02 — Envío desde "Equipo de trabajo"
- Dueño entra al proyecto o a Equipo → Invitar, introduce contacto(s), `WORKER` por defecto, vigencia y opcional scope de obra/cuadrilla. Puede elegir canal "Copiar enlace" y pegarlo en WhatsApp. No se invita por un único token público para todos.
- Mensaje: "La compañía [nombre] te invita a SEMSE como [rol]. Esta invitación es personal, vence el [fecha] y no te obliga a activar ubicación. Revisa y acepta en el enlace." El enlace y aviso no deben incluir salario, datos de clientes ni otros nombres de trabajadores.
- Lista del admin: destinatario parcialmente enmascarado, estado, rol, fecha de emisión, vencimiento, último envío, quién invitó y acciones Reenviar/Cancelar; no mostrar secretos tras entrega.

### HU-03 — Trabajador que todavía no tiene SEMSE
- Abre URL HTTPS/deep-link, lee empresa, rol y aviso de privacidad/identidad; ingresa y **verifica el mismo correo/teléfono al que se destinó la invitación**. Si hay enlace reenviado a otro dispositivo, autenticación/OTP obliga a demostrar identidad del destinatario; no basta poseer la URL.
- Si no existe `User`, crea **User sin crear Org propia** en flujo atómico acotado a invitación, credenciales seguras y verificación del destinatario; después acepta invitación. No permitir cuenta invitada sin una membership ACTIVE o una sesión temporal de onboarding con scopes mínimos.
- Tras aceptación, se asigna `Membership` ACTIVE para la Org correcta (usando roles existentes); solo entonces puede abrir el contexto del proyecto autorizado. En una pantalla aparte se muestran horarios, obra, supervisor, tareas y consentimiento opcional de geolocalización.

### HU-04 — Trabajador que ya tiene SEMSE
- Abre enlace, inicia sesión, demuestra control del contacto destinado, acepta la Org adicional; conserva el mismo `User.id`, evidencia histórica y memberships previas.
- No se edita la Org de otra empresa. Si `Membership` equivalente existe y está ACTIVE, responder "Ya perteneces a esta organización" de modo idempotente; si está SUSPENDED/REVOKED, reingreso requiere política de reinstalación/autorización, sin auto-restauración.

### HU-05 — Cambio o baja
- Dueño revoca invitación PENDING o suspende membresía ACTIVE con motivo y alcance. Nuevas solicitudes a tareas, horas, documentos y APIs vinculadas a esa Org se deniegan según política, aunque quede un JWT emitido con roles obsoletos; investigación técnica requiere mecanismo de invalidación/binding sin consultas BD indiscriminadas en cada ruta.
- Historial de trabajo, fotos, autoría y aprobaciones queda atribuido al `User.id` original con retención contractual; no se borra la cuenta ni otra membresía.
- Transición de trabajador a encargado necesita concesión autorizada y registro independiente de scope de cuadrilla, no reutilizar el enlace de WORKER para elevar privilegios.

### HU-06 — Sin smartphone
- Invitación usable en navegador web con accesibilidad ES/EN; cuando no haya dispositivo/correo, patrón registra un candidato en estado NO_ACTIVO y un operador autorizado puede verificarlo de manera presencial y asignar credenciales/medio alterno individual; no asumir ni falsificar aceptación del trabajador.
- Para fichaje en quiosco, autenticación por persona y acción firmada por el operador/worker, nunca reloj en nombre de otro sin traza de representación; depende de desarrollo de un slice separado.

## 5. Modelo de datos aditivo propuesto (no ejecutar migración todavía)
**Mantener** `Tenant`, `User`, `Org`, `Role`, `Membership` y sus propietarios actuales. Proponer entidad nueva exclusivamente para gestionar invitación pre-aceptación:

```ts
type OrgInvitation = {
  id: string;                 // ID aleatorio no secuencial, índice por tenant/org
  tenantId: string;
  orgId: string;              // debe pertenecer al mismo Tenant
  inviterUserId: string;
  invitedContactType: "EMAIL" | "PHONE";
  invitedContactNormalized: string; // PII cifrada/normalizada, protegida
  invitedContactHash: string;       // hash/HMAC indexable para dedupe; sin diccionario offline
  roleKey: string;           // role permitido al crear, jamás editable por link
  optionalCrewId?: string;   // solo sugerencia, asignación validada separada
  optionalProjectId?: string;
  tokenHash: string;         // sha256 del secreto aleatorio ≥256 bits; NUNCA token claro
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELED" | "EXPIRED";
  expiresAt: Date;           // default de producto sugerido: 7 días, configurable
  acceptedByUserId?: string;
  acceptedAt?: Date;
  lastSentAt?: Date;
  canceledAt?: Date;
  canceledByUserId?: string;
  idempotencyKey: string;    // único (tenantId,orgId,requester,request-key)
  createdAt: Date;
  updatedAt: Date;
};
```

**Invariantes y restricciones:**
- FK `OrgInvitation.orgId -> Org.id`, `inviterUserId/acceptedBy -> User.id`; referential tenant equality verificada por service+repository/índices (no inferir que el FK aislado comprueba el tenant). Validar `roleKey` contra roles reales; no inventar role IDs.
- Índices `(tenantId,orgId,status,createdAt)`, `(orgId,invitedContactHash,status)`, `(tokenHash)` UNIQUE; transacción atómica con comparación de estado+vencimiento+contacto verificado al aceptar.
- El token **no** forma parte de `Membership`, mensajes, logs, Analytics, Prometeo, emails de soporte ni respuestas GET. Registro de delivery y audit solo con `invitationId`, nunca con URL completa.
- No crear `Membership` para correo aún desconocido; al aceptar `Membership` ACTIVE se crea/actualiza en transacción. Si existe otra fila de roles ACTIVE del mismo usuario y Org, no permite escalar por simple aceptación sin autorización.
- `Membership.status` es por fila/rol. La suspensión de un empleado debe revocar **todos** los roles efectivos de esa persona en la Org o los seleccionados de modo inequívoco; nunca dejar privilegios residuales por cambiar solo la primera fila.
- Candidato, invitación y `User` son conceptos distintos. Bulk-import de 200 contactos debe crear 200 invitaciones, no 200 cuentas ficticias ni 200 Organizaciones.
- Al reenviar: invalidar token anterior con rotación atómica, nueva expiración, registrar evento. Responder idempotentemente a repetición; no devolver links antiguos.
- Consentimiento de ubicación y contrato de empleo son flujos separados, no implícitos por `ACCEPTED`.

## 6. Máquina de estados (FSM) de invitación
```text
CREATED (transacción) -> PENDING
PENDING -> ACCEPTED    [destinatario autenticado/verificado + policy + token vigente + org activa]
PENDING -> DECLINED    [destinatario verificado decide no unirse]
PENDING -> CANCELED    [owner/admin autorizado revoca]
PENDING -> EXPIRED     [expira; transición lógica si job tardó]
ACCEPTED/DECLINED/CANCELED/EXPIRED -> terminal
REENVIAR = rotación de token sobre PENDING o NUEVA invitación auditada según decisión de diseño.
```
Nunca aceptar una invitación terminal, revocada, de otra organización, con rol cambiado, ni tras el vencimiento. Dos POST concurrentes con el mismo token: una sola transición/membership; otro retorna estado idempotente sin repetir auditoría/elevación. Eventual invitación con contacto erróneo debe cancelarse, no cambiarle destinatario manteniendo token.

`Membership` preexistente: `ACTIVE/SUSPENDED/REVOKED` según gobierno; no asumir que cambiar a INVITED por mera emisión sea necesario ni seguro. La sesión de un usuario aún sin Membership usa autenticación restringida de onboarding, no acceso general al tenant.

## 7. Contratos REST **PROPUESTOS** (sujetos a patrón de rutas, Zod y revisión)
Todas las rutas usan `/v1/`, respuestas `ok(requestId,data)`, JWT/tenant/org resuelto del servidor salvo la vista inicial y el flujo de registro restringido. Elegir nombres finales tras inventario de posibles rutas existentes.

### 7.1 Crear invitaciones (privado)
```http
POST /v1/organizations/:orgId/invitations
Authorization: Bearer <token de dueño/admin>
Idempotency-Key: <uuid>
Content-Type: application/json

{
  "recipients": [
    {"email": "electricista1@example.com", "role": "WORKER", "projectId": "prj...", "crewId": "crw..."},
    {"email": "electricista2@example.com", "role": "WORKER"}
  ],
  "expiresInDays": 7,
  "delivery": "EMAIL"
}
```
**Response 201/207 propuesto:** por destinatario `{invitationId,status,expiresAt,deliveryStatus,recipientMasked}`; si se elige "Copiar enlace", **solo** creador autorizado obtiene una única visualización efímera del URL al crear/rotar, no en listados ni logs; el frontend debe protegerlo. El motor de entrega puede enviar enlaces directamente, sin exponer token al cliente administrador salvo caso de copiado explícito. Rate limit por Org/admin/canal, techo de lote a fijar por producto, y protección contra abuso/scraping.

**Server checks:** `orgId` de ruta realmente pertenece al tenant y actor tiene membership y delegación válida; rol en allowlist; `projectId`/`crewId` pertenecen a Org/scope autorizado; no invitar owner/admin sin step-up. Contacto normalizado; duplicados individuales gestionados sin elevación; fallo parcial batch no debe enviar invitación inválida. No JSON de error que revele si email ya tiene cuenta.

### 7.2 Inspección y gestión (privado)
```http
GET    /v1/organizations/:orgId/invitations?status=PENDING&cursor=...
POST   /v1/organizations/:orgId/invitations/:id/resend
POST   /v1/organizations/:orgId/invitations/:id/cancel
GET    /v1/organizations/:orgId/members   [existente, ampliar solo si guarda permisos]
PATCH  /v1/organizations/:orgId/members/:userId/status [PROPUESTO, política específica]
```
`resend` genera token nuevo, invalida anterior, preserva historia de envíos. `cancel` requiere motivo y auditoría. Nunca publicar emails completos a encargado sin permiso de lista HR.

### 7.3 Vista previa, canje y aceptación (restringido)
```http
POST /v1/invitations/preview
{ "invitationId": "...", "token": "<secreto>" }
```
Retorna solo `{companyName,roleLabel,expiresAt,maskedDestination,termsVersion,requiresLogin}`; caché `no-store`. Preview NO consume token ni crea sesión. Limitar IP/dispositivo, no filtrar existencia de usuario.

```http
POST /v1/invitations/accept
Authorization: Bearer <identidad autenticada o sesión de onboarding restringida>
Idempotency-Key: <uuid>
{ "invitationId": "...", "token": "<secreto>", "contactProof": "<verificación servidor>", "acceptedTermsVersion": "..." }
```
El backend verifica, en transacción, contact proof ligado al destinatario, secreto hash en constant-time cuando corresponda, estado PENDING, expiración, Org/tenant, invitor autorizado y rol legítimo. Inserta `Membership` ACTIVE, finaliza invitación y graba auditoría/outbox de forma transaccional. Regresa `{membership:{orgId,role,status:"ACTIVE"}, next:"ONBOARDING"}`, **no** token compartido/extra roles.

**Nuevo usuario:** ruta separada de creación de identidad personal para invitación (`POST /v1/auth/register-invited` como candidato) con prueba de posesión del contacto; **no llama `createUserWithOrg()`**. Provisiona `User` + perfil y acepta invitación en transacción o etapas idempotentes seguras (si falla, identidad onboarding sin recursos ni privilegios), emite sesión vinculada a membership ACTIVE solo tras commit. Evitar `SEMSE_DEFAULT_TENANT_ID` no comprobado como lugar de pertenencia, usar `Org.tenantId` del registro validado.

**Ya registrado:** login habitual y acceptance de membership adicional. La UI no promete cambio de contexto de sesión automático si auth no lo soporta; debe resolver org/proyecto de forma autoritativa conforme F10 y ADR-040. Posible "Abrir organización" mediante contexto verificado, no asignar un `orgId` arbitrary en frontend/JWT.

### 7.4 Errores estables (propuesta)
- `400` input inválido; `401` autenticación o prueba de contacto ausente; `403` falta capacidad, membership o scope; `404` resource privado inexistente/no autorizado (evitar enumeración); `409` estado terminal, duplicado/rol incompatible o conflicto de aceptación; `410` invitación vencida/cancelada para destinatario ya autenticado; `422` destinatario/relación de proyecto incoherente; `429` abuso/ratelimit.
- En endpoints públicos, diferenciar expirado/cancelado solo cuando el poseedor ya está verificado y no permita enumerar cuentas. Mensajes neutrales: "No fue posible usar la invitación; solicita una nueva a tu administrador".

## 8. Validaciones críticas y modelo de amenazas
**P0 de no-release:**
- Invitación por WhatsApp reenviada a un tercero: sin proof del destinatario, no obtiene Membership.
- Link EXPIRED/CANCELED/ACCEPTED o token rotado no activa usuario.
- Usuario de Org A o lead sin capacidad intenta emitir enlace para Org B/otro tenant: denegado antes de acceso a datos.
- Se altera `role`, `orgId`, `projectId`, `crewId` desde navegador o payload de accept: backend ignora fuente no autoritativa.
- Dueño invita `OPS_ADMIN` o se concede permiso mayor que el suyo: denegar siempre salvo flujo explícito y excepcional de gobernanza.
- `GET` privado/notification/log/referrer filtra token secreto o información personal del invitado: bloquear release.
- Revocación tras emisión de JWT: nuevas acciones sensibles deben fallar cerradas por revocation version/authorization binding y sesiones invalidables. Resolver sin introducir DB lookup indiscriminado que repita incidentes; p.ej. checks de membresía/epoch cacheados con fail closed y TTL de seguridad evaluado, más revocación en refresh/operaciones críticas.
- `Org.tenantId` inconsistente, membership de otro proyecto, compartir payroll/evidence con GC por defecto: denegado.
- Reintentos concurrentes y caída tras enviar correo: un solo invite/membership; outbox idempotente; evitar dos enlaces válidos si se rota.
- El proveedor de WhatsApp/correo o Prometeo no es fuente de autoridad ni recibe la matriz completa de HR, tokens persistidos o secretos.

**Privacidad:** mínimo PII, guardar destinatario normalizado protegido y hash para dedupe, retención definida para invitaciones fallidas, consentimiento de comunicaciones, DSR/export según política. No usar el consentimiento de pertenencia como autorización para rastreo de ubicación continua. Enumerar logs y analytics de URL/referrer/CDN/proxy. Evitar renderizar social preview con secreto en páginas con bibliotecas de terceros.

**Abuso:** throttling por IP/actor/org/destino, límites de envíos diarios y reintentos, contención de SMS/WhatsApp de pago, monitoreo de fraude y revocación masiva. La aplicación nunca debe mostrar "este email ya tiene cuenta" a quien no esté autorizado.

## 9. Eventos y auditoría
Propuestas de eventos versionados:
- `organization.member_invitation.created.v1`
- `organization.member_invitation.sent.v1`
- `organization.member_invitation.resent.v1`
- `organization.member_invitation.accepted.v1`
- `organization.member_invitation.declined.v1`
- `organization.member_invitation.expired.v1`
- `organization.member_invitation.canceled.v1`
- `organization.membership.activated.v1`
- `organization.membership.suspended.v1`
- `organization.membership.revoked.v1`

Cada evento: `tenantId`, `orgId`, `invitationId` o `userId`, `actorUserId`, `requestId/correlationId`, `occurredAt`, `sourceChannel`, resultado de policy y razón cuando corresponda. PII enmascarada, jamás secretos. Efectos de entrega usan outbox y reintentos sin duplicar la membresía. La traza auditada no confunde "correo enviado" con "aceptación" ni "aceptación" con "trabajador asignado a una obra".

## 10. Pantallas y accesibilidad
**Panel dueño:** Equipo (lista), Invitar trabajador (uno/lote), Invitaciones pendientes/expiradas, Detalle de membresía/roles, Roles y permisos por proyecto/cuadrilla, Suspender/revocar. Microcopy en español e inglés, accesibilidad VoiceOver/TalkBack y soporte móvil. Vista solo para admin autorizado; información HR separada de uso de GC.

**Web/móvil trabajador:** preview de nombre compañía, identidad de destinatario parcialmente enmascarada, rol, breve explicación de datos, Acceder/Registrarse, verificación de contacto, Aceptar/Rechazar, confirmación. Después: obra asignada, encargado, jornada (8×5 o 10×4 según admin), descansos, tareas, reloj, evidencia, permisos opcionales de GPS. Invitar no inicia reloj ni genera horas.

**Compartir URL:** Botón "Copiar invitación" genera un link individual seguro a compartir; previsualizar el nombre sin abrir datos privados; vencimiento visible; responsable puede revocarlo. Preferir botón nativo Compartir (iOS/Android) o distribución verificada por proveedor. Para empleados sin dispositivo, flujo de credenciales asistido independiente.

## 11. Criterios de aceptación detallados (BDD)
1. **ACC-01 Alta de dueño:** GIVEN owner PRO ya dispone de Org; WHEN habilita Equipo; THEN reutiliza la Org y no crea otra.
2. **ACC-02 Lote de 20:** GIVEN owner invita a 20 correos verificados; WHEN envía; THEN 20 identificadores de invitación únicos, cada uno con token independiente, nunca 20 nuevas Orgs/Users falsas.
3. **ACC-03 Usuario nuevo:** GIVEN trabajador sin cuenta recibe link; WHEN verifica destinatario y acepta; THEN `User` personal y `Membership` ACTIVE en Org correcta, sin `Org` de auto-registro.
4. **ACC-04 Usuario existente:** GIVEN user activo en Org X acepta Org Y; THEN mismo `User.id`, dos membresías sin acceso cruzado a RRHH/evidencia.
5. **ACC-05 Sin prueba de contacto:** GIVEN enlace reenviado; WHEN tercero intenta aceptar; THEN 401/403, no se crea membership.
6. **ACC-06 Expirado y cancelado:** GIVEN token expirado/cancelado o rotado; WHEN se usa; THEN fail closed; no estado ACTIVE.
7. **ACC-07 Replay/race:** GIVEN 10 peticiones simultáneas de aceptación; THEN solo una creación/activación, registro de aceptación único, respuesta segura para reintentos.
8. **ACC-08 Rol manipulado:** GIVEN link WORKER y payload ADMIN; THEN sigue WORKER según registro validado o error, nunca ADMIN.
9. **ACC-09 Sin permiso:** GIVEN lead sin permiso invita; THEN deny y audit; el mero permiso `org:members:read` no autoriza invitar.
10. **ACC-10 Límite por scope:** GIVEN lead autorizado solo a Crew A; THEN no puede ver/invitar para Crew B sin delegación.
11. **ACC-11 Revocación:** GIVEN usuario con membresía de Org A y Org B; WHEN patrón A revoca A; THEN nuevas lecturas/escrituras de A fallan, Org B continúa según permisos, A preserva historial.
12. **ACC-12 Dueño protegido:** GIVEN solo owner activo; WHEN intenta revocarse/degradarse sin relevo autorizado; THEN 409/403 y auditoría.
13. **ACC-13 Sesiones antiguas:** GIVEN revocado tiene JWT no vencido; WHEN lee/edita recurso protegido A; THEN deny, no se confía solo en token.
14. **ACC-14 Red de terceros:** GIVEN GC sin membresía staffing; WHEN ve evidencia compartida; THEN recibe solo scope autorizado y ninguna nómina.
15. **ACC-15 Web y teléfono:** GIVEN un invite seguro; WHEN abrir desde iOS, Android, navegador sin app, app no instalada o enlace vencido; THEN landing y aceptación coherentes sin romper token ni exponer secretos en referrers.
16. **ACC-16 Fallo entrega:** GIVEN proveedor SMTP/SMS caído; WHEN crea enlace; THEN estado y error de envío trazables, reintento idempotente, ninguna membresía activada inadvertidamente.
17. **ACC-17 Intercambio de datos:** GIVEN contact proof destinado a otra identidad; WHEN se usa con token válido; THEN deny sin enumerar usuarios.
18. **ACC-18 Modo de trabajo:** GIVEN miembro nuevo sin proyecto asignado; WHEN entra; THEN ve "Pendiente de asignación", no datos de cualquier obra.
19. **ACC-19 Asistencia:** GIVEN trabajador acepta y proyecto 10×4; THEN la aceptación no inicia reloj ni permisos GPS; horario se carga de la configuración aprobada al asignar sitio.
20. **ACC-20 Privacidad:** GIVEN link copiado/reenvío/listados; THEN token solo en entrega controlada, nunca en logs, analytics ni visualizaciones de administración.
21. **ACC-21 Desconexión:** GIVEN aceptación offline; THEN UI explica que debe confirmarse online; no confiere membership local ficticia.
22. **ACC-22 Fallo a mitad de transacción:** GIVEN alta User aplicada pero sin Membership por falla; THEN transacción compensa o restringe User a onboarding, sin sesión tenant plena.

## 12. Estrategia de pruebas y verificación
- **Unitarios:** normalización email/teléfono, hash token, TTL, rol permitido, scope Org, invalidación, transiciones FSM, prueba de contacto, rate limit.
- **Integración DB:** `OrgInvitation` único, FK & tenant consistency, user-existing/new, transacción aceptada, replay/errores/rollback, membership status por rol, concurrencia y outbox.
- **Contrato API:** Zod exacto, REST status, never leak token, no enumeration, auth/authorization, `Idempotency-Key`, roles en dos organizaciones.
- **E2E web y mobile:** cuenta patrón -> lote -> distribución -> deep link -> login/registro -> OTP -> aceptación -> asignación -> revocación; iOS universal links, Android app links, sin app y low-bandwidth.
- **Seguridad P0:** cross-tenant, role escalation, stale-session access, token forwarded/reused/referrer/logging, abuse throttling, revoked connection and PII leak.
- **Regresión:** `POST /v1/auth/register` regular CLIENT/PRO sigue compatible; ninguna creación involuntaria de Org para WORKER; `GET /v1/users/me/capabilities` sin roles pegados; lectores actuales de `GET /v1/organizations` no pierden compatibilidad.
- **CI/CD:** antes de implementar crear child spec oficial SDD 2.0 y tests fallando; fases separadas schema + API + web/mobile + delivery + security; `pnpm spec:index`, `pnpm spec:validate:strict`, typecheck, unit/e2e, auth/tenant security suite. Verificar merge SHA exacto, Railway + mobile canary y documentación de evidencia antes de declarar operativo. No activación silenciosa en producción.

## 13. Plan técnico de entregas (PRs pequeños)
**P0 — Preflight:** revisar main exacto, verificar alta actual de compañías, Membership.status en BD/producción, rol WORKER, RBAC de invited user y mecanismos de invalidación de sesión; confirmar dominios y consentimiento por SMS/WhatsApp. Identificar cualquier implementación de invitaciones existente para reutilizarla.

**P1 — Esquema + FSM:** migración aditiva de `OrgInvitation`, índices, lifecycle, token hash, expiry, PII guard, auditoría, conjunto de tests unitarios+integración; feature flag OFF.

**P2 — Crear/listar/revocar/reenviar:** endpoints privados con RBAC específico, scope, delivery via outbox, enlace individual, límites y pruebas de abuso. Sin aceptación pública habilitada.

**P3 — Preview/aceptación existente:** validación de secreto+contact proof, membership/rol atómicos e idempotencia, UI web segura. Pruebas de multi-org y sesiones antiguas.

**P4 — Registro de nuevo trabajador invitado:** ruta separada que no llama `createUserWithOrg`, autenticación mínima de onboarding, contacto verificado, sesión final después de commit; UX ES/EN y fallbacks iOS/Android.

**P5 — Equipos/proyectos + baja:** asignación específica a Crew/Project, RBAC lead, revocación efectiva/invalidation, privacidad, historial y cuenta sin smartphone (kiosk en slice propio si no cabe).

**P6 — Producción controlada:** CI y seguridad verdes, aprobación de producto y legal, canary por tenant con 2 y luego 15–30 trabajadores; medir tasa de aceptación, duplicados, accesos, revocaciones y rollback; activar por policy. No escribir `VERIFIED` sin evidencia.

## 14. Dependencias y decisiones pendientes para el owner
- **D-01** ¿El dueño puede crear su Org con solo registro PRO existente o hay validación comercial/legal adicional? Recomendación: reutilizar PRO existente + verificación antes de poderes admin sensibles.
- **D-02** ¿Permitir invitaciones abiertas genéricas para compartir con 20 trabajadores? Recomendación: **no**; enlaces individuales y comprobación de contacto, con alta asistida para casos excepcionales.
- **D-03** ¿Qué canales están contratados y tienen consentimiento de comunicación (email/SMS/WhatsApp)? Implementación progresiva por proveedor disponible.
- **D-04** ¿Quién puede invitar encargados y qué accesos ven? Recomendación: owner/admin bajo autorización de Crew/Project, no role global genérico.
- **D-05** ¿Cuánto dura la invitación y cuántos reenvíos? Default sugerido 7 días; requiere aprobación de producto, coste/abuso.
- **D-06** ¿Dónde se verifica la identidad del receptor: correo, OTP SMS, presencia? Al menos el canal vinculado a invitación; verificación adicional para acceso privilegiado.
- **D-07** ¿Cómo se hace revocación oportuna sin volver a consultar BD en cada JWT request? Seguridad/auth owner debe aprobar invalidation y rendimiento.
- **D-08** ¿Qué grado de acceso histórico, retención y exportación conserva el trabajador al salir? Revisión contractual/legal.
- **D-09** ¿Cuándo pasa la invitación a tarea/sitio? Siempre en un paso aparte con confirmación del encargado/empleador y políticas del proyecto.
- **D-10** ¿Se dará soporte a trabajadores sin smartphone? Recomendación: sí, al menos por web y flujo presencial auditado.

## 15. Definition of Done y no-regresiones
- Owner ratifica D-01...D-10 y reglas de roles; threat model firmado.
- Spec trasladada/aprobada conforme gobierno SDD 2.0 e indexada; cada implementación enlaza ACC-XX/REQ-ORG-001...011, pruebas y evidencias.
- Endpoints de company invite create/manage/accept son funcionales con tests y observabilidad; no hay seguridad basada en link únicamente.
- Cero cuentas compartidas y cero Orgs duplicadas para trabajadores invitados en los escenarios cubiertos.
- Revocación efectiva incluso con JWT todavía vivo; no leaks de PII/token ni cruces org/tenant.
- Sin errores de salario por adhesión a Org; reloj/geofence solo según política y permisos independientes; integración con 8×5 / 10×4 es una responsabilidad del schedule engine.
- Canary autenticado por distintos roles y registros de producción vinculados al commit; rollback demostrado.
- Documentación de ayuda a administradores y trabajadores **solo cuando** el flujo real esté implementado, evitando instrucciones engañosas.

**Fuentes internas:** docs/architecture/ADR-040-ws01c-identity-organization-context.md; docs/specs/core/org-membership-status.spec.md; docs/specs/core/universal-identity-multi-role.spec.md; packages/db/prisma/schema.prisma; apps/api/src/modules/auth/{auth.controller,auth.repository,auth.service}.ts; apps/api/src/modules/organizations/organizations.controller.ts; packages/auth/src/rbac.ts. Especificación complementaria: ORGANIZATION_ENROLLMENT_AND_4X10_SHIFTS.md.
