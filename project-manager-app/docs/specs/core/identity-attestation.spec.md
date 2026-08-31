---
id: "core.identity-attestation"
title: "Atestación de identidad firmada por un verificador separado"
domain: "core"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "high"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: []
production_evidence: []
related_files:
  - packages/db/prisma/schema.prisma
  - apps/api/src/modules/users/identity-attestation-signer.ts
  - apps/api/src/modules/users/users.repository.ts
  - apps/api/src/modules/users/users.service.ts
  - apps/api/src/modules/users/users.controller.ts
  - apps/api/src/modules/worker-verification/worker-verification.repository.ts
  - apps/web/app/(app)/worker/profile/page.tsx
  - apps/web/app/semse-api.ts
  - apps/web/app/api/semse/users/[userId]/identity-attestation/route.ts
related_tests:
  - apps/api/test/identity-attestation-signer.test.ts
  - apps/api/test/users.service.test.ts
related_endpoints:
  - v1/users/:userId/identity-attestation
  - v1/users/identity-attestation/public-key
related_events: []
related_agents: []
last_verified: "2026-08-29"
---

# Spec: Atestación de identidad firmada por un verificador separado

> Cierra AUDIT_REMEDIATION_PLAN.md 0.9 / G-PRO-04 (pro-flows-remediation.spec.md).
> Decisión de producto obtenida 2026-08-29 vía `AskUserQuestion` (usuario, dueño
> del producto): un proceso de verificación **separado** firma, no el propio
> profesional. Este spec documenta el diseño resultante e implementa el primer
> caso real (`id_document`), no un mecanismo genérico sin caller.

## 1. Problema y resultado

**Para quién:** Profesional (`PRO`/`WORKER`) cuya identidad debe leerse como
"verificada" de forma creíble · Cliente que confía en la promesa pública
"Profesionales verificados" · OPS_ADMIN que revisa credenciales reales.

**Problema:** El módulo `worker-verification` original modelaba una firma DID
**auto-atestada** — el propio worker generaba/enviaba `didSignature`/
`didPublicKey`. La investigación de causa raíz (0.9, 2026-07-22) encontró que
ningún cliente en todo el producto genera un keypair ni firma un challenge —
"verificar" esa firma habría sido teatro de seguridad. Se dejó fallando cerrado
(`verifyDidSignature` devuelve `false` siempre) en vez de aprobar cualquier par
de strings no vacíos, pero la superficie del producto siguió mostrando
"Sin verificar" para todo profesional, sin ningún camino real para cerrarlo.

Aparte, `users.controller.ts` ya tenía un flujo de solicitud→revisión
(`verify-request`/`review`, G-PRO-09/2.28) donde un OPS_ADMIN aprueba y el
sistema simplemente pone `verificationStatus: "verified"` — sin evidencia
criptográfica de ningún tipo, para los 4 tipos (`email`/`phone`/`id_document`/
`background_check`) por igual. Suficiente para email/phone; insuficiente como
respaldo de una promesa de marca sobre identidad.

**Resultado esperado:** Cuando un OPS_ADMIN aprueba una solicitud de
verificación de tipo `id_document` (después de revisar el documento real —
proceso humano, fuera de este spec), el sistema produce una **atestación
firmada criptográficamente** con la clave propia de SEMSE (nunca la del
worker), persistida como evidencia verificable de forma independiente, no solo
un flag en la fila de `User`.

## 2. Alcance

### Incluido

- Modelo `IdentityAttestation` (Prisma) — un registro inmutable por
  aprobación, no un estado mutable.
- Firma Ed25519 real (`node:crypto`, sin dependencia nueva) sobre un mensaje
  canónico (`tenantId`, `userId`, `verifiedByUserId`, `verificationType`,
  timestamp) — verificable por cualquiera que tenga la clave pública.
- Falla cerrado si `SEMSE_ATTESTATION_PRIVATE_KEY`/`SEMSE_ATTESTATION_KEY_ID`
  no están configuradas en un ambiente Railway — mismo patrón que
  `VISION_SERVICE_API_KEY`/`LIENGRID_API_KEY`/`LOB_API_KEY`. Clave efímera
  autogenerada solo fuera de Railway (dev/test), nunca persistida.
- Cableado dentro de `UsersService.reviewVerificationRequest()` — reutiliza el
  flujo ya correcto de G-PRO-09 (cola + revisión + `canVerifyUser`), no
  duplica un segundo sistema paralelo de aprobación.
- Endpoint de lectura self-o-admin (`GET /v1/users/:userId/identity-attestation`,
  mismo límite que `getUser`) y endpoint de clave pública
  (`GET /v1/users/identity-attestation/public-key`, cualquier autenticado) —
  esto último es lo que vuelve la firma verificable de verdad, no un artefacto
  ciego en la base de datos.
