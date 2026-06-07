# Estado Bucle Ecosistema SemseProject

- Fecha: 2026-04-19
- Estado: flujo principal validado punta a punta
- Frente: `project-manager-app`
- Objetivo: dejar el flujo principal del ecosistema operativo de punta a punta, con agentes útiles de verdad, roles claros y detección real de quiebres operativos y fricciones de escala.

## 1. Qué ya existía antes de este ciclo

### Núcleo de plataforma
- Monorepo activo en `/home/yoni/labsemse/project-manager-app`
- Módulos principales ya presentes:
  - `apps/api`
  - `apps/web`
  - `apps/worker`
  - `packages/agents`
  - `packages/shared`
  - `packages/schemas`
  - `packages/db`
- Backend con:
  - domain events
  - cola BullMQ
  - worker separado
  - catálogos de agentes
  - memoria de workspace
  - entidades de negocio como jobs, disputes, milestones, contracts, payments

### Trabajo previo ya incorporado antes de este bucle
- Idempotencia DB-backed para runs de agentes
- Deduplicación por `event:correlationId:agentType`
- Enriquecimiento real de payloads en router de eventos
- FSM para jobs
- Prioridad en cola BullMQ
- Retry en event bus
- FTS para workspace memory
- Endpoint de transición de jobs

## 2. Problemas encontrados al entrar en este bucle

### Seguridad y consistencia
- Endpoints internos de conocimiento expuestos públicamente
- Transiciones de job con autorización insuficiente
- `updateStatus` de jobs sin blindaje de tenant
- Dependencia fuerte de Redis al inicio del API

### Calidad y estabilidad
- Restos muertos e imports basura en API y web
- Lint roto en web por script defectuoso
- Race condition en creación de actor context
- Polling de runs golpeando throttle
- Worker usando tenant fijo en vez de tenant real del queue item

### Flujo operativo real
- Sin Redis o sin cola viva: runs quedaban `queued`
- El quiebre duro observado durante este bucle fue:
  - el worker podía leer el run con `GET /v1/agents/runs/:runId/worker`
  - y después `POST /v1/agents/runs/:runId/start` fallaba con `404`
- Causa raíz operativa encontrada:
  - había dos workers vivos a la vez
  - uno era viejo y seguía consumiendo cola con comportamiento desalineado
  - eso contaminaba el loop real y producía fallos fantasma

## 3. Qué se corrigió en este ciclo

### Limpieza y gates
- Limpieza de imports/vars no usados en API
- Arreglo de gate de lint en web
- Corrección de refresh en página de copilot

### Seguridad
- Quitado `@Public()` de controladores internos:
  - `repo-knowledge`
  - `runtime-knowledge`
  - `anatomy`
- Reforzada autorización real de transición de jobs
- `updateStatus` de jobs ahora verifica tenant real antes de tocar DB

### Cola / worker / runtime
- `AgentQueueService` endurecido:
  - ya no rompe la API si Redis no está disponible
  - deja runs persistidos aunque no haya cola disponible
  - reconexión viva al encolar si Redis aparece después
- `ActorContextService` movido a `upsert` para matar carrera de unicidad
- `GET /v1/agents/runs` marcado con `@SkipThrottle()` para que smoke/polling no muera por 429
- Worker arreglado para usar tenant del queue item al leer y operar runs
- Worker con retry corto al hacer `start` si recibe `404`
- Worker bajado a `concurrency: 1` para operación segura mientras se revalida paralelismo
- Logging duro agregado en controller/repository de agents para comparar actor, tenant, headers y lookup real de run
- Worker viejo duplicado eliminado para limpiar consumo de cola

## 4. Validaciones ya ejecutadas

