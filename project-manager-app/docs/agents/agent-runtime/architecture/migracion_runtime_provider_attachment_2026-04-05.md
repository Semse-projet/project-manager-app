# Migracion a RuntimeProviderAttachment

## Objetivo

Mover el registro de providers adjuntos del runtime desde `AgentMemory` a una tabla dedicada, manteniendo compatibilidad temporal.

## Modelo nuevo

- Tabla: `RuntimeProviderAttachment`
- Ubicacion:
  `/home/yoni/app semse/project-manager-app/packages/db/prisma/schema.prisma`

Campos principales:

- `tenantId`
- `provider`
- `status`
- `mode`
- `capabilities`
- `notes`
- `attachedAt`

## Estrategia aplicada

1. Escritura principal en `RuntimeProviderAttachment`.
2. Se uso espejo temporal en `AgentMemory` durante la transicion.
3. Lectura prioritaria desde `RuntimeProviderAttachment`.
4. El fallback legacy ya fue retirado en codigo.

## Codigo involucrado

- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/agent-runtime/agent-runtime.registry.ts`
- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/agent-runtime/agent-runtime.service.ts`
- `/home/yoni/app semse/project-manager-app/packages/db/prisma/schema.prisma`

## Siguiente paso recomendado

Cuando la base este migrada y los registros esten consolidados:

1. opcionalmente eliminar o archivar registros legacy remanentes de `AgentMemory`
2. mantener el backfill solo como herramienta puntual de recuperacion
