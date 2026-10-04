# C51 — `credentials/user/:userId` exige tenant + (propio usuario | OPS_ADMIN | credencial publicada) (2026-10-04)

Decisión del dueño aplicada (3): mismo tenant y además el propio usuario, un OPS_ADMIN del ámbito o una credencial publicada;
la publicación solo permite los campos públicos, sin documentos ni datos privados.

## Antes
`GET /v1/intelligence/credentials/user/:userId` (solo `users:read`) devolvía el registro completo de CUALQUIER usuario del tenant:
`orgId`, `userId`, `tenantId`, `totalManaged` (monto gestionado), `activeProjects`, `lastActivityAt`. Nadie en web/mobile lo consume.

## Ahora (`credential-access.ts`)
- El registro se busca dentro del tenant del actor (otro tenant o inexistente ⇒ `null`, igual que antes; sin oráculo de existencia).
- Propio usuario u OPS_ADMIN del tenant ⇒ registro completo.
- Credencial publicada (`publicSlug`) ⇒ SOLO: `displayName` (saneado), `completedProjects`, `onTimeRate`, `disputeRate`,
  `avgClientRating`, `trustScore`, `specialties`, `badges`, `verifiedAt`, `publicSlug`.
- Credencial sin publicar de otro usuario ⇒ 403.
- Sin migración, flags, CI, Railway ni `rbac.ts`.

## Pruebas
`intelligence-credential-access.test.ts` (4): cross-tenant/inexistente ⇒ null (también OPS_ADMIN), sin publicar ⇒ 403,
propio/OPS_ADMIN ⇒ completo, publicada ⇒ solo campos públicos. Mutación (devolver el registro completo al publicado): falla 1 de 4.

## Hallazgos fuera de alcance (decisión del dueño)
- `GET /v1/intelligence/credentials/public/:slug` (público) devuelve el registro completo: expone `tenantId`, `userId`, `orgId`,
  `totalManaged`, `activeProjects` y `lastActivityAt`. Conviene aplicarle la misma proyección pública; no lo cambié porque es un contrato público.
- `GET /v1/intelligence/credentials/top` lista los registros completos del tenant a cualquier `users:read`.
C51 sigue PARTIAL.
