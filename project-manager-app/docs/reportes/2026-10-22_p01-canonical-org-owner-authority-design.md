# P-01 — Verificación canónica de propietario y representante empresarial
**SEMSE Project | Corte: 2026-10-22 | Estado: PROPUESTA TÉCNICA DOCUMENTADA, NO APROBADA EN SU IMPLEMENTACIÓN**  
**Relacionado:** PR #1027 (documental Draft) · OPEN-SUP-01 / P-01  
**Regla funcional ratificada:** solo el propietario o representante autorizado **y verificado** de una compañía puede nombrar, sustituir o revocar supervisores.

## 1. Inventario AS-IS confirmado en main

1. `apps/api/src/modules/auth/auth.repository.ts:252-293` —
   `createUserWithOrg({ roleKey: CLIENT|PRO, tenantId })` crea
   `User` (`verificationStatus: "unverified"`), `Org`,
   `Membership` y `UserProfile` en una transacción. Solo persiste
   `Org(tenantId,type,name)`; no inserta una declaración verificable
   de titularidad ni un `OWNER` empresarial. El primer registro
   constituye **origen histórico**, no prueba suficiente de ownership.
2. `apps/api/src/modules/auth/auth.service.ts:403-447` —
   `register` obtiene `SEMSE_DEFAULT_TENANT_ID` o `tenant_default`
   y llama a `createUserWithOrg`. No equivale a registrar/validar
   legalmente una compañía, ni hay que duplicar `Org` al habilitarlo.
3. `packages/db/prisma/schema.prisma` — `Org` tiene `id`,
   `tenantId`, `type`, `name` y relaciones, sin `ownerUserId`
   ni tabla de representación verificada; `Membership` es
   `(userId,orgId,roleId,status)` y sus roles
   `CLIENT/PRO/WORKER` son capacidades de plataforma.
4. `apps/api/src/modules/organizations/organizations.repository.ts` —
   `GET organizations` se limita por membresía ACTIVE de la Org
   destino y permisos (salvo excepción interna OPS_ADMIN acotada a tenant),
   pero **no es un registro de autoridad empresarial**. No reutilizar
   `org:read`, `org:crews:manage` ni selector de contexto como
   sustitutos de titularidad.
5. `docs/specs/core/business-access-foundation.spec.md` (`APPROVED`,
   implementation parcial) reconoce el riesgo de sesiones obsoletas.
   La nueva policy debe consultar estado efectivo/REVOCATION; no
   confiar en JWT o roles globales.
6. `docs/program/semse-4d-field-memory/COMPANY_INVITATIONS_DETAILED_SPEC.md`
   ya contempla *owner grant* verificado y reconciliación con
   `createUserWithOrg`, sin crear `CompanyWorkspace` paralelo.
7. `docs/specs/core/business-offers.spec.md`: decisión owner 2026-10-18
   de no inferir W-2/1099; oferta/engagement separados; solo owner y
   OPS_ADMIN para ofertas según esa decisión. No extrapolar permiso
   de ofertas al de designación de supervisores; reconciliar el
   permiso de ofertas en slice propio.

**Conclusión:** existen identidad personal, organización y membresía;
NO hay en estas rutas evidencia server-side de dueño/representante
VERIFICADO. `User.verificationStatus` también es insuficiente:
verifica identidad personal, no la relación con la compañía.

## 2. Reglas ya decididas vs. propuesta de implementación

### Aprobado (intocable sin nueva decisión)

- Solo propietario/representante autorizado y verificado de **ESA** Org
  puede nombrar o revocar supervisores de cuadrilla.
- CLIENT/PRO/WORKER y OPS_ADMIN no obtienen esta facultad por su rol.
- La política es backend, por recurso, fail-closed; no se infiere de
  `createdAt` o primera Membership.
- Una sola `User.id` puede servir a múltiples Orgs; independencia
  de ingresos, relaciones contractuales y datos.
- CI manual como último gate de preparación, **antes del merge**.

### Propuesta técnica — requiere ratificar el SDD

Crear un agregado canónico y acotado al Org, por ejemplo
`OrgAuthorityGrant` (**nombre tentativo; verificar si existe
un modelo genérico de grants adecuado antes de implementar**):

