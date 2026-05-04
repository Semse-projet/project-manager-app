# Analisis Estructural Integral de `labsemse`

- Fecha: 2026-04-11
- Alcance: lectura de `labsemse/` como un solo proyecto
- Objetivo: identificar estructura real, contradicciones operativas, fronteras de autoridad y acciones para solidificar el repositorio

## Tesis

`labsemse` ya tiene una doctrina clara de canonicidad, pero todavia no esta completamente materializada en la forma fisica del repositorio.

La estructura soberana existe y es coherente:

- `constitution/`
- `vision/`
- `program/`
- `repository-rules/`
- `agents/`

El tronco tecnico canónico tambien existe y funciona:

- `project-manager-app/`

El problema principal no es falta de criterio.  
El problema es que siguen conviviendo multiples centros tecnicos legibles y ejecutables alrededor del canon:

- la app Vite de raiz `src/` con su propio `package.json`
- `supabase/` con README upstream no contextualizado
- varios satellites pesados en `app semse/_satellites-archive/`
- espejos documentales dentro de `project-manager-app/docs/vision/`
- un repo git raiz en estado muy desordenado

En otras palabras:

> la arquitectura conceptual esta bastante bien definida, pero el cableado fisico del repo sigue permitiendo lecturas equivocadas y reactivacion accidental de lineas paralelas.

## Mapa de autoridad actual

### Capa soberana

Define direccion, precedencia y lenguaje oficial:

- `constitution/`
- `vision/`
- `program/`
- `repository-rules/`
- `agents/`

### Capa operativa canónica

Implementacion viva principal:

- `project-manager-app/`

Valida hoy como centro tecnico porque:

- tiene backend NestJS, web Next.js, worker y packages compartidos;
- sus builds principales funcionan;
- la documentacion lo reconoce como tronco oficial.

### Capa transicional

Sigue reteniendo valor funcional o infra heredada:

- `src/`
- `supabase/`

### Capa historica y satelital

Debe leerse como referencia o distilacion, no como base viva:

- `app semse/`
- `archive/`
- `_governance/`
- `semse/`
- `openai/`

### Capa de evidencia

Memoria verificable del trabajo:

- `reportes/`

## Evidencia estructural relevante

### 1. El canon esta bien declarado

Los documentos de canonicidad son consistentes en el punto central:

- `README.md`
- `repository-rules/CANONICITY.md`
- `project-manager-app/README.md`
- `project-manager-app/docs/SOURCE_OF_TRUTH.md`

Todos ubican a `project-manager-app/` como tronco tecnico principal.

### 2. La raiz todavia contiene una app viva paralela

La raiz tiene:

- `package.json`
- `src/`
- `index.html`
- `dist/`
- `node_modules/`

Esto no es solo residuo documental.  
Es una aplicacion Vite completa, instalable y ejecutable.

Aunque la doctrina la llama "transicional", fisicamente sigue compitiendo con el monorepo como centro de gravedad de frontend.

### 3. `src/` conserva demasiada superficie de producto

Dentro de `src/` siguen vivos:

- paginas comerciales completas;
- dashboard de agentes;
- hooks de jobs, escrow, professionals y notifications;
- cliente Supabase;
- UI kit local muy extenso.

Eso indica que la transicion a `project-manager-app/apps/web` no esta cerrada semantica ni operacionalmente.

### 4. `supabase/` esta mal contextualizado

`supabase/STATUS.md` clasifica bien la carpeta como transicional y no canónica.

Pero `supabase/README.md` es esencialmente la documentacion upstream del Supabase CLI.  
Eso rompe claridad local porque la primera lectura visible de la carpeta no explica su rol real dentro de `labsemse`.

### 5. Hay duplicacion documental controlada, pero no completamente endurecida

`project-manager-app/docs/vision/` replica `vision/`.

Los nombres coinciden, pero no todos los archivos son identicos:

- divergen `README.md`
- diverge `VISION_INDEX.md`
- diverge `VISION_CHANGE_PROTOCOL.md`

Esto crea una situacion de "espejo no exacto":

- suficiente para confundir;
- suficiente para reabrir contradicciones;
- insuficiente para llamarlo copia de solo lectura estricta.

### 6. `app semse/_satellites-archive/` sigue siendo demasiado pesado

Tamaños aproximados:

