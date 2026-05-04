# ARCHIVE_POLICY

## Proposito

Definir cuando una carpeta, app, demo o snapshot debe congelarse, archivarse o ignorarse como fuente de trabajo.

## Estados permitidos

### `CANONICAL`

Fuente activa y autorizada para evolucion estructural.

### `TRANSITIONAL`

Fuente temporal que todavia aporta valor, pero cuyo destino es ser absorbida o sustituida.

### `REFERENCE ONLY`

Carpeta util para consulta o extraccion puntual, pero no para desarrollo directo continuo.

### `FROZEN`

Carpeta cerrada a nueva evolucion. Puede consultarse, pero no debe seguir recibiendo cambios de producto.

### `ARCHIVED`

Carpeta cuyo valor ya fue absorbido o cuya utilidad es historica. Se preserva solo por trazabilidad.

### `IGNORE AS SOURCE`

Artefacto generado o dependencia instalada. Nunca debe tratarse como fuente.

## Criterios para congelar

Una carpeta debe pasar a `FROZEN` si:

- duplica una capacidad ya absorbida por el tronco canonico
- compite visual o tecnicamente con la app principal
- ya no tiene una ruta clara de evolucion independiente
- su valor es de referencia, no de desarrollo

## Criterios para archivar

Una carpeta debe pasar a `ARCHIVED` si:

- su valor ya fue extraido
- no debe seguir usandose ni como referencia frecuente
- su presencia solo agrega ruido
- conserva valor historico o de auditoria

## Criterios para ignorar como fuente

Se marcan como `IGNORE AS SOURCE`:

- `dist/`
- `node_modules/`
- `.next/`
- builds generados
- caches
- bases de datos locales de prueba
- tarballs

## Metadata minima para carpetas congeladas o archivadas

Toda carpeta `FROZEN` o `ARCHIVED` debe tener un `README.md` con:

1. estado
2. fecha
3. motivo
4. valor que aporta
5. destino del valor reutilizable
6. instruccion explicita de no desarrollar ahi

## Regla de extraccion

Antes de archivar una carpeta con valor:

1. identificar modulos reutilizables
2. decidir si se extraen ahora o despues
3. registrar explicitamente lo no extraido
4. archivar solo cuando la decision sea consciente

## Politica actual sugerida para `labsemse`

### FROZEN

- `app semse/Agent_Matriz de agentes`
- `app semse/Agent_Chat semántico sobre PDFs`
- `app semse/app`

### REFERENCE ONLY

- `app semse/semse-control-mvp`
- `app semse/Agent_Semse App Maximizada`

### IGNORE AS SOURCE

- `dist/`
- `node_modules/`
- `.next/`
- `apps/` en raiz mientras no se rescate algo especifico

## Resultado esperado

El repositorio deja de arrastrar ambiguedad historica y cada carpeta tiene una condicion de uso clara.
