# 2026-09-29 — Agro: fix de R8 (ZodError sin capturar → 500)

Continúa T-000 … T-055. Item 1 del plan de 5 gaps acordado tras el merge de T-055.

## Qué había

**R8**, documentado desde `AGRO_AS_IS_AUDIT_2026-09-25.md`: los controllers Agro
"existentes" (anteriores al patrón `parseWithSchema` que ya usaban
`agro-incident.controller.ts`, `agro-workforce.controller.ts` y
`agro-intake.controller.ts`) llamaban `schema.parse(body)` directo. Un
`ZodError` no es una `HttpException`, así que el filtro global
(`HttpExceptionFilter`, `@Catch()`) lo trataba como error no manejado →
**500** en vez de 400 para *cualquier* body inválido. Confirmado en código
real en T-053 (URL relativa en `fileUrl`), documentado como pendiente en
T-052, T-054 y T-055 sin asignarse nunca a una tarea propia.

## Diagnóstico antes de tocar código

`grep` de `Schema.parse(body)` (sin pasar por el helper) encontró **37 sitios
en 9 controllers**: `agro-animal`, `agro-inventory`, `agro-evidence`,
`agro-dashboard`, `agro-farm`, `agro-production-cycle`, `agro-economics`,
`agro-task`, `agro-traceability`. El helper correcto ya existía
(`common/zod-validation.ts`'s `parseWithSchema`, `safeParse` + `BadRequestException`)
y ya era el patrón usado por los 3 controllers "nuevos" — la corrección es
mecánica: reemplazar `X.parse(body)` por `parseWithSchema(X, body)` en cada
sitio, sin tocar ningún schema ni lógica de servicio.

Se consideró una alternativa (capturar `ZodError` en el filtro global,
`http-exception.filter.ts`) pero se descartó: hubiera sido un cambio de
comportamiento *global* (toda la API, no solo Agro) sin tests que lo cubran
fuera de Agro, y rompe la consistencia ya establecida en este código de que
la validación de body se maneja en el controller, no en el filtro.

## Qué cambió

- **9 controllers** (`apps/api/src/modules/agro/*.controller.ts`): import de
  `parseWithSchema` + reemplazo de los 37 sitios `Schema.parse(body)` →
  `parseWithSchema(Schema, body)`. Sin cambios de schema ni de servicio.
- **`agro-evidence-upload-integration.test.ts`**: el assert que documentaba
  la regresión (`relative.status === 500`) ahora afirma el fix
  (`=== 400`); comentario actualizado.
- **`agro-membership-operations-integration.test.ts`**: 2 asserts nuevos —
  body de tarea inválido (falta `type`) y de movimiento de inventario
  inválido (falta `movementType`) → 400, no 500. Se probaron ambos actores
  (`sup`) contra el permiso real de cada endpoint (`agro:report`, no
  `agro:write` — `createItem` sí exige `agro:write`, que `sup` no tiene a
  nivel de plataforma, por eso se usó `movements` en vez de `items` para
  mantener el assert enfocado en el bug, no en RBAC).
- **`AGRO_AS_IS_AUDIT_2026-09-25.md`**: fila R8 actualizada de "documentado,
  fuera de alcance" a "Corregido".
- **`agro-evidence-upload.spec.md`**: nota de actualización sin reescribir
  la narrativa histórica de T-053.

## Qué no se tocó

- Ningún schema Zod ni lógica de servicio — el bug era puramente de manejo
  de excepción en el controller.
- El filtro global de excepciones (`http-exception.filter.ts`) — se decidió
  no capturar `ZodError` ahí para no cambiar comportamiento fuera de Agro.
- Los 3 controllers que ya usaban `parseWithSchema` (incident, workforce,
  intake) — no necesitaban el fix.

## Verificación

- `pnpm build:packages` + `pnpm --filter @semse/api build` — limpio.
- Base de datos local (Postgres 16 nativo, sin Docker disponible en esta
  sesión) + `prisma migrate deploy` — todas las migraciones aplicadas sin
  drift.
- `apps/api/test/agro-evidence-upload-integration.test.ts` +
  `agro-membership-operations-integration.test.ts` (HTTP real, Postgres
  real): ambos verdes, confirmando 400 donde antes daba 500.
- `pnpm --filter @semse/api test:unit` (suite completa, no solo Agro):
  2529 pass / 0 fail / 1 skipped (el skip preexistente, no relacionado).
- `pnpm typecheck` (workspace completo, api+web+worker+mobile) — limpio.
- `pnpm lint` — 0 errores, mismos 36 warnings preexistentes (ninguno en los
  archivos tocados).
- `pnpm spec:validate:strict` — 0 errores/warnings, 143 specs.

## Backlog restante (de los 5 gaps acordados)

| # | Ítem | Estado |
|---|---|---|
| 1 | R8 — ZodError sin capturar | ✅ Este cambio |
| 2 | Activación en producción de `SEMSE_ASR_PROVIDER`/`VISION_OBJECT_PROVIDER` | Bloqueado por DPIA/legal |
| 3 | Reporte por audio en mobile | Bloqueado por decisión de producto (`expo-av`/`expo-audio`) |
| 4 | `visionSignals` no llega a mobile | Pendiente, sin decisión bloqueante — siguiente candidato |
| 5 | Dueño de finca sin membresía no ve su finca en mobile | Pendiente, requiere decisión chica de alcance |

También queda pendiente, fuera de este plan de 5 ítems: 3 vulnerabilidades
`fast-uri` (alta severidad, Dependabot) — 2 transitivas de `fastify` en
`apps/api` (dependencia real) y 2 de herramientas de build de `@angular/*`
(devDependency). Diagnosticado, no corregido en esta sesión.
