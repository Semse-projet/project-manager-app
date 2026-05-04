# Algoritmos Ecosistema — Refinamiento del bloque completo

- Fecha: 2026-04-19
- Estado: completado
- Precondición: `algoritmos_ecosistema_items_1_2_3_2026-04-19.md` + `algoritmos_ecosistema_items_4_5_6_2026-04-19.md`

## Huecos encontrados y corregidos

### 1. MatchingRepository no exportado — AgentTriggerRouter roto

**Problema:** `AgentTriggerRouter` inyectaba `MatchingRepository` directamente, pero `MatchingModule` solo exportaba `MatchingService`. El módulo hubiera fallado al arrancar.

**Fix:** `AgentTriggerRouter` refactorizado para usar `MatchingService.matchJob()` en vez de `MatchingRepository` directamente. `MatchingService` ya está exportado y hace exactamente lo mismo.

### 2. transitionJob no expuesto en el controller

**Problema:** `transitionJob()` existía en el service pero ningún endpoint lo llamaba. La FSM era código muerto.

**Fix:** Nuevo endpoint `POST /v1/jobs/:jobId/transition` en `jobs.controller.ts`:
- Body: `{ targetStatus: string }`
- Validación con Zod (enum de todos los estados válidos)
- Permission: `jobs:update`
- Retorna el job actualizado

### 3. Imports no usados en knowledge controller

**Problema:** `ParseIntPipe`, `DefaultValuePipe`, `Optional` importados y no usados — generaba warning potencial.

**Fix:** Eliminados.

### 4. Worker ejecutaba sleep antes del agente real

**Problema:** `await sleep(config.runDurationMs)` antes de `executeGovernedAgentRun()` — añadía latencia artificial simulada. Con handlers reales esto ya no tiene sentido.

**Fix:** `sleep(config.runDurationMs)` eliminado. El worker ejecuta el agente inmediatamente.

### 5. FTS query bug — `:*` solo en última palabra

**Problema:** `ftsQuery = "reparacion & techo:*"` — el prefix match (`:*`) solo aplicaba al último token. "reparacion" se buscaba como palabra completa, fallando en búsqueda por prefijo.

**Fix:** Cada token recibe su propio `:*`:
```
"reparacion:* & techo:*"
```

### 6. reasonCode null sobreescribía el valor del evento

**Problema:** `enrichDispute` retornaba `reasonCode: null` si la disputa en DB no tenía reasonCode estructurado. Esto sobreescribía el `reasonCode: "manual_open"` que venía del evento, dejando `buildDispute()` sin señal para clasificar.

**Fix:** Solo incluye `reasonCode` en el payload enriquecido si el DB tiene un valor concreto. Si es null, el valor del evento original se preserva.

### 7. GIN index registrado en Prisma migrations

**Fix:** Archivo de migración `20260419000100_workspace_memory_fts_index` creado y marcado como applied. El índice GIN estaba ya aplicado en DB pero no trackeado.

## Validación final del bloque completo

```bash
npx tsc --noEmit --project apps/api/tsconfig.json  # 0 errores
npm run build --workspace @semse/agents   # OK
npm run build --workspace @semse/autonomy # OK
npm run build --workspace @semse/api      # OK
```

## Estado final de todos los items + refinamientos

| Item | Estado |
|------|--------|
| Idempotencia DB-backed | ✅ |
| Dedup key único por evento+agente | ✅ |
| trust-match — candidatos reales | ✅ |
| dispute — scoring real con evidencia/contrato | ✅ |
| evidence-coach — scoring por tipos de archivo | ✅ |
| FSM de jobs — transitions + guard + evento | ✅ |
| FSM expuesta en endpoint | ✅ |
| Autonomía genera código real | ✅ |
| Prioridad en worker (dispute > pricing) | ✅ |
| Retry en event bus (3 intentos + backoff) | ✅ |
| FTS en knowledge (tsvector + ts_rank + GIN index) | ✅ |
| FTS prefix match correcto (token:* por token) | ✅ |
| Worker sin sleep simulado | ✅ |
| AgentTriggerRouter usa MatchingService correctamente | ✅ |
