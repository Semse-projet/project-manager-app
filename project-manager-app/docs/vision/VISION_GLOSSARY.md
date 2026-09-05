# Vision Glossary

## Objetivo

Unificar el lenguaje estrategico para que equipo, producto, operaciones y documentacion hablen con las mismas palabras.

## SEMSE

Nombre del sistema operativo de trabajo de campo orientado a marketplace, ejecucion, evidencia, pagos, trust y operaciones.

## SEMSE Jobs

Capa comercial y transaccional.

Representa:

- publicacion;
- reserva;
- contrato;
- hitos;
- escrow;
- cierre.

## SEMSE Ops

Capa operacional.

Representa:

- auditoria;
- monitoreo;
- workers;
- runbooks;
- excepciones;
- soporte institucional.

## SEMSE Trust

Capa de confianza.

Representa:

- reputacion por comportamiento;
- riesgo;
- antifraude;
- historial verificable;
- score de calidad operativa.

## Prometeo

Nombre usado en dos capas distintas — ver
[VISION_PROMETEO_OS_2026.md](VISION_PROMETEO_OS_2026.md) para el detalle
completo de la distincion:

- **Prometeo Institucional** (esta entrada original): capa futura de
  evolucion institucional. Representa governance, identidad soberana,
  treasury, coordinacion distribuida, reglas programables, sub-DAOs. Sigue
  fuera del MVP (`VISION_DECISIONS_LOCKED.md` #10,
  `VISION_FUSIONADA_SEMSE_PROMETEO.md` §5.4).
- **Prometeo Operativo**: orquestador conversacional ya en runtime (P2) que
  interpreta intencion y decide que capacidad interna de SEMSE usar, sin
  reemplazar la autoridad de datos de cada modulo. Es la capa que hoy se
  construye bajo el nombre "Prometeo" en `docs/specs/prometeo/` y
  `docs/specs/agents/prometeo-core.spec.md`.

## Job

Unidad principal del flujo comercial.

Es:

- oportunidad de trabajo;
- acuerdo de alcance;
- unidad base para reserva, contrato y pagos.

No debe confundirse con:

- tarea tecnica suelta;
- ticket interno;
- simple anuncio sin lifecycle.

## Project

En el estado actual del codigo es un agregado operativo existente.

En la vision larga no debe dominar el lenguaje del producto.

## Milestone

Unidad verificable de avance y pago parcial.

## Evidence

Prueba estructurada del trabajo ejecutado.

Incluye:

- fotos;
- videos;
- documentos;
- checklist;
- metadata.

## Escrow

Mecanismo de retencion y liberacion controlada de fondos.

## Trust Score

Resultado compuesto basado en comportamiento real, no solo en reviews.

## Audit

Registro explicable de acciones y cambios relevantes.

## Ownership

Relacion real entre actor y recurso.

No se reduce a:

- pertenecer al mismo tenant;
- tener un header;
- tener un rol generico.

## Governance

Conjunto de reglas y mecanismos para evolucionar decisiones, politicas e incentivos del sistema.

## Worker

Proceso o actor tecnico con una responsabilidad definida dentro del sistema o del equipo.

## Control Plane

Superficie operativa desde la cual se observa, coordina y audita el comportamiento del sistema.

## Vertical Curado

Segmento inicial del mercado que se selecciona de forma intencional para lanzar el MVP con menos caos y mas control.

## Originador / Facilitador

Usuario que ayuda a un tercero a crear un proyecto en SEMSE y recibe una
recompensa atada a hitos verificables del proyecto resultante (validacion,
primera propuesta, contratacion, financiamiento de milestone, cierre) — no
a la sola publicacion. Ver `VISION_PROMETEO_OS_2026.md`.
