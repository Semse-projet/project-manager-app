# TaskPacket CP-F2 — Schemas compartidos

**Tasks:** T-020..T-025
**Estado:** COMPLETE
**Builder:** Schemas Builder
**Verifier futuro:** Contract QA Verifier
**Tasks digest autorizado:**
`sha256:3944e09d5ee55c84f2172847b61979e54cae0b62988e8c573e55e0094bcfd2ae`

## Allowed paths

- `packages/schemas/src/capability-control-plane.schema.ts`
- `packages/schemas/src/index.ts`
- tests/fixtures y tests F1 estrictamente necesarios para corregir el contrato,
  sin reducir assertions.

## Contrato

Implementar schemas Zod strict para manifest, installation, operation,
deployment plan, approval, execution grant, executor request y receipt.
Prohibir command strings, secrets literales, mutable tags, paths arbitrarios y
payloads no acotados. Exportar desde el owner canónico `@semse/schemas`.

## Verificación

- tests CP-001/004/008/013;
- `pnpm --filter @semse/schemas build`;
- lockfile/manifests existentes sin cambios.

## Stop conditions

No crear tipos duplicados en apps ni añadir dependencias. Detener si Zod actual
no cubre el contrato sin cambiar manifest/lockfile.

## Evidencia de salida

- schema canónico creado y exportado desde `@semse/schemas`;
- manifest/semver/digest/secret references, plans, approvals, grants, executor
  requests y receipts validados con objetos estrictos y límites;
- build `@semse/schemas` exitoso sin dependencia nueva.
