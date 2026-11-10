# Reporte — 0.49b: la votación cuadrática gasta créditos de gobernanza

**Fecha:** 2026-11-10 · **Hallazgo:** `AUDIT_REMEDIATION_PLAN.md` 0.49b (entrada añadida en #1032) · **Spec:** [`api.governance-quadratic-credits`](../specs/api/governance-quadratic-credits.spec.md) (APPROVED por las decisiones del dueño PD-09 y D1–D3, 2026-11-10) · **Rama:** `fix/governance-quadratic-credits` · **PR:** pendiente

| SPEC | CODE | TEST local | CI | MERGE | DEPLOY | ACTIVATION | UAT |
|---|---|---|---|---|---|---|---|
| APPROVED | COMPLETE | PASS dirigido (12 fallos de entorno preexistentes en la suite) | PENDIENTE | NO | NO | Sin flag: activo al desplegar | NO |

## Proceso

`api.governance-tenant-boundary` (VERIFIED) excluye cambiar pesos o créditos, así que antes del código se escribió un spec propio. Ese spec recoge las cuatro decisiones del dueño:

- **PD-09:** el coste se paga con los créditos de gobernanza ganados, y lo gastado no se repone.
- **D1:** votar `k` unidades cuesta `k² − 1`; con una unidad, votar es gratis.
- **D2:** se mantiene la recompensa por votar.
- **D3:** si el saldo no alcanza, el voto se rechaza con el detalle.

## Cambios (sin migración)

- `governance-credits.algorithm.ts`:
  - `voteCost(k) = k² − 1`.
  - `computeCreditBalance`: lo ganado decae (vida media de 90 días, igual que antes); los `vote_spent` no decaen.
- `GovernanceService.castVote`: si el coste es mayor que 0, dentro de la misma transacción del voto:
  1. Toma un bloqueo consultivo por votante (`pg_advisory_xact_lock`, mismo patrón que `ai-pricing-catalog`).
  2. Lee el saldo; si no alcanza, responde 409 `{ cost, available, units }`.
  3. Registra `vote_spent` con créditos negativos.
- `getCredits`: `totalCredits` y `tier` siguen midiendo lo ganado; se añaden `spentCredits` y `availableCredits`.

## Impacto visible

Ninguno en la web actual. `admin/governance` vota siempre con `units: 1` (coste 0), y las insignias de tier siguen usando lo ganado. El coste solo aplica a votos de más de una unidad, que hoy solo se pueden emitir por API.

## Verificación

- `governance-quadratic-credits.test.ts`: 7/7. Con el código de `main` el archivo no carga (las funciones no existen), y su comportamiento (10 unidades gratis) tampoco pasaría el caso del 409.
- Tests de gobernanza: API 22/22, raíz 46/46.
- Suite API: 3975 pass / 12 fail, los mismos 12 de entorno de siempre.
- Validación SDD local con el spec nuevo indexado (218 specs): sin errores. `tsc` limpio y eslint sin errores.

## No verificado / pendiente

- **En vivo:** sin probar. El bloqueo consultivo, en concreto, no se ejecutó contra un Postgres real; el test comprueba que se pide antes de leer el saldo.
- **Al fusionar este PR y #1032:** marcar 0.49b como `[x]` y pasar su ruta a `CLOSED`.
- **UI:** si en el futuro la web deja elegir unidades, debe mostrar `cost` y `available` cuando reciba el 409.
