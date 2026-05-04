# Auditoría global de canónicos y revisión de `agents`

Fecha: 2026-04-08
Base: `/home/yoni`

## Objetivo

1. Buscar en toda la máquina accesible (`/home/yoni`) copias dispersas de documentos canónicos.
2. Revisar si dentro de `agents/` había duplicación seria entre documentos fundacionales y operativos.

## Resultado global de canónicos

Los documentos canónicos reales siguen concentrados en `labsemse/`:

- `constitution/`
- `repository-rules/`
- `program/`
- `_governance/`

El hallazgo externo más claro fue:

- `/home/yoni/skills /Quebes esto - Claude_files/01_KERNEL.md`

Conclusión:

- existe al menos una copia suelta fuera de `labsemse`;
- no debe tratarse como fuente de verdad;
- entra en categoría de copia externa o residuo de trabajo.

## Decisión de gobernanza aplicada

Se reforzó en:

- `/home/yoni/labsemse/repository-rules/CANONICITY.md`

la regla de que cualquier copia con nombre canónico fuera de `labsemse/` no gana autoridad por existir.

## Revisión de `agents/`

### Lo que sí está bien

No aparece una duplicación grave entre:

- `foundations/`
- `context/`
- `logic/`
- `memory/`
- `cycles/`
- `harnesses/`
- `implementation/`
- `references/`

Cada bloque cubre una capa distinta:

- fundación conceptual;
- disciplina de contexto;
- disciplina de memoria;
- lógica y ciclo;
- contratos de harness;
- mapa de código;
- referencias externas aterrizadas.

### Lo que sí requiere lectura cuidadosa

El bloque:

- `agents/agent-runtime/`

es el más denso y mezcla:

- blueprint de runtime;
- runbooks;
- decisiones operativas;
- paquetes de migración;
- comandos y plantillas.

No está mal ubicado, pero es el subárbol con más riesgo de solapamiento narrativo si sigue creciendo sin índice fuerte.

## Ajuste aplicado

Se actualizó:

- `/home/yoni/labsemse/agents/README.md`

para dejar explícito:

- qué bloque es fundacional;
- qué bloque aterriza contratos e implementación;
- y cómo debe leerse `agent-runtime/`.

## Conclusión

Estado final:

- los canónicos soberanos siguen concentrados en `labsemse/`;
- las copias externas quedan desautorizadas por regla;
- `agents/` no está duplicado de forma grave;
- el único bloque a vigilar por crecimiento documental es `agents/agent-runtime/`.
