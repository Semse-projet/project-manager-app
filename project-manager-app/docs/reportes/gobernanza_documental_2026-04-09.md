# Gobernanza documental consolidada

Fecha: 2026-04-09
Tipo: Normalización de taxonomía, rutas y reglas documentales

## Objetivo

Reforzar la separación entre:

- canon estructural estable;
- implementación viva;
- evidencia histórica;
- prompts y planning;
- archivo y prototipos históricos.

## Hallazgos corregidos

### 1. Regla de canonicidad insuficientemente explícita

Aunque la estructura ya estaba bastante ordenada, [CANONICITY.md](/home/yoni/labsemse/repository-rules/CANONICITY.md) todavía estaba más enfocada en código y carpetas canónicas que en la separación documental completa.

Se reforzó con:

- definición explícita de `canon estructural estable`;
- definición explícita de `evidencia histórica`;
- definición explícita de `prompts/planning` como insumo subordinado;
- definición explícita de `archive/` como histórico no operativo;
- reglas operativas para no volver a mezclar esas capas.

También se corrigió un residuo de formato en la numeración del documento.

### 2. Índices débiles en subcarpetas de `reportes/`

Se endurecieron los índices de:

- [reportes/audits/README.md](/home/yoni/labsemse/reportes/audits/README.md)
- [reportes/planning/README.md](/home/yoni/labsemse/reportes/planning/README.md)
- [reportes/infclaude/README.md](/home/yoni/labsemse/reportes/infclaude/README.md)

Resultado:

- `audits/` ya no queda como contenedor ambiguo;
- `planning/` ya no compite semánticamente con `program/`;
- `infclaude/` ya deja explícito que no es canon estructural.

### 3. Rutas canónicas viejas en documentación estable

Se corrigieron rutas obsoletas en:

- [SEMSE_AI_EXECUTION_BACKLOG.md](/home/yoni/labsemse/program/execution/SEMSE_AI_EXECUTION_BACKLOG.md)
- [SEMSE_CONSOLIDATION_PLAN.md](/home/yoni/labsemse/program/strategy/SEMSE_CONSOLIDATION_PLAN.md)

Antes seguían apuntando a:

- `.../labsemse_project/project-manager-app`
- `.../project-manager-app`

Ahora apuntan al canónico real:

- [project-manager-app](/home/yoni/labsemse/project-manager-app)

### 4. Estado histórico dentro de `program/`

Se reforzó [program/README.md](/home/yoni/labsemse/program/README.md) para distinguir:

- `execution/` activo vs `execution/history/`
- `status/` actual vs `status/history/`

Eso evita que planes y estados históricos compitan con el programa vivo.

## Verificación nueva añadida

Se creó:

- [audit-canonical-docs.mjs](/home/yoni/labsemse/scripts/audit-canonical-docs.mjs)

Función:

- escanear las zonas estables del canon documental;
- detectar rutas viejas del monorepo canónico;
- fallar si reaparecen referencias a prefijos obsoletos.

## Verificaciones ejecutadas

```bash
node /home/yoni/labsemse/scripts/audit-report-paths.mjs
node /home/yoni/labsemse/scripts/audit-canonical-docs.mjs
rg -n "legacy-project-manager-paths" <stable-doc-zones>
```

## Resultado

- `reportes/` sigue limpio de rutas absolutas rotas;
- las zonas documentales estables ya no contienen rutas viejas del canónico;
- la taxonomía entre canon, evidencia, planning, prompts y archive quedó más explícita;
- la base documental queda más segura para futuras ejecuciones de agentes y humanos.

## Riesgos documentales remanentes

1. Sigue existiendo mucho material histórico útil dentro de `program/execution/history/` y `program/status/history/`; ya no compite con el canon, pero aún puede requerir notas históricas más finas por documento si se va a usar intensivamente.
2. `agents/agent-runtime/` sigue siendo el bloque documental más denso del ecosistema agentic. Ya está clasificado, pero a futuro convendría separar aún más blueprint, runbooks y paquetes de decisión si sigue creciendo.
