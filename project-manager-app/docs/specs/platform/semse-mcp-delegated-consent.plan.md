---
type: plan
feature: "S1/D7 — Consentimiento OAuth delegado persistente (fase B)"
domain: "platform"
spec: "docs/specs/platform/semse-mcp-delegated-consent.spec.md"
version: "2.0"
status: "REVIEW"
branch: "claude/new-session-jdxlw4"
date: "2026-10-26"
---

# Plan técnico: S1/D7 fase B — persistencia apagada

> Prerrequisito de fusión: spec `APPROVED` con evidencia documental de nivel 1
> (DEC-PLATFORM-001). La fase B se ha preparado en rama aislada, pero falta
> el comentario formal de aprobación de #1049 y reconciliar SKILL.md §12.
> Mientras tanto no se autoriza merge ni migración productiva.

## 1. Snapshot de verdad

- `origin/main` SHA: `c6d4d32` (merge de #1049).
- Producción: sin cambios; MCP inactivo; sin flag `MCP_S1_SERVER_ENABLED` en código.
- Migraciones: la de esta fase (`20261026022437_mcp_delegated_consent`) es aditiva y
  **no** se ha aplicado fuera de bases efímeras de CI/local.
- D2 (Authorization Server) sigue `PENDING`: la fase B no calcula ni valida
  tokens; recibe `grantBindingDigest` y la confianza (issuer/recurso/clientes) por
  inyección.

## 2. Constitution check

- [ ] Evidencia formal pendiente: comentario del propietario con SHA/fecha/alcance y reconciliación SKILL.md §12; fase B aún no fusionable
- [x] Tenant/org/ownership y RBAC definidos (§3 del spec, Q2, D7-05b)
- [x] Migración aditiva, sin FK ni DML (Q3, Q6-X1)
- [x] Sin ruta HTTP/MCP, sin módulo Nest registrado, sin flag productivo
- [x] Pruebas antes de declarar listo: unitarias + integración contra PostgreSQL real

## 3. Alcance de la fase B

| Pieza | Archivo | Notas |
|---|---|---|
| Modelo | `packages/db/prisma/schema.prisma` (`McpDelegatedConsent`) | Campos del §7; `userId`/`sessionId`/`grantBindingDigest` nulables solo para anonimizar |
| Migración | `packages/db/prisma/migrations/20261026022437_mcp_delegated_consent/` | CREATE TABLE + índices; únicos admiten varios NULL |
| Contratos | `packages/schemas/src/mcp-delegated-consent.schema.ts` | Estados, motivos, input de aceptación, TTL 30 días, retención 90 días |
| RBAC | `packages/auth/src/rbac.ts` | `mcp:consents:revoke:tenant` solo en `OPS_ADMIN` |
| Intersección de roles | `apps/api/src/modules/auth/session-roles.ts` | Extraída de `authorizedRoles`; la web conserva su semántica |
| Reglas puras | `apps/api/src/modules/mcp-consent/mcp-consent.policy.ts` | Expiración, roles sin override, org del grant, retención |
| Persistencia | `apps/api/src/modules/mcp-consent/mcp-consent.repository.ts` | Aceptación con `FOR SHARE`, revocación CAS, anonimización |
| Servicio | `apps/api/src/modules/mcp-consent/mcp-consent.service.ts` | `accept`, `authorizeRead`, `revokeOwn`, `revokeAsTenantOps`, `anonymizeDue` |

**Fuera de la fase B:** módulo Nest registrado, controller, flag, worker que
programe `anonymizeDue`, revocación masiva y admin de org (v1.1), flujo de
borrado de User/Org (no existe), ampliación de retención por tenant y legal hold
(no hay modelo de configuración), vínculo token↔grant real (D2).

## 4. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `OPS_ADMIN` lee todo el tenant vía `hasScopeAccess` | El rol operativo puro no concede lecturas MCP; con CLIENT/PRO se limita a esos permisos; `assertProjectInGrantOrg` obligatorio en C; D7-05b/05c |
| Grant creado durante el borrado del titular | `FOR SHARE` sobre `AuthSession` y `User` en la transacción del INSERT; prueba D7-23 con barrera y prueba de mutación (sin `FOR SHARE` falla) |
| Lectura que escribe | Pruebas D7-13 con extensión Prisma que bloquea no-SELECT |
| Refactor de `authorizedRoles` cambia la web | Función pura con la misma semántica; prueba S1 de sesión/membership en PostgreSQL sigue verde |

## 5. Validación (nivel 2 de DEC-PLATFORM-001)

- Unitarias: `apps/api/test/mcp-d7-consent-policy.test.ts`.
- Integración PostgreSQL real: `apps/api/test/mcp-d7-delegated-consent-integration.test.ts`
  (la ejecuta el workflow `API Integration` en cada PR que toca `apps/api`).
- D7 comparte un deadline monotónico de 1000 ms; D2 deberá iniciar el mismo presupuesto antes de introspección.
- Dos revisiones automatizadas de herramientas distintas, pausa de 24 h y
  autorrevisión del propietario con checklist antes de fusionar.
