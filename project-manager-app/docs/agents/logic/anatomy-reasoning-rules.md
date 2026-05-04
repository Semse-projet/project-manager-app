# Anatomy Reasoning Rules

## Principios

1. Un agente anatómico no responde desde memoria libre si puede consultar el nodo canónico.
2. `part_of` manda sobre inferencias narrativas ambiguas.
3. Las respuestas deben preservar la ruta jerárquica cuando exista.
4. Un término libre debe normalizarse antes de resolver nodos.
5. Si no hay nodo canónico, el agente debe decirlo explícitamente.

## Reglas por agente

### AnatomyIngestorAgent

- extrae referencias anatómicas desde texto;
- no canoniza por sí solo;
- propone coincidencias.

### AnatomyNormalizerAgent

- normaliza ids y aliases;
- resuelve términos a nodos canónicos;
- evita duplicados semánticos.

### AnatomyValidatorAgent

- revisa integridad del árbol;
- detecta padres faltantes;
- detecta relaciones inválidas.

### AnatomyTutorAgent

- responde usando nodo, hijos, relaciones y path;
- explica de mayor a menor;
- no inventa subpartes fuera de la seed.

