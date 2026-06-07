# Vision Change Protocol

## Objetivo

Definir como debe cambiar la vision para evitar contradicciones, ruido o drift entre direccion estrategica e implementacion.

## Regla principal

La fuente primaria de vision es:

- [vision](/home/yoni/labsemse/vision)

Documento canonico:

- [VISION_FUSIONADA_SEMSE_PROMETEO.md](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)

## Jerarquia documental

1. [vision](/home/yoni/labsemse/vision)
2. [docs/vision](/home/yoni/labsemse/project-manager-app/docs/vision)
3. [docs/foundation](/home/yoni/labsemse/project-manager-app/docs/foundation)
4. codigo y contratos tecnicos

## Que tipo de cambios requieren actualizar vision

Actualizar `vision` si cambia:

- direccion de producto;
- alcance de las capas `Jobs`, `Ops`, `Trust`, `Prometeo`;
- definicion del MVP;
- jerarquia entre capas;
- fuente de verdad de implementacion;
- principios no negociables;
- narrativa central;
- decision estructural ya bloqueada.

## Que tipo de cambios no requieren actualizar vision

No hace falta tocar `vision` por:

- refactors tecnicos internos;
- nombres de archivos;
- reorganizaciones pequenas del codigo;
- detalles de implementacion que no cambian direccion;
- ajustes menores de UI;
- scripts auxiliares.

## Flujo correcto de cambio

### Si cambia la estrategia

1. actualizar [vision](/home/yoni/labsemse/vision)
2. actualizar la copia operativa en [docs/vision](/home/yoni/labsemse/project-manager-app/docs/vision)
3. revisar impacto en [docs/foundation](/home/yoni/labsemse/project-manager-app/docs/foundation)
4. revisar impacto en `program`

### Si cambia solo la implementacion tecnica

1. actualizar [docs/foundation](/home/yoni/labsemse/project-manager-app/docs/foundation)
2. actualizar codigo
3. no tocar `vision` salvo que cambie direccion real

## Regla de contradiccion

Si aparece contradiccion entre:

- `vision`
- `docs/vision`
- `docs/foundation`
- codigo

el orden de resolucion debe ser:

1. verificar la fuente canonica en `vision`
2. alinear `docs/vision`
3. alinear `docs/foundation`
4. alinear codigo

## Preguntas antes de cambiar vision

Antes de cambiar la vision, responder:

1. cambia la direccion o solo el detalle tecnico
2. mejora la claridad o agrega ruido
3. entra en conflicto con una decision bloqueada
4. obliga a reordenar roadmap o capas
5. afecta al MVP o solo al largo plazo

## Regla de sobriedad

La vision debe cambiar lento.

No se deben abrir nuevos documentos o nuevas ideas en `vision` si:

- solo reformulan lo mismo;
- duplican contenido;
- agregan complejidad sin funcion clara.

## Resultado esperado

El sistema debe poder evolucionar tecnicamente sin perder coherencia estrategica.
