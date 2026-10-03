# Lote crítico — Governance tenant boundary

**Fecha:** 2026-07-25
**Hallazgo:** `3.10b` / `NEW-GOV-01`
**Spec:** `api.governance-tenant-boundary` v1.1

## Resultado

Governance ya no acepta tenant ni actor desde body/query. El controller deriva
`tenantId`, `authorId` y `voterId` del contexto autenticado y pasa el tenant a
todas las operaciones por ID.

El service:

- busca propuestas por `{ id, tenantId }`;
- filtra votos incluidos por el mismo tenant;
- filtra también `_count.votes` por el mismo tenant;
- persiste `GovernanceVote.tenantId` desde la propuesta ya validada;
- no escribe voto ni estado para un ID de otro tenant;
- hace que vote/close adquieran el mismo row lock transaccional antes de
  insertar o contar votos;
- cierra mediante update condicionado por `{ id, tenantId, status: "open" }`;
- devuelve 409 para la carrera de voto duplicado.

RBAC quedó separado por acción: CLIENT/PRO/OPS_ADMIN pueden leer, proponer y
votar; solo OPS_ADMIN recibe `governance:close`.

Las cinco rutas BFF de Governance usan
`fetchSemseDataForAuthenticatedRequest()` y no reenvían `tenantId`, `authorId`
o `voterId` del navegador.

## Validación local

- API build: verde.
- Governance controller/service + RBAC + BFF/boundary: 56/56 tests verdes.
- Builds `@semse/auth` y API: verdes.
- Web TypeScript: verde.
- Web lint: 0 errores; warnings legacy fuera del lote.
- Specs: 105 válidas en strict, 0 errores/0 warnings.
- Cobertura del plan: 159/159, sin faltantes ni extras.

## Seguimiento de incidente

No hubo acceso a la base productiva en este lote. Debe ejecutarse una auditoría
de integridad sobre datos históricos para localizar votos donde
`GovernanceVote.tenantId` difiera del `GovernanceProposal.tenantId` relacionado.
No se reescribieron datos antiguos automáticamente.