| Campo | Contrato |
|---|---|
| `id`, `tenantId`, `orgId`, `subjectUserId` | Vinculación explícita actor-empresa |
| `authorityType` | `OWNER` o `AUTHORIZED_REPRESENTATIVE` (no roles globales) |
| `permissions` | Alcance positivo: solo `org:supervisors:delegate` en este slice |
| `status` | `PENDING_VERIFICATION / ACTIVE / SUSPENDED / REVOKED` |
| `validFrom`, `validUntil?` | Ventana temporal, no herencia perpetua |
| `verifiedBy`, `verifiedAt`, `verificationMethod` | Fuente rastreable y revisor autorizado |
| `proofRef` | Referencia privada a evidencia, nunca documentos en API de supervisor |
| `grantedBy`, `reason`, `revokedAt`, `revokedBy` | Cadena de legitimidad auditable |
| `version`, `createdAt`, `updatedAt` | CAS, no duplicados y transiciones seguras |

Las credenciales/documentos usados para verificar representación
**no deben guardarse** en texto plano de notas, audit logs, workers,
Prometeo ni `OrgAuthorityGrant`. Una referencia segura a Evidence/Storage
u otro almacén aprobado requiere política de acceso, retención y
consentimiento propios; esto no implica activar la Biblioteca Técnica
ni copiar documentos legales a un tenant curado.

### Verificación de autorización en backend

```text
authorizeDelegateSupervisor(actor, targetOrg, targetCrew, action)
  1. Authenticate active user/session (no header role elevation).
  2. Load real Org by targetOrg and require matching tenant.
  3. Require authorized active relation of actor to that Org;
     a bare membership is not evidence of ownership.
  4. Require an ACTIVE, verified, unexpired authority grant
     of type OWNER or AUTHORIZED_REPRESENTATIVE with
     permission org:supervisors:delegate, for target Org.
  5. Confirm the grant's verification proof/reviewer is trusted
     and has not expired or been revoked.
  6. Confirm target crew belongs to same org/tenant and is ACTIVE.
  7. Check action-specific rules (new/revoke/replace; target worker).
  8. Write state + audit atomically; use events only after catalog.
  9. Fail closed on missing/ambiguous/downgraded/stale authority.
```

**Nota de política:** se puede autorizar el rol CLIENT/PRO a
consultar/gestionar otros recursos si su Membership lo permite,
sin reconocerle la facultad de **designar** supervisores. Para
la representación, una cuenta PRO independiente con su propia empresa
deberá completar un onboarding de verificación antes del grant.
No deshabilitar de golpe el funcionamiento vigente de las demás rutas.

## 3. Bootstrap, empresa existente y representante

**Empresa nueva:** conservar `register()` y `createUserWithOrg()`,
crear únicamente un *claim* `PENDING_VERIFICATION` asociado a esa
Org y esa persona (o un registro de solicitud separado y seguro).
Crear Org no equivale a que ya sea OWNER verificado. Sólo el
proceso administrativo/humano autorizado puede activar la acreditación,
después de comprobar identidad, vínculo/representación y política
documentada. El primer registro conserva sus capacidades normales
CLIENT/PRO, pero no puede designar supervisores hasta validar autoridad.

**Empresa histórica:** no poblar automáticamente OWNER desde
`Membership`, antigüedad, email/domain, tipo `PRO`, primer
`User` de la compañía ni `Org.createdAt`. Crear un inventario de
Orgs existentes y proponer confirmación por lote sujeto a
revisión controlada; sin proof => no grant. No inventar una
verificación retroactiva ni bloquear sin plan de canary funciones
actualmente legítimas.

**Representante delegado:** se añade a la misma Org mediante una
`Membership` efectiva si el contrato lo exige, y obtiene un grant
de representante **únicamente por owner validado o proceso de
revisión independiente autorizado**. El representante no puede
asumirse propietario, crearse a sí mismo la prueba, subir sus
propios privilegios ni editar el tipo OWNER. El grant puede limitarse
a una duración y privilegios específicos; la revocación debe operar
en el siguiente request aun con sesión/token viejo.

**Protección del último owner:** prohibir la revocación o suspensión
que dejaría a la organización sin ningún OWNER verificado y vigente,
salvo un flujo de recuperación supervisada con evidencia independiente,
idempotencia y auditoría. La recuperación de empresa sin OWNER
verificable no se resuelve dando bypass a `OPS_ADMIN`.

## 4. Casos negativos y pruebas pre-código

