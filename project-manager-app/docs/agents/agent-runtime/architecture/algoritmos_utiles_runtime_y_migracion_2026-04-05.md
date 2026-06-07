# Algoritmos Utiles para Runtime y Migracion

## Objetivo

Recordatorio operativo de algoritmos y heuristicas que conviene mantener en esta capa porque mejoran precision, estabilidad e idempotencia.

## 1. Precedencia deterministica de fuentes

Orden recomendado:

1. `RuntimeProviderAttachment`
2. `AgentMemory` legacy

Uso:

- evitar mezclar fuentes de manera no determinista
- asegurar que la UI muestre una sola version canonica por provider

## 2. Upsert idempotente por clave compuesta

Clave:

- `tenantId + provider`

Uso:

- backfill seguro
- reintentos sin duplicados
- sincronizacion repetible

## 3. Fallback controlado por feature flag

Flag:

- `SEMSE_RUNTIME_REGISTRY_ALLOW_LEGACY_FALLBACK`

Uso:

- apagar legacy de forma gradual
- comparar entorno por entorno
- cortar dependencia sin editar codigo otra vez

## 4. Heuristica de frescura

Senal:

- `updatedAt`
- `attachedAt`

Uso:

- preferir el registro mas reciente en procesos de reconciliacion
- detectar mirrors desactualizados

## 5. Deteccion de drift

Comparar:

- `mode`
- `status`
- `capabilities`
- `notes`

Uso:

- detectar diferencia entre tabla nueva y espejo legacy
- decidir si se puede retirar el espejo

## 6. Clasificacion de comandos

Ya aplicada en runtime:

- `ALLOW`
- `APPROVAL_REQUIRED`
- `BLOCKED`

Uso:

- bootstrap seguro
- auditoria reproducible
- operacion con politicas estables

## 7. Backfill incremental

Estrategia:

- recorrer legacy
- parsear payload
- validar provider
- hacer `upsert`
- reportar `scanned / migrated / skipped`

Uso:

- migraciones largas
- corridas repetidas
- auditoria de calidad de datos
