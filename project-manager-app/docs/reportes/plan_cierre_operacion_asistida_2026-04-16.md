# Plan de Cierre de Operacion Asistida

- Fecha: 2026-04-16
- Ultima actualizacion: 2026-04-17
- Estado: mayormente cumplido
- Frente: `project-manager-app`

## Objetivo

Cerrar el modulo `operacion asistida` con criterios verificables para poder continuar al siguiente frente sin arrastrar deuda estructural.

## Estado consolidado

Ya esta completado:

- persistencia dedicada de `workspace_memory` en `WorkspaceMemoryEntry`;
- drill local y drill API con evidencia historica y `manifest.json`;
- revision de riesgo derivada del manifiesto;
- sincronizacion de governance y backlog desde la evidencia viva;
- auditoria y absorcion del legado `KnowledgeFact` con `pendingBackfillRecords: 0`;
- gate compuesto `npm run verify:operacion-asistida:module`.

## Corte exacto del plan

### Completado

- `dedicated-store` ya esta promovido como camino por defecto;
- el reader legacy ya no participa del runtime normal;
- restore local, restore API y restore multi-entorno ya quedaron aterrizados en codigo y evidencia;
- expansion funcional minima ya aterrizada en `jobs`, `projects` y `disputes`;
- el modulo base ya dejo de estar en fase de estabilizacion estructural.

### En progreso

- endurecimiento de superficies operativas y UX alrededor del modulo:
  `milestones`, agentes/copiloto, planner de uploads, multipart y trazabilidad visible;
- consolidacion de flujos de archivos grandes en UI viva para evidencia, disputas y contratos;
- afinacion del frente agente/copiloto para reducir respuestas repetitivas en casos mas complejos.

### Pendiente

- proveedor real de almacenamiento multipart detras de las URLs de carga;
- progreso por parte y estado fino por bloque en la UI;
- observacion operativa sostenida para declarar cierre total de la siguiente fase.

## Brecha restante para cierre real

Queda como remanente operativo, no estructural:

1. mover multipart desde stub local a backend de almacenamiento real;
2. ampliar lectura/escritura contextual a mas superficies si aporta valor real;
3. seguir puliendo experiencia de agentes y copiloto.

## Plan de accion

### Fase 1. Cierre tecnico inmediato

Estado actual: completada

1. Ejecutar `npm run verify:operacion-asistida:dedicated-store`. `completado`
2. Promover ese comando a validacion recurrente del modulo. `completado`
3. Si reaparece una falla, corregir cualquier dependencia residual a `KnowledgeFact`. `sin hallazgos abiertos`

### Fase 2. Consolidacion post-retiro

Estado actual: mayormente completada

1. Hacer una corrida repetible en CI o rutina local sobre `dedicated-store`. `completado`
2. Confirmar que el retiro del reader legacy se sostiene sin regresiones. `completado`
3. Confirmar durante una ventana de observacion que no reaparecen dependencias a `KnowledgeFact`. `en progreso`
4. Mantener la auditoria legacy solo como verificacion historica, no como soporte de runtime. `completado`

### Fase 3. Restore multi-entorno

Estado actual: completada a nivel de codigo y validacion operativa

1. Definir un entorno aislado adicional para restore, separado del compose local actual. `completado`
2. Ejecutar el drill sobre ese entorno con evidencia propia. `completado`
3. Extender governance para distinguir restore local de restore multi-entorno. `completado`

### Fase 4. Expansion funcional

Estado actual: iniciada y funcional

1. Extender escritura contextual a modulos de negocio adicionales. `completado` en primera ola
2. Extender lectura contextual a superficies operativas donde el dato reduzca ambiguedad o retrabajo. `en progreso`
3. Mantener trazabilidad de esos aterrizajes en `program/` y `reportes/`. `completado`

## Criterio de cierre de este frente

Este frente se puede considerar cerrado cuando:

- `npm run verify:operacion-asistida:module` pasa;
- `npm run verify:operacion-asistida:dedicated-store` pasa;
- governance queda en estado `healthy`;
- la auditoria legacy sigue en `pendingBackfillRecords: 0`;
- el siguiente trabajo ya pertenece a expansion o restore multi-entorno, no a estabilizacion del modulo base.

Estado al 2026-04-17:

- todos esos criterios ya estan cumplidos;
- el trabajo restante ya pertenece a expansion de capacidades y hardening de UX/almacenamiento.

## Artefactos canonicos relacionados

- `project-manager-app/docs/bcp/`
- `project-manager-app/docs/bcp/evidence/`
- `project-manager-app/.github/workflows/operacion-asistida-api.yml`
- `program/execution/SEMSE_AI_EXECUTION_BACKLOG.md`
- `program/governance/coherence/OPERACION_ASISTIDA_RISK_STATUS_LATEST.md`
- `reportes/implementacion_operacion_asistida_monorepo_2026-04-13.md`
