# Limpieza Repo Raiz Labsemse — 2026-04-09

## Objetivo

Reducir la suciedad estructural del repo raiz `labsemse` sin borrar trabajo real ni romper la trazabilidad del reordenamiento documental y de la integracion tecnica reciente.

## Acciones realizadas

### 1. Politica de ignore reforzada

Se amplio [`.gitignore`](/home/yoni/labsemse/.gitignore) para cortar ruido generado en toda la raiz:

- `node_modules/`
- `.env`, `.env.local`, `.env.*.local`
- `.claude/`
- `.vscode/`
- `.DS_Store`
- `*.swp`, `*.swo`, `*~`
- `.next/`
- `dist/`
- `coverage/`
- `.temp/`
- `tmp/`
- `*.tsbuildinfo`

### 2. Limpieza del indice Git

Se removio del indice, sin borrar el contenido del disco, todo lo claramente generado o residual:

- `node_modules/`
- `dist/`
- `app semse/.../dist`
- `labsemse_project/supabase/.temp`
- `src/components/layout/.Sidebar.tsx.swp`

## Resultado

El repo raiz ya no esta contaminado por:

- `node_modules`
- `dist`
- `.next`
- `.temp`
- `.swp`

Verificacion practica:

- `git status --short | rg 'node_modules|/dist/|\\.swp|/\\.temp/|\\.next/'` -> sin resultados

## Diagnostico restante

La suciedad que sigue apareciendo en `git status` ya no es basura generada. Corresponde a trabajo real:

- reordenamiento documental soberano
- nuevas carpetas canónicas (`agents`, `constitution`, `repository-rules`, `archive`, `reportes`)
- consolidacion de `_governance`
- integracion de `project-manager-app`
- integracion del nuevo modulo `semse`
- satellites y material historico que todavia no ha sido consolidado en commits intencionales

## Conclusión

La raiz sigue teniendo muchos cambios, pero ahora son principalmente cambios semanticos reales. El problema grave de higiene del repo ya no es artefacto generado sino ausencia de una estrategia de commits y cortes lógicos para versionar la reorganizacion completa.
