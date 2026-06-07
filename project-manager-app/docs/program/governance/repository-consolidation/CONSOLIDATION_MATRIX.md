# Consolidation Matrix

## Objetivo

Convertir la clasificacion del repositorio en una matriz operativa unica para
SEMSEproject.

## Regla de lectura

- `Canonical`: fuente oficial y viva
- `Transitional`: fuente temporal mientras migra
- `Reference Only`: util para extraer valor, no para desarrollar core
- `Frozen`: no se desarrolla ahi
- `Archived`: valor ya absorbido o historico
- `Ignore as source`: artefacto o build, no fuente

| Ruta | Estado | Rol actual | Valor principal | Solapa con | Riesgo | Accion recomendada | Destino sugerido |
|---|---|---|---|---|---|---|---|
| [`/home/yoni/labsemse/app semse/project-manager-app`](/home/yoni/labsemse/app%20semse/project-manager-app) | `Canonical` | Tronco operativo de SEMSEproject | backend, frontend destino, Prisma, schemas, worker, agents, docs tecnicas | raiz `src`, referencias monorepo paralelas | medio | consolidar todo desarrollo estructural aqui | monorepo oficial |
| [`/home/yoni/labsemse/src`](/home/yoni/labsemse/src) | `Transitional` | Fuente temporal de UX y flujos ya resueltos | experiencia de usuario, pantallas maduras, layouts, copy y flujo funcional | `apps/web`, Agent_Matriz | alto | migrar funcionalidad, no archivos | `project-manager-app/apps/web` |
| [`/home/yoni/labsemse/vision`](/home/yoni/labsemse/vision) | `Canonical` | Vision oficial | direccion de producto y limites de plataforma | docs/vision espejo | bajo | mantener blindado y sincronizar copias espejo | fuente maestra |
| [`/home/yoni/labsemse/program`](/home/yoni/labsemse/program) | `Canonical` | Ejecucion oficial | roadmap, backlog, fases, status | docs/foundation parciales | medio | mantener como programa vivo | fuente operativa |
| [`/home/yoni/labsemse/supabase`](/home/yoni/labsemse/supabase) | `Transitional` | Infra heredada parcial | auth/storage/functions heredadas, edge IA | `apps/api`, Prisma, worker | alto | migrar por dominio y cortar uso core nuevo | infra transicional |
| [`/home/yoni/labsemse/apps`](/home/yoni/labsemse/apps) | `Frozen` | Residuo tecnico de backend/build | evidencia historica puntual | `project-manager-app/apps/api` | alto | no desarrollar; archivar cuando ya no aporte | archivo o eliminacion controlada |
| [`/home/yoni/labsemse/app semse/Agent_Matriz de agentes  `](/home/yoni/labsemse/app%20semse/Agent_Matriz%20de%20agentes%20%20) | `Frozen` | Frontend paralelo absorbible | variantes UX y componentes previos | raiz `src`, `apps/web` | critico | extraer deltas utiles y congelar definitivamente | absorbido en `src` o `apps/web` |
| [`/home/yoni/labsemse/app semse/Agent_Chat semántico sobre PDFs`](/home/yoni/labsemse/app%20semse/Agent_Chat%20sem%C3%A1ntico%20sobre%20PDFs) | `Frozen` | Spike de knowledge chat | patron de ingesta y retrieval semantico | knowledge futuro, demos | medio | extraer patron y congelar | `packages/knowledge` futuro |
| [`/home/yoni/labsemse/app semse/app`](/home/yoni/labsemse/app%20semse/app) | `Frozen` | Demo o laboratorio UI | storytelling, visualizacion, conceptos | landing, demos, labs | medio | no usar como base viva | `labs/` o archivo |
| [`/home/yoni/labsemse/app semse/semse-control-mvp`](/home/yoni/labsemse/app%20semse/semse-control-mvp) | `Reference Only` | MVP operativo de control | worklog, evidence flow, knowledge, reporting, milestone ops | ops future, worker dashboard | alto | extraer modulos utiles antes de archivar | `packages/ops` o modulos en monorepo |
| [`/home/yoni/labsemse/app semse/Agent_Semse App Maximizada`](/home/yoni/labsemse/app%20semse/Agent_Semse%20App%20Maximizada) | `Reference Only` | Blueprint ampliado de plataforma | k8s, observability, agents, servicios, admin/prometeo | project-manager-app, infra futura | alto | extraer infra y patrones, no adoptar en bloque | `infra/`, `services/`, `packages/agents` |
| [`/home/yoni/labsemse/app semse/project-manager-app/docs/vision`](/home/yoni/labsemse/app%20semse/project-manager-app/docs/vision) | `Reference Only` | Espejo operativo de vision | acceso local a vision desde el monorepo | `vision/` | medio | readonly; sincronizacion unidireccional | espejo controlado |
| [`/home/yoni/labsemse/dist`](/home/yoni/labsemse/dist) | `Ignore as source` | build generado | ninguno como fuente | todos | bajo | ignorar como fuente | artefacto |
| [`/home/yoni/labsemse/node_modules`](/home/yoni/labsemse/node_modules) | `Ignore as source` | dependencias instaladas | ninguno como fuente | todos | bajo | ignorar como fuente | artefacto |

## Prioridad de consolidacion

1. consolidar desarrollo estructural en `project-manager-app`
2. extraer UX desde `src/`
3. cortar uso core de Supabase
4. extraer valor puntual de referencias
5. congelar y luego archivar ramas paralelas

## Regla final

Todo lo que no sea canonico solo puede aportar valor por extraccion controlada.

No puede volver a convertirse en una linea viva paralela del sistema.
> Nota histórica: esta matriz fue útil para decidir la consolidación. Algunas rutas y clasificaciones reflejan el estado previo al reordenamiento final del repositorio y deben leerse con ese contexto.