- `project-manager-copi`: `1.4G`
- `Agent_Semse App Maximizada`: `886M`
- `semse-control-mvp`: `423M`
- `web-assistant-portal`: `388M`

Eso tiene dos efectos:

- hace mas costosa la lectura y el mantenimiento del repo;
- mantiene muy cerca del centro multiples bases reactivables por error.

### 7. `archive/` esta relativamente bien separada

`archive/` ya cumple mejor su funcion:

- reglas claras;
- subareas definidas;
- tamaño pesado concentrado en `archive/artifacts`.

Comparado con `app semse/_satellites-archive/`, `archive/` esta conceptualmente mas limpio.

### 8. `_governance/` y `reportes/` conservan valor, pero tienen borde fino

`_governance/` funciona como capa historica de control y distilacion.

`reportes/` funciona como evidencia.

La separacion es razonable, pero hay que evitar que:

- `_governance/` vuelva a competir con `program/`;
- `reportes/` se convierta en pseudo-arquitectura por acumulacion de analisis.

### 9. `semse/` es util, pero estructuralmente ambiguo

`semse/` no parece residuo trivial.  
Es un runtime autonomo `node/python` para flujo `task -> branch -> PR`.

Su problema no es calidad intrinseca sino posicion estructural:

- no esta integrado al monorepo canonico;
- no esta plenamente archivado;
- no esta clasificado de forma tan dura como `openai/`.

Hoy vive en una zona gris entre laboratorio serio y subsistema aparte.

### 10. El estado git raiz no transmite control

La raiz `labsemse/` tiene un estado git altamente ruidoso:

- rama `main` sin commits;
- miles de archivos staged, modified o untracked.

Aunque el contenido tenga logica, ese estado impide que el repositorio se comporte como sistema gobernado y dificulta cualquier consolidacion futura.

## Matriz de lectura recomendada

| Zona | Clase real | Autoridad | Estado recomendado |
|---|---|---|---|
| `constitution/` | soberania | maxima | mantener corta, normativa y estable |
| `vision/` | vision de producto | maxima | unica fuente oficial de vision |
| `program/` | ejecucion y roadmap | muy alta | backlog y status vivos |
| `repository-rules/` | gobierno del repo | muy alta | endurecer enforcement |
| `agents/` | canon documental agentic | alta | mantener vinculado a implementacion viva |
| `project-manager-app/` | runtime canonico | maxima en codigo | seguir absorbiendo toda logica nueva |
| `reportes/` | evidencia | media | no usar como arquitectura viva |
| `_governance/` | historia de control y distilacion | media | conservar, pero sin competir con `program/` |
| `src/` | frontend transicional vivo | baja | reducir y marcar como salida programada |
| `supabase/` | infra transicional/legacy | baja | contextualizar y luego archivar o absorber |
| `app semse/` | contenedor satelital pesado | muy baja | desactivar semantica operativa y mover peso al archivo formal |
| `archive/` | archivo formal | baja | mantener como destino historico |
| `semse/` | laboratorio autonomo util | media-baja | decidir si se integra, se documenta aparte o se archiva |
| `openai/` | vendor snapshot | ninguna | referencia puntual solamente |

## Contradicciones principales a resolver

### Contradiccion 1

Se afirma "un solo proyecto", pero hay dos centros tecnicos legibles:

- raiz Vite (`package.json` + `src/`)
- monorepo canónico (`project-manager-app/`)

### Contradiccion 2

Se afirma que `project-manager-app/docs/vision/` es espejo, pero el espejo no es exacto.

### Contradiccion 3

Se afirma que `supabase/` es transicional, pero su README principal no lo comunica.

### Contradiccion 4

Se afirma que los satellites estan congelados, pero `app semse/` sigue pesando `3.0G` y conserva copias completas muy cercanas al centro operativo.

### Contradiccion 5

Se afirma gobernanza y consolidacion, pero el estado git raiz todavia no expresa un baseline estable.

## Riesgos operativos

1. Un agente o desarrollador puede volver a tocar `src/` como si fuera frontend oficial.
2. Un espejo de vision desalineado puede contaminar decisiones dentro del monorepo.
3. `supabase/` puede ser interpretado como infraestructura activa por mera prominencia de su README.
4. Los satellites grandes pueden seguir usandose como "fuente facil" en vez de destilar capacidades puntuales.
5. El estado git raiz puede volver imposible distinguir consolidacion real de acumulacion accidental.