- UI: `/worker/profile` muestra la evidencia ("Identidad verificada por SEMSE
  el `<fecha>` — firma criptográfica, no autoatestada") cuando existe una
  atestación, además del badge "Verificado" que ya leía `verificationStatus`
  correctamente.

### Fuera de alcance

- `email`/`phone`/`background_check` siguen sin atestación firmada — no son
  la misma clase de afirmación ("identidad") que motivó G-PRO-04.
- Publicar la clave pública en un endpoint verdaderamente público
  (`.well-known`) para verificación por terceros externos a SEMSE — el
  endpoint actual exige solo autenticación, no anonimato.
- Rotación de claves — `keyId` ya viaja en cada registro para soportarla a
  futuro, pero no hay mecanismo de rotación en este pase.
- Retirar/reescribir el módulo `worker-verification` original (endpoints
  `/v1/workers/:id/sign` etc.) — ya falla cerrado desde 0.9, se deja intacto
  para no ampliar el blast radius de este cambio; queda documentado que es un
  sistema distinto, no reemplazado por este.
- Cualquier UI de administración nueva para "iniciar atestación" — se apoya
  en la cola de revisión que ya existe en `/admin/trust/worker-applications`.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| PRO/WORKER | (self, `AuthenticatedAccess` + `canReadUser`) | su propio registro | Leer su propia atestación | Crear o forzar su propia atestación |
| OPS_ADMIN | `users:verify` (ya existente, vía `reviewVerificationRequest`) | tenant | Aprobar `id_document` → dispara la firma | Leer/forzar la clave privada |
| Cualquier autenticado | `AuthenticatedAccess` | — | Leer la clave pública de SEMSE | Firmar en nombre de SEMSE |

- Tenant boundary: `IdentityAttestation.tenantId` filtra toda lectura.
- Ownership/resource policy: `canReadUser` (self o `OPS_ADMIN`), igual que
  `getUser`/`me/profile`.
- Step-up o aprobación humana: la aprobación del OPS_ADMIN **es** el paso
  humano — la firma nunca se dispara sin una revisión real vía
  `reviewVerificationRequest(decision: "approved")`.
- Datos `privacyCritical`: no aplica routing a Ollama; la clave privada
  nunca se expone vía API bajo ninguna circunstancia.

## 4. Diseño

`createIdentityAttestation()` (privado, `UsersService`) solo es alcanzable
desde `reviewVerificationRequest()` tras una aprobación real — no hay ningún
endpoint que lo dispare directamente, así que no puede ejecutarse sin que un
OPS_ADMIN haya aprobado primero.

```
PRO solicita (verify-request, id_document)
        │
        ▼
OPS_ADMIN revisa credenciales reales (fuera de este spec — proceso humano)
        │
        ▼ decision: "approved"
UsersService.reviewVerificationRequest()
   ├─ verifyUser() → User.verificationStatus = "verified"   (ya existía)
   └─ createIdentityAttestation()                            (nuevo)
         ├─ message = "semse-identity-attestation:v1:{tenantId}:{userId}:
         │              {verificationType}:{verifiedByUserId}:{timestamp}"
         ├─ signature = Ed25519.sign(message, SEMSE_private_key)
         └─ persiste IdentityAttestation { keyId, message, signature, ... }
```

La verificación (`verifyAttestationSignature`) es real y se prueba con un
vector fijo, un mensaje alterado (debe rechazar) y una firma basura (debe
rechazar sin lanzar) — no es un chequeo de truthy como el stub original.

## 5. Verificación de este pase

- `npx prisma migrate diff --from-empty --to-schema-datamodel` reproduce
  exactamente `20260829060000_identity_attestation/migration.sql` — no hay
  Postgres en este sandbox, así que la migración no se aplicó contra una base
  real.
- `tsc --noEmit` limpio en `@semse/api`. `apps/web` typecheck tiene el mismo
  error preexistente no relacionado en `labor-tool-client.tsx` (fuera de
  alcance, documentado en sesiones anteriores).
- `eslint` limpio en todos los archivos de `src`/`app` tocados.
- Suite completa de `@semse/api`: 2182/2190 (8 skipped, 0 fallos — sube de
  2171 por los 11 tests nuevos de este pase, incluyendo el roundtrip de firma
  real y el rechazo de mensajes alterados/firmas basura).
- Sin GitHub Actions real disponible en este repo desde 2026-08-19 (hallazgo
  de infraestructura ya reportado, fuera de este spec) — toda la verificación
  de arriba es local.
- No se pudo ejercitar el flujo end-to-end contra un servidor real (sin
  Postgres en este sandbox) — la cobertura es de unidad sobre `UsersService`/
  el firmante, instanciando las clases reales compiladas
  (`dist/modules/users/*.js`) con dependencias fake, no una reimplementación
  inline de la lógica.

## 6. Rollback considerations

- Si `SEMSE_ATTESTATION_PRIVATE_KEY`/`SEMSE_ATTESTATION_KEY_ID` nunca se
  configuran en Railway, cualquier aprobación de `id_document` en producción
  lanzará una excepción en vez de silenciosamente omitir la atestación — esto
  es intencional (fail-closed), pero significa que **la aprobación de
  identidad completa se bloquea** hasta que la clave exista. Generar y
  configurar esa clave en Railway (`semse-API`) es un prerrequisito de
  despliegue, no un detalle opcional.
- El registro es aditivo e inmutable — no hay migración de datos existentes
  ni riesgo de romper aprobaciones `email`/`phone`/`background_check` ya
  hechas (el `Set` de tipos atestables solo incluye `id_document`).
