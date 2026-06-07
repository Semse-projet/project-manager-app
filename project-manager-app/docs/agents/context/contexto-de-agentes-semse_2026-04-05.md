# Contexto de Agentes SEMSE

## Definicion

`Contexto` es el conjunto de datos activos necesarios para ejecutar una iteracion del agente con precision suficiente.

No es historia completa. No es memoria eterna. No es toda la base de datos.

## Contexto actual del copiloto de proyecto

El contexto actual del proyecto ya incorpora:

- proyecto
- jobs
- milestones
- documentos
- disputas
- pagos
- trust snapshot
- warnings
- actividad reciente
- estado del corpus

Referencias:

- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/projects/projects.repository.ts`
- `/home/yoni/app semse/project-manager-app/apps/web/components/projects/project-ai-console.tsx`

## Propiedades del contexto bueno

- acotado por entidad
- relevante para la tarea
- reciente
- reproducible
- trazable

## Niveles de contexto

### 1. Contexto inmediato

- prompt actual
- UI state
- entidad activa

### 2. Contexto operacional

- warnings
- pagos pendientes
- disputas activas
- docs relevantes
- actividad reciente

### 3. Contexto historico

- thread previo
- eventos auditados
- runs recientes

### 4. Contexto estructural

- roles
- permisos
- power level
- disponibilidad de tools

## Regla

El contexto debe ser recomputable desde backend. El frontend solo lo presenta o lo usa transitoriamente.

## Riesgos

- contexto excesivo provoca ruido
- contexto pobre provoca respuestas genericas
- contexto no auditado rompe trazabilidad
- contexto que no respeta ACL filtra datos