## Propuesta de solidificacion

### Fase 1. Endurecer la lectura del repo

Objetivo: que cualquier lectura superficial ya conduzca al canon correcto.

Acciones:

1. convertir el `package.json` de raiz en wrapper de navegacion o mantenimiento, no en app activa principal;
2. poner un `README.md` muy visible en `src/` declarando:
   - que es transicional;
   - que no recibe logica nueva;
   - a donde migra cada capacidad;
3. reemplazar o reescribir `supabase/README.md` con contexto SEMSE antes del contenido upstream;
4. agregar una tabla maestra `zona -> clase -> autoridad -> regla` en raiz o en `repository-rules/`.

### Fase 2. Cerrar espejos ambiguos

Objetivo: eliminar duplicacion que parece canónica.

Acciones:

1. decidir si `project-manager-app/docs/vision/`:
   - se elimina y queda solo enlace a `/vision/`, o
   - se mantiene como mirror generado automaticamente;
2. si se mantiene, automatizar sync y checksum para evitar divergencia;
3. prohibir edicion manual de cualquier espejo con regla visible y script de verificacion.

### Fase 3. Reducir la superficie transicional

Objetivo: que lo transicional sea una cola corta, no una app paralela.

Acciones:

1. mapear cada pagina y hook de `src/` hacia `project-manager-app/apps/web`;
2. marcar por archivo:
   - absorbido
   - pendiente de absorcion
   - descartado
3. mover piezas no migrables a `archive/prototypes/` cuando ya no aporten valor vivo.

### Fase 4. Reubicar masa satelital

Objetivo: que el peso historico no siga contaminando el centro del repo.

Acciones:

1. evaluar mover parte de `app semse/_satellites-archive/` al archivo formal `archive/`;
2. dejar en `app semse/` solo aquello que todavia este explicitamente en proceso de destilacion;
3. para cada satellite restante, exigir:
   - `STATUS.md`
   - destino canónico
   - valor exacto a extraer
   - criterio de retiro final.

### Fase 5. Resolver la ambiguedad de `semse/`

Objetivo: darle categoria clara.

Opciones validas:

1. integrarlo como subsistema oficial bajo `project-manager-app/packages/` o `tools/`;
2. mantenerlo como laboratorio formal con reglas y frontera explicita;
3. archivarlo si no entra en la ruta real del programa.

Lo invalido es dejarlo en estado gris.

### Fase 6. Saneamiento git

Objetivo: que el estado del repo refleje control y no acumulacion.

Acciones:

1. definir baseline de consolidacion;
2. separar lo que es canon, lo que es archivo y lo que es residuo local;
3. evitar staging masivo indiscriminado;
4. convertir la gobernanza en estado git legible.

## Orden estructural recomendado

La lectura correcta de `labsemse/` deberia quedar asi:

1. soberania:
   - `constitution/`
   - `vision/`
   - `program/`
   - `repository-rules/`
   - `agents/`
2. implementacion viva:
   - `project-manager-app/`
3. transicion controlada:
   - `src/`
   - `supabase/`
4. laboratorios explicitamente clasificados:
   - `semse/`
5. historia y archivo:
   - `archive/`
   - `app semse/` o su equivalente reducido
   - `_governance/`
6. evidencia:
   - `reportes/`
7. vendor/reference:
   - `openai/`

## Conclusión

`labsemse` si puede leerse como un solo proyecto.  
De hecho, ya tiene suficiente arquitectura documental para sostener esa lectura.

Lo que falta no es inventar una nueva estructura.  
Lo que falta es volver irreversible la estructura ya decidida:

- menos centros tecnicos aparentes;
- menos espejos ambiguos;
- menos satellites pesados cerca del centro;
- mas señales fisicas de precedencia;
- y un estado git que exprese consolidacion real.

## Siguiente movimiento recomendado

El siguiente trabajo de mayor impacto no es escribir mas documentos conceptuales.

Es ejecutar un paquete corto de solidificacion estructural:

1. endurecer `src/` y `supabase/` como transicionales visibles;
2. cerrar la duplicacion de `docs/vision/`;
3. reclasificar o mover parte de `app semse/_satellites-archive/`;
4. definir categoria final de `semse/`;
5. limpiar el estado git raiz en torno a una baseline explícita.
