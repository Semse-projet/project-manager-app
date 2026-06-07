# Mapa de Destino del Contenido del Repo Raiz — 2026-04-09

## Conclusión principal

La mayor parte de lo que parece "basura" en el repo raiz `labsemse` si pertenece al ecosistema, pero no toda cumple la misma funcion.

Hay que separarlo en cuatro grupos:

1. canon estructural vivo
2. implementacion viva o transicional
3. satellites e historico de referencia
4. residuos del indice Git de topologias anteriores

## 1. Canon estructural vivo

Estos bloques son soberanos y su ubicacion actual es correcta:

- [agents](/home/yoni/labsemse/agents)
- [constitution](/home/yoni/labsemse/constitution)
- [repository-rules](/home/yoni/labsemse/repository-rules)
- [program](/home/yoni/labsemse/program)
- [vision](/home/yoni/labsemse/vision)
- [_governance](/home/yoni/labsemse/_governance)
- [reportes](/home/yoni/labsemse/reportes)
- [archive](/home/yoni/labsemse/archive)

Los archivos viejos que hoy salen como `AD` en la raiz no son basura. Son documentos que ya fueron recolocados:

- `01_KERNEL.md` a `08_SPRINT_BACKLOG.md` -> [constitution](/home/yoni/labsemse/constitution)
- `CANONICITY.md`, `ARCHIVE_POLICY.md`, `CONTRIBUTING.md`, `MIGRATION_RULES.md` -> [repository-rules](/home/yoni/labsemse/repository-rules)
- `ARCHITECTURE_AUDIT.md`, `CONSOLIDATION_MATRIX.md`, `SEMSE_CONSOLIDATION_ACTION_PLAN.md`, `SEMSE_MASTER_CONSOLIDATION_ANALYSIS.md` -> [program/governance/repository-consolidation](/home/yoni/labsemse/program/governance/repository-consolidation)
- `PLAN_CONSOLIDACION.html`, `SEMSE_Cronograma_Madurez.pptx`, `semse_project_optimized.zip`, `supabase_schema.sql` -> [archive](/home/yoni/labsemse/archive)
- `_governance/AGENT_PROTOCOL.md`, `_governance/ECOSYSTEM_STATUS.md`, `WORK_SESSION_LOG.md`, `DISTILLATION_*` -> subcarpetas nuevas dentro de [_governance](/home/yoni/labsemse/_governance)

## 2. Implementacion viva o transicional

### 2.1 Implementacion viva

Este bloque es el sistema operativo real:

- [project-manager-app](/home/yoni/labsemse/project-manager-app)

### 2.2 Implementacion auxiliar viva

Este bloque tambien es trabajo real actual:

- [semse](/home/yoni/labsemse/semse)

### 2.3 Capa transicional heredada

Este bloque sigue siendo parte del ecosistema, pero no es el monorepo canonico:

- [src](/home/yoni/labsemse/src)
- archivos raiz de Vite/Tailwind/TS asociados

Interpretacion correcta:

- no es basura
- no es canon estructural
- no debe competir con `project-manager-app`
- debe tratarse como capa transicional heredada hasta decidir si se archiva o se preserva como demo/reference shell

### 2.4 Supabase local heredado

- [supabase](/home/yoni/labsemse/supabase)

Esto ya estaba clasificado como capa transicional heredada. No es canon, pero sigue perteneciendo al ecosistema como referencia o remanente tecnico de una fase anterior.

## 3. Satellites e historico de referencia

Estos bloques NO son basura. Ya estan donde deben estar:

- [app semse/_satellites-archive](/home/yoni/labsemse/app%20semse/_satellites-archive)

Los satellites identificados ahi son historicos o de referencia:

- `Agent_Chat semántico sobre PDFs`
- `Agent_Matriz de agentes`
- `Agent_Semse App Maximizada`
- `project-manager-copi`
- `semse-control-mvp`
- `vite-boilerplate-app`
- `web-assistant-portal`

Regla correcta:

- deben permanecer como satellites archivados o `REFERENCE_ONLY`
- no deben moverse al canon nuevo
- no deben contaminar `project-manager-app`

## 4. Residuos del indice Git

Este es el grupo que mas confunde.

### 4.1 `labsemse_project/`

En el estado Git siguen apareciendo muchas rutas bajo `labsemse_project/...`, pero en el filesystem actual esa carpeta ya no existe como arbol vivo.

Eso significa:

- no estamos viendo contenido real actual
- estamos viendo residuos del indice Git de una topologia anterior

Interpretacion:

- no hay que "reubicar" esas rutas una por una
- hay que tratarlas como arrastre historico del indice o de una migracion de estructura no cerrada en commits

### 4.2 Artefactos generados

Estos ya fueron identificados y limpiados del indice:

- `node_modules/`
- `dist/`
- `.temp/`
- `*.swp`

Esos si eran ruido puro.

## Mapa resumido: a donde va cada bloque

- raiz documental vieja -> ya fue absorbida por `constitution/`, `repository-rules/`, `program/`, `archive/`
- `project-manager-app/` -> implementacion viva canonica
- `semse/` -> modulo vivo complementario
- `src/` + config Vite/Tailwind raiz -> capa transicional heredada
- `supabase/` -> referencia transicional heredada
- `app semse/_satellites-archive/` -> historico de referencia correcto
- `labsemse_project/...` en `git status` -> residuo de indice, no bloque vivo

## Criterio operativo

Cuando algo "parezca basura", la pregunta correcta es:

1. existe fisicamente hoy?
2. si existe, es canon, implementacion, satellite o transicion?
3. si no existe, aparece solo en `git status` por arrastre del indice?

## Diagnostico final

La raiz no esta sucia por documentos "fuera de lugar" de forma masiva.

Esta sucia por dos cosas distintas:

1. trabajo real grande aun no consolidado en commits
2. residuos del indice Git de una estructura historica anterior, especialmente `labsemse_project/...`
