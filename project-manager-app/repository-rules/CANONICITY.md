# CANONICITY

## Proposito

Definir la precedencia oficial de codigo, documentacion y arquitectura dentro de `labsemse` para evitar que SEMSEproject siga fragmentandose en multiples lineas paralelas.

## Decision arquitectonica oficial

El tronco canonico definitivo de SEMSEproject es:

- `project-manager-app`

La carpeta raiz `src/` sigue existiendo, pero entra en modo transicional:

- `src/` = fuente temporal de UX y referencia funcional
- no es el destino final del producto
- no debe recibir nueva logica estructural de largo plazo

## Precedencia por capa

### Canon estructural estable

La referencia documental estable del ecosistema vive en:

- `constitution/`
- `vision/`
- `program/`
- `agents/`
- `agents/references/infclaude/`
- `repository-rules/`

Estas carpetas definen criterio, dirección y arquitectura. No deben mezclarse con evidencia fechada ni con prompts operativos.

En particular, la capa de operación asistida del ecosistema se distribuye así:

- definición funcional absorbida: `agents/references/infclaude/`
- formalización arquitectónica: `constitution/` y `program/`
- trazabilidad fechada: `reportes/`

Regla:

- ninguna referencia de operación asistida puede imponerse sobre `constitution/` o `program/` por cercanía al entorno del operador;
- ninguna ejecución fechada en `reportes/` redefine el canon por sí sola;
- toda absorción estable de patrones debe aterrizarse en `agents/references/` y luego reflejarse en el canon si cambia arquitectura.

### Vision oficial

La vision canonicamente valida vive en:

- `vision/`

Si una copia operativa contradice esta carpeta, manda `vision/`.

### Ejecucion oficial

La ejecucion, roadmap, backlog y fases viven en:

- `program/`

`program/` traduce la vision a secuencia de implementacion.

### Backend oficial

La fuente oficial de backend vive en:

- `project-manager-app/apps/api`

No se debe introducir nuevo backend estructural fuera de esa zona.

### Frontend destino

La aplicacion web destino vive en:

- `project-manager-app/apps/web`

### Esquema y contratos oficiales

La fuente oficial de modelo de datos y contratos compartidos vive en:

- `project-manager-app/packages/db`
- `project-manager-app/packages/schemas`

### Workers y automatizacion

La fuente oficial de workers y procesos async vive en:

- `project-manager-app/apps/worker`

### Agentes

La fuente oficial de integracion estructural de agentes debe converger en:

- `project-manager-app/packages/agents`
- o la zona equivalente que se formalice dentro del monorepo

### Evidencia histórica

La evidencia de ejecución, cierres, diagnósticos y validaciones vive en:

- `reportes/`
- `reportes/agent-runtime/`
- `reportes/audits/`

Estos documentos no redefinen el canon estructural. Sirven como trazabilidad.

Incluye expresamente:

- destilaciones de la capa de operación asistida;
- reportes de reorganización del runtime local;
- validaciones de respaldo, memoria operativa y estado efímero.

### Insumos previos al trabajo

Los artefactos previos a la ejecución viven en:

- `reportes/prompts/`
- `reportes/planning/`

Estos materiales orientan trabajo futuro, pero no equivalen a arquitectura canónica ni a evidencia de trabajo terminado.

### Histórico no canónico

Los snapshots, prototipos y residuos preservados viven en:

- `archive/`
- `archive/prototypes/`

No deben usarse como base operativa viva salvo referencia subordinada y explícita.

## Clasificacion oficial de carpetas

### Canonical

- `project-manager-app`
- `constitution/`
- `repository-rules/`
- `agents/`
- `vision/`
- `program/`

### Transitional

- `src/`
- `supabase/`

### Reference only (vendored / external snapshots)

- `openai/`

### Reference only (archived)

- `app semse/_satellites-archive/Agent_Semse App Maximizada`
- `app semse/_satellites-archive/semse-control-mvp`

### Frozen

- `app semse/_satellites-archive/Agent_Matriz de agentes`
- `app semse/_satellites-archive/Agent_Chat semántico sobre PDFs`
- `app semse/_satellites-archive/vite-boilerplate-app`

### Ignore as source

- `dist/`
- `node_modules/`
- `.next/`
- `apps/` en raiz, salvo revision puntual de rescate

## Reglas obligatorias

1. No se crea ninguna app paralela nueva.
2. Toda nueva logica estructural entra al monorepo canonico.
3. Toda extraccion desde carpetas no canonicas se hace:
   - archivo por archivo
   - modulo por modulo
   - con adaptacion a contratos canonicos
4. No se copian carpetas completas hacia el tronco principal.
5. `src/` solo se usa como especificacion UX transitoria hasta que su valor sea absorbido por `apps/web`.
6. `reportes/` no redefine arquitectura: solo conserva evidencia.
7. `reportes/prompts/` y `reportes/planning/` no deben tratarse como canon operativo.
8. `archive/` no se reactiva como base viva sin proceso explícito de migración.
9. `openai/` es referencia técnica externa; no gobierna integración ni runtime de SEMSE.
10. `supabase/` solo conserva valor transicional; la implementación viva manda en `project-manager-app`.

## Regla de resolucion de contradicciones

Si hay contradiccion entre capas, el orden de decision es:

1. `vision/`
2. `program/`
3. `project-manager-app/packages/schemas` y `packages/db`
4. `project-manager-app/apps/api`
5. `project-manager-app/apps/web`

## Regla sobre copias externas

Si aparece un documento con nombre canónico fuera de `labsemse/`, por ejemplo en descargas, skills, exports HTML o carpetas auxiliares del sistema:

- no gana autoridad por nombre;
- no desplaza al documento soberano dentro de `labsemse/`;
- debe tratarse como copia externa, export o residuo de trabajo;
- solo puede usarse como referencia puntual si se documenta explícitamente.

## Código transicional o laboratorios

## Como extraer valor sin fragmentar

Si una carpeta no canonica contiene valor:

1. identificar la capacidad exacta
2. clasificar si es UI, dominio, backend, ops, agente, infra o documento
3. mapearla al modulo destino del monorepo
4. reimplementar o portar solo lo necesario
5. registrar el origen en commit, PR o nota de migracion
6. congelar la fuente una vez absorbida

## Resultado esperado

SEMSEproject deja de funcionar como un conjunto de apps paralelas y pasa a comportarse como una sola plataforma con:

- una vision
- una ruta de ejecucion
- un backend oficial
- un frontend destino
- contratos unificados
- laboratorios controlados
