# Revisión de vision

Fecha: 2026-04-08
Base: `/home/yoni/labsemse/vision`

## Conclusión

`vision/` ya estaba bien ubicado y bien delimitado.

No fue necesario mover documentos fuera de la carpeta.

## Problema real detectado

Los índices de visión seguían apuntando a rutas antiguas dentro de:

- `/home/yoni/labsemse/project-manager-app/docs/vision`

Eso ya no era correcto como fuente primaria, porque la visión soberana vive en:

- `/home/yoni/labsemse/vision`

## Cambios realizados

### Actualizado

- `vision/README.md`
- `vision/VISION_INDEX.md`

### Ajustes

- corrección de links hacia la carpeta real `vision/`;
- explicitación de mapa interno:
  - núcleo soberano
  - entrada y narrativa
  - traducción a producto
- regla explícita de exclusión para evitar que `vision/` absorba:
  - reportes
  - backlog
  - sprints
  - evidencia
  - decisiones técnicas archivo por archivo

## Resultado

La carpeta `vision/` queda consolidada como bloque soberano de dirección, con índices correctos y sin necesidad de reorganización estructural adicional.
