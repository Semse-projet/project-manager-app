# Refactor de Registro Runtime y Copiloto

## Objetivo

Separar la persistencia del runtime adjunto de la logica de servicio y convertir la telemetria del runtime en una senal estable dentro de `ProjectCopilotHarness`.

## Cambios aplicados

- Se creo `AgentRuntimeRegistry` como repositorio dedicado del modulo:
  - `/home/yoni/app semse/project-manager-app/apps/api/src/modules/agent-runtime/agent-runtime.registry.ts`
- `AgentRuntimeService` ya no administra directamente `agentMemory`; delega en el registro.
- `ProjectCopilotRuntimeView` ahora incluye `runtimeStatus`.
- `ProjectCopilotHarness` resuelve `runtimeStatus` dentro del runtime consolidado del proyecto.
- La UI del copiloto muestra el runtime operativo del host y los providers adjuntos.

## Estructura resultante

- `AgentRuntimeController`
  expone providers, status, audit, bootstrap y attach
- `AgentRuntimeService`
  compone host diagnostics, install plan, audit y attach
- `AgentRuntimeRegistry`
  encapsula persistencia actual de providers adjuntos
- `ProjectCopilotHarness`
  consume `AgentRuntimeService.status()` como parte del runtime del proyecto

## Motivo tecnico

Todavia no se movio a una tabla dedicada de base de datos. Este refactor deja la frontera lista para hacerlo sin tocar controladores, harnesses ni UI.

## Siguiente paso recomendado

1. Crear tabla dedicada `RuntimeProviderAttachment`.
2. Mover `AgentRuntimeRegistry` a esa tabla.
3. Mantener compatibilidad de lectura temporal desde `AgentMemory` solo para migracion.
