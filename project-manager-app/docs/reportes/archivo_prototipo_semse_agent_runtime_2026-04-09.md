# Archivo del prototipo `semse-agent-runtime`

Fecha: 2026-04-09
Tipo: Normalización de raíz y clasificación de prototipo

## Qué se revisó

Se inspeccionó la carpeta histórica `semse-agent-runtime`, que había quedado en la raíz de `labsemse` tras la consolidación estructural anterior.

Contenido observado:

- backend con manifiestos de proveedores y bootstrap;
- documento propio de runtime;
- componente frontend de instalador de terminal.

## Diagnóstico

La carpeta no pertenece al canon vivo por estas razones:

1. no está integrada a [project-manager-app](/home/yoni/labsemse/project-manager-app);
2. compite narrativamente con [agents/agent-runtime](/home/yoni/labsemse/agents/agent-runtime);
3. conserva ideas útiles, pero su modelo operativo es todavía de prototipo;
4. mantenerla en raíz genera falsa equivalencia con módulos canónicos del ecosistema.

## Acción ejecutada

La carpeta fue archivada en:

- [archive/prototypes/semse-agent-runtime](/home/yoni/labsemse/archive/prototypes/semse-agent-runtime)

También se dejó documentación explícita en:

- [archive/prototypes/README.md](/home/yoni/labsemse/archive/prototypes/README.md)
- [archive/prototypes/semse-agent-runtime/README.md](/home/yoni/labsemse/archive/prototypes/semse-agent-runtime/README.md)
- [archive/README.md](/home/yoni/labsemse/archive/README.md)

Y se corrigió la navegación principal en:

- [README.md](/home/yoni/labsemse/README.md)

## Estado final

- `semse-agent-runtime` queda preservado como `REFERENCE_ONLY`;
- ya no compite con la capa agentic viva;
- el canon operativo sigue siendo:
  - [agents](/home/yoni/labsemse/agents) para arquitectura documental agentic;
  - [project-manager-app](/home/yoni/labsemse/project-manager-app) para implementación viva.

## Verificación

La búsqueda de referencias activas a `semse-agent-runtime` dentro de `labsemse` ya solo devuelve:

- documentación del propio archivo en `archive/`;
- una mención histórica en [consolidacion_estructura_raiz_2026-04-07.md](/home/yoni/labsemse/reportes/consolidacion_estructura_raiz_2026-04-07.md).

Esa referencia histórica es válida y no requiere corrección, porque describe un estado anterior del árbol.
