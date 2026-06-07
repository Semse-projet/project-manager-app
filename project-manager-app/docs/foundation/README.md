# Foundation

Esta carpeta traduce la vision canonica del sistema a decisiones tecnicas,
fronteras de dominio y reglas de implementacion.

## Precedencia documental

La fuente principal de producto, dominio y arquitectura vive fuera del repo en:

- [`/home/yoni/labsemse/vision`](/home/yoni/labsemse/vision)
- documento canonico: [`/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md`](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)

Estas son las reglas:

- `vision` define la direccion maestra
- `docs/foundation` traduce esa direccion a implementacion
- `docs/vision` es una copia operativa, no reemplaza la fuente canonica
- si hay contradiccion entre `vision` y cualquier archivo de esta carpeta, manda `vision`

## Uso correcto

Usa esta carpeta para:

- mapear modulos
- fijar contratos tecnicos
- definir ownership, policy y lifecycle
- documentar transiciones de Prisma y dominio

## Documento clave nuevo

- `SEMSE_DEVELOPER_RUNTIME_PRD.md`
  Fija el marco de producto, alcance, riesgos, metricas y roadmap del runtime agentivo para developers.
- `SEMSE_DEVELOPER_RUNTIME_SPEC.md`
  Traduce el blueprint de runtime agentivo a contratos, ubicacion en el monorepo y secuencia de implementacion.
- `PROMPT_MAESTRO_SEMSE_DEVELOPER_RUNTIME.md`
  Prompt operacional para ejecutar implementacion iterativa del modulo con alineacion canonica.

No la uses para redefinir producto o arquitectura por fuera de la vision canonica.
