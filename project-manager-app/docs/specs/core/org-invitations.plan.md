# Plan — BO-01 org-invitations
- Base: main c47ce504. Aditivo: tabla nueva, sin tocar Membership ni auth/register.
- Service `InvitationsService` con repositorio Prisma; token = `crypto.randomBytes(32)` base64url, hash sha256, comparación por lookup de hash único.
- Autorización: `resolveRequestContext` + membresía ACTIVE en la Org objetivo + permiso RBAC. Preview/accept requieren sesión (accept) o token (preview) y flag.
- Flag leído de env en cada request (`SEMSE_ORG_INVITATIONS_ENABLED === "true"`).
- Auditoría con el catálogo existente; si no hay acción adecuada, registrar solo `invitationId`.
- Rollback: apagar flag; la tabla nueva puede quedar sin uso.
