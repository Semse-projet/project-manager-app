# Plan Siguiente Fase de Operacion Asistida

- Fecha: 2026-04-16
- Ultima actualizacion: 2026-04-17
- Estado: en ejecucion
- Precondicion cumplida: modulo base estabilizado sobre `WorkspaceMemoryEntry`

## Punto de partida

El modulo base ya queda con estas condiciones:

- `workspace_memory` usa store dedicado como camino por defecto;
- el reader legacy ya fue retirado del runtime;
- BCP, governance, riesgo, restore y auditoria legacy ya tienen gates y evidencia.

## Objetivo de la siguiente fase

Mover el trabajo restante fuera de la estabilizacion del modulo base y concentrarlo en:

1. restore multi-entorno real;
2. expansion funcional de `workspace_memory`;
3. rollout seguro del modo sin legado en rutina operativa.

## Corte exacto del estado

### Completado

- restore multi-entorno ya aterrizado en codigo y validado;
- rollout sin legado ya es el camino normal del runtime;
- planner de uploads y flujo multipart ya aterrizados para `evidence`, `contract` y `dispute`;
- superficies visibles ya conectadas para evidencia, disputas y tracker contractual;
- proveedor multipart externo configurable ya validado;
- observacion post-legado ya cerrada en `legacyMentionsInRuntimePaths: 0`.

### En progreso

- expansion funcional y UX sobre superficies visibles;
- mejora de agentes/copiloto para respuestas menos repetitivas y mas accionables.

### Pendiente

- ampliar mas superficies solo donde haya beneficio operativo claro.

## Lineas de trabajo

### 1. Restore multi-entorno

Objetivo:

- pasar de simulacion aislada a restore validado en mas de un entorno controlado.

Acciones:

Estado actual: completado

1. definir un segundo entorno aislado para restore con base y API separadas del compose local actual; `completado`
2. ejecutar el mismo drill sobre ese entorno; `completado`
3. guardar evidencia diferenciada por entorno; `completado`
4. extender `governance` para distinguir cobertura local, API local y restore multi-entorno. `completado`

### 2. Expansion funcional de memoria contextual

Objetivo:

- hacer que mas modulos de negocio escriban y lean `workspace_memory` con trazabilidad.

Acciones:

Estado actual: en progreso

1. identificar 2 o 3 modulos prioritarios donde el contexto reduzca ambiguedad; `completado`
2. definir que eventos o decisiones deben persistirse como `workspace_memory`; `completado`
3. validar lectura operativa en vistas o trazas donde ese dato tenga valor real. `en progreso`

Avance real ya implementado:

- modulos tocados: `jobs`, `projects`, `disputes`;
- superficies reforzadas: `milestones`, `agents/copilot`, evidencia, disputas y tracker.

### 3. Operacion ya sin legado como rutina

Objetivo:

- hacer normal el modo sin `KnowledgeFact` como compatibilidad operativa.

Acciones:

Estado actual: mayormente completado

1. mantener `verify:operacion-asistida:dedicated-store` como gate habitual; `completado`
2. observar el sistema tras el retiro del reader legacy; `completado`
3. eliminar referencias documentales residuales a `KnowledgeFact` como soporte de lectura. `completado`

## Frente activo real al 2026-04-17

Lo que mas valor da continuar ahora es:

1. seguir afinando experiencia del copiloto y de agentes sobre casos mas complejos;
2. extender nuevas superficies solo si reducen ambiguedad, retrabajo o fallos operativos;
3. decidir si el proveedor `filesystem_multipart` debe seguir local o migrar a almacenamiento externo.

## Entregables esperados

- evidencia de restore multi-entorno; `cumplido`
- backlog funcional de modulos candidatos para `workspace_memory`; `cumplido en primera ola`
- guia de observacion post-retiro del reader legacy; `cumplido`
- decision documentada sobre fecha o condicion de retiro definitivo de la lectura dual. `cumplido`