### Verificaciones verdes
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build:api`
- `npm run build:web`
- `smoke:agents`
- `smoke:domain-events`

### Infra local validada
- Redis local arriba
- API arrancando en `127.0.0.1:4122`
- Worker arrancando y consumiendo cola

## 5. Estado real actual del flujo principal

### Lo que sí funciona
- Los eventos de dominio disparan creación de runs
- Los runs se persisten correctamente
- Los jobs llegan a Redis
- El worker toma jobs de Redis
- El worker hace `start`
- El agente ejecuta
- El worker hace `complete`
- El smoke `domain-events` terminó con runs `completed` para:
  - `pricing`
  - `risk`
  - `evidence-coach`
  - `dispute`

### Evidencia operativa observada
- Validación exitosa del smoke principal:
  - job runs:
    - `pricing` -> `completed`
    - `risk` -> `completed`
  - milestone runs:
    - `evidence-coach` -> `completed`
  - dispute runs:
    - `risk` -> `completed`
    - `dispute` -> `completed`
- El flujo madre real quedó validado así:
  - evento
  - run
  - cola
  - worker
  - start
  - execute
  - complete

## 6. Lectura operativa: dónde se rompe el sistema real

### Ruptura principal que había
- El ciclo más importante del ecosistema es:
  - evento
  - run
  - cola
  - worker
  - start
  - execute
  - complete
- La fractura observada estuvo en `start`, pero ya quedó cerrada en la validación actual

### Impacto actual
- El loop principal ya cierra
- Los agentes ya pueden producir valor real cuando el worker corre limpio
- El riesgo fuerte ya no es “flujo roto”, sino:
  - volver a introducir workers duplicados
  - subir concurrencia sin revalidación controlada

## 7. Fricciones que impiden escalar

### Fricciones técnicas
- Estado dividido entre DB y Redis si un worker muere temprano
- Falta guardarraíl explícito contra workers duplicados
- Concurrencia mayor a `1` todavía no está revalidada bajo carga controlada

### Fricciones de producto y operación
- No todos los roles tienen aún recorrido operativo validado de punta a punta en UI real
- Falta convertir mejor los resultados de agentes en “siguiente acción” visible por rol
- Sigue faltando mapa final de tareas manuales y pasos ambiguos por pantalla

## 8. Plan de acción inmediato siguiente

### Fase A — endurecer el loop ya validado
1. Dejar guardarraíl para detectar worker duplicado
2. Revalidar concurrencia con `2` de forma controlada
3. Confirmar que no reaparece divergencia Redis vs DB
4. Mantener smoke `domain-events` como gate del flujo principal

### Fase B — validar flujo principal por rol
1. Cliente:
   - crear job
   - revisar propuestas
   - completar o cancelar
2. Profesional:
   - aceptar
   - avanzar milestone
   - enviar evidencia
   - abrir disputa
3. Ops/Admin:
   - ver runs
   - aprobar
   - reintentar
   - detectar estancamientos
4. Worker/System:
   - claim
   - start
   - heartbeat
   - complete/fail

### Fase C — agentes que ayudan de verdad
1. Para cada agente, medir si entrega:
   - siguiente acción
   - bloqueo detectado
   - explicación útil
   - señal para humano
2. Revisar agentes críticos:
   - `risk`
   - `pricing`
   - `dispute`
   - `evidence-coach`
   - `trust-match`

### Fase D — detectar fricciones de escala
1. Medir tiempos del flujo principal
2. Medir pasos manuales
3. Medir runs fallidos por tipo
4. Medir cuellos entre eventos, cola y worker
5. Hacer reporte por:
   - quiebre
   - impacto
   - frecuencia
   - costo operativo

## 9. Resumen operativo final de este bucle

- flujo principal validado de punta a punta
- causa raíz encontrada: worker duplicado viejo contaminando la cola
- mitigación activa segura: un solo worker y `concurrency: 1`
- siguiente frente real: escalar sin reabrir la herida

- `reporte_flujo_principal_roles_y_agentes_YYYY-MM-DD.md`
- Debe incluir:
  - flujo por rol
  - puntos de ruptura
  - agentes útiles vs agentes decorativos
  - fricciones de escala
  - backlog priorizado

## 10. Resumen cavernícola

- Bestia ya camina más que antes
- Huesos blandos de seguridad y consistencia ya se endurecieron bastante
- Cola y worker ya están vivos
- Problema grande ya no está escondido
- Queda cerrar el salto `worker -> start`
- Después de eso toca validar el flujo principal por rol y medir fricción real de escala