| Test | Precondición | Resultado |
|---|---|---|
| OA-01 | CLIENT registró una Org, sigue `User.verificationStatus=unverified` y no tiene grant | no puede designar |
| OA-02 | PRO registró Org propia, Membership ACTIVE pero grant pendiente | no puede designar |
| OA-03 | PRO dueño con OWNER grant verificado ACTIVE, org/crew correctos | puede designar solo dentro de permisos aprobados |
| OA-04 | representante con grant ACTIVE específico | puede designar en su Org |
| OA-05 | PRO/CLIENT/WORKER de otra Org del mismo tenant | 404 neutro |
| OA-06 | OPS_ADMIN sin relación empresarial/justificación específica | no puede autoatribuirse titularidad ni designar silenciosamente |
| OA-07 | dueño/representante de otro tenant | 404 |
| OA-08 | OWNER grant vencido, suspendido o revocado y JWT anterior | denegar siguiente request |
| OA-09 | representante intenta elevarse a OWNER o nombrarse su propio verificador | denegar y auditar intento sin exponer evidencia |
| OA-10 | intento de revocar el último OWNER ACTIVE verificado | denegar con error de conflicto/recuperación controlada |
| OA-11 | claim duplicado o dos verificaciones concurrentes | un único resultado consistente (CAS + idempotencia) |
| OA-12 | worker designado de otra Org o crew archivada | rechazar, sin designación parcial |
| OA-13 | usuario PRO en Org A, WORKER en Org B | la prueba OWNER de A no se aplica en B |
| OA-14 | falla de DB/evidencia/revisor al comprobar autoridad | fail closed, sin fallback al rol |

Determinar API, errores, FSM, eventos, step-up y migración dentro
del contrato SDD específico. No programar antes de aprobación.

## 5. Riesgos de diseño y decisiones pendientes

1. **Prueba de titularidad:** quién puede verificar una empresa en
   SEMSE, qué documentos son admisibles, vigencia y recusación/conflicto
   de interés; requiere revisión de privacidad y cumplimiento, no
   bastan `User.verificationStatus` ni un email.
2. **Permisos de representante:** si delegación formal del OWNER,
   qué nivel de identidad/step-up requiere, expiración por defecto.
3. **Alcance de registro de Org:** el alta personal actual crea Org
   para CLIENT y PRO. Decidir en un programa separado cómo diferenciar
   Org personal, empresa real y claim empresarial, sin romper F10.
4. **Límites de OPS_ADMIN:** conservar accesos operativos previamente
   autorizados, pero no permitir autoasignación de titularidad ni
   nombramiento basado solo en el rol plataforma.
5. **Compañía sin owner tras migración:** recuperación controlada
   sin crear propietarios por inferencia; canary y comunicación de UX.
6. **Dependencia business-offers:** BO-05 todavía documenta
   `CLIENT/OPS_ADMIN` para `org:offers:manage`. No modificar
   su política en este programa sin reconciliar el contrato de ofertas.

## 6. Prioridad respecto de S0, CI y entrega

- P-01: inventario de fuentes de identidad/Org **completado**;
  propuesta técnica documentada, **implementación pendiente**.
- Integrar regla ratificada en `crew-supervisor-delegations.spec.md`
  y correlacionar backlog P-01 y tareas DOC-04b/S1.
- Seguir con P-02…P-06 y pruebas negativas S0-F01…F05 sin desactivar
  gates ni anticipar nueva tabla.
- CI manual e investigación de fallo histórico: **posponer al final
  de preparación**; antes de fusionar todo PR técnico.
- PR #1027 continúa Draft, sin merge, migrations, production, flags
  ni pruebas reclamadas.

## 7. Referencias locales

- `apps/api/src/modules/auth/auth.repository.ts` y `auth.service.ts`
- `packages/db/prisma/schema.prisma` (User, Org, Membership)
- `apps/api/src/modules/organizations/organizations.repository.ts`
- `docs/specs/core/business-access-foundation.spec.md`
- `docs/specs/core/universal-identity-multi-role.spec.md`
- `docs/program/semse-4d-field-memory/COMPANY_INVITATIONS_DETAILED_SPEC.md`
- `docs/specs/core/crew-supervisor-delegations.spec.md`
- `docs/reportes/2026-10-22_supervisor-backlog-pending-and-ci-last.md`
