# Separación fina de riesgos documentales remanentes

Fecha: 2026-04-09
Tipo: Refinamiento de taxonomía documental

## Objetivo

Reducir dos focos de ambigüedad que seguían vivos:

1. `program/*/history` todavía estaba demasiado plano;
2. `agents/agent-runtime` seguía agrupando demasiados tipos documentales distintos al mismo nivel.

## Cambios ejecutados

### 1. `program/execution/history`

Se separó en:

- [history/README.md](/home/yoni/labsemse/program/execution/history/README.md)
- [backlogs/README.md](/home/yoni/labsemse/program/execution/history/backlogs/README.md)
- [plans/README.md](/home/yoni/labsemse/program/execution/history/plans/README.md)

Y se reclasificó físicamente:

- backlogs históricos → `history/backlogs/`
- planes históricos → `history/plans/`

Además se actualizó:

- [execution/README.md](/home/yoni/labsemse/program/execution/README.md)

### 2. `program/status/history`

Se separó en:

- [history/README.md](/home/yoni/labsemse/program/status/history/README.md)
- [integration/README.md](/home/yoni/labsemse/program/status/history/integration/README.md)
- [sprints/README.md](/home/yoni/labsemse/program/status/history/sprints/README.md)

Y se reclasificó físicamente:

- estados de integración → `history/integration/`
- snapshots por sprint → `history/sprints/`

Además se actualizó:

- [status/README.md](/home/yoni/labsemse/program/status/README.md)

### 3. `agents/agent-runtime`

Se separó en cuatro subcapas:

- [architecture/README.md](/home/yoni/labsemse/agents/agent-runtime/architecture/README.md)
- [operations/README.md](/home/yoni/labsemse/agents/agent-runtime/operations/README.md)
- [automation/README.md](/home/yoni/labsemse/agents/agent-runtime/automation/README.md)
- [decision-packages/README.md](/home/yoni/labsemse/agents/agent-runtime/decision-packages/README.md)

Reclasificación física:

- blueprint, mapas, migraciones y heurísticas → `architecture/`
- runbooks y guías operativas → `operations/`
- wrappers, comandos y automatización → `automation/`
- material ejecutivo/comunicacional → `decision-packages/`

También se actualizaron:

- [agents/README.md](/home/yoni/labsemse/agents/README.md)
- [agent-runtime/README.md](/home/yoni/labsemse/agents/agent-runtime/README.md)

## Resultado semántico

Antes:

- había bloques históricos útiles, pero demasiado planos;
- `agent-runtime` obligaba a leer blueprint, runbook y paquetes de decisión como si fueran la misma clase de documento.

Ahora:

- el histórico del programa está separado por tipo de artefacto;
- el runtime agentic está separado por función documental real;
- disminuye el riesgo de leer historia como estado activo o comunicación operativa como diseño canónico.

## Verificaciones ejecutadas

```bash
node /home/yoni/labsemse/scripts/audit-canonical-docs.mjs
node /home/yoni/labsemse/scripts/audit-report-paths.mjs
rg -n "agent-runtime/(old-flat-layout-patterns)" /home/yoni/labsemse
rg -n "execution/history/(old-flat-layout-patterns)|status/history/(old-flat-layout-patterns)" /home/yoni/labsemse
```

## Estado final

- `program/execution/history` ya no es una carpeta plana;
- `program/status/history` ya no es una carpeta plana;
- `agents/agent-runtime` ya no es una carpeta plana;
- las referencias internas quedaron alineadas al layout nuevo;
- las auditorías documentales siguen verdes.
