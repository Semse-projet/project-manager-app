# Admin Ops runtime + filtros inspirado en web-assistant-portal

Fecha: 2026-04-07
Ruta objetivo: `/home/yoni/labsemse/project-manager-app`

## Objetivo

Continuar dos pasos concretos:

1. llevar el runtime trace al tablero formal de `/admin/ops`;
2. agregar filtros activos para operación real.

Además, analizar la UI del paquete externo `web-assistant-portal` para tomar inspiración útil sin trasladar su complejidad ni su retórica conceptual.

## Fuente externa analizada

Archivo localizado:

- `/home/yoni/app prototipos/web-assistant-portal.zip`

Archivos inspeccionados dentro del zip:

- `client/src/components/DashboardLayout.tsx`
- `client/src/pages/AIAssistantPage.tsx`
- `docs/analisis/analisis_webassistant.md`

## Qué se tomó como inspiración

Del `DashboardLayout`:

- jerarquía visual clara entre overview, navegación y detalle
- paneles modulares con lectura rápida
- combinación de resumen alto nivel + área de trabajo principal

Del `AIAssistantPage`:

- selector limpio de modos/filtros
- foco en flujo de trabajo sobre una misma pantalla
- interacción directa sin sobrecargar con pasos intermedios

Del análisis estratégico:

- separar lo implementable hoy de lo puramente visionario
- evitar “AI slop” conceptual
- priorizar capas operativas concretas antes que discurso futurista

## Qué no se tomó

Se descartó explícitamente:

- estética genérica tipo portal demo
- sobreuso de gradientes y lenguaje de producto inflado
- capas “cuánticas”, XR y blockchain sin función real en SEMSE
- complejidad innecesaria para un tablero operativo

## Implementación aplicada

### 1. Nuevas rutas web para Ops runtime

Archivos:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/ops/agent-runtime/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/ops/agent-runtime/[id]/route.ts`

Capacidad:

- proxy del runtime list con query params
- proxy del trace por `id` de corrida
- uso de identidad de sesión con `fetchSemseDataForRequest`

### 2. Cliente web extendido

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/semse-api.ts`

Se añadieron:

- `fetchOpsAgentRuntime(...)`
- `fetchOpsAgentRuntimeTrace(correlationId)`
- export de tipo `AgentRuntimeList`

### 3. Admin Ops convertido en tablero real

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/admin/ops/page.tsx`

Cambios:

- se eliminó el mock estático de jobs
- el tablero ahora carga `AgentRun` reales
- selección de corrida por `correlationId`
- carga de trace detallado
- KPI de runs, running, failed y human review
- búsqueda textual sobre correlationId/agente/evento
- filtros activos por:
  - `eventType`
  - `status`
  - `agentType`

### 4. Resultado visual

La pantalla quedó dividida en tres niveles:

- hero operativo con resumen y estado del runtime
- bloque de filtros y lectura operativa
- área principal con lista de corridas y panel de trace

Eso acerca `/admin/ops` a un tablero de operación real y lo diferencia de Cortex:

- `Cortex` queda más orientado a consola de control
- `Admin Ops` queda más orientado a inspección y seguimiento operativo

## Verificación

Comando ejecutado:

- `npm exec tsc --workspace @semse/web -- --noEmit`

Resultado:

- pasa correctamente

## Lectura de producto

Este cambio mejora dos cosas importantes:

- el runtime agentic deja de estar escondido detrás de API y reportes
- Ops gana un tablero formal para seguir ejecuciones reales con filtros útiles

También queda una guía clara de inspiración:

- usar `web-assistant-portal` como referencia de estructura y ergonomía
- no usarlo como molde estético ni conceptual completo

## Siguiente paso recomendado

Las rutas más útiles ahora son:

1. conectar acciones operativas desde el trace:
   - retry
   - requeue
   - open incident
2. agregar persistencia de filtros y deep-link por `correlationId`
3. resolver aparte el `Bus error` de `next build` para cerrar build completo del frontend
