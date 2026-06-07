# SEMSE Developer Runtime Blueprint

## Proposito

SEMSE Developer Runtime define la capa operativa agentiva para trabajo tecnico dentro del ecosistema SEMSE.

Su funcion no es exponer "una terminal con IA pegada", sino convertir una intencion tecnica en una mision ejecutable, gobernada, verificable y auditable.

Principio rector:

- la terminal no es el cerebro;
- la terminal es un actuador del sistema;
- el cerebro vive en interpretacion, planeacion, orquestacion, agentes, memoria, validacion y gobernanza.

## Formula canonica

`Intencion -> Clasificacion -> Planeacion -> Ejecucion -> Verificacion -> Evidencia -> Cierre`

## Diferencia estructural frente a un copiloto simple

Un copiloto tradicional:

- responde prompts;
- ayuda a editar codigo;
- a veces ejecuta algo.

SEMSE Developer Runtime:

- entiende el objetivo tecnico;
- descompone el trabajo en pasos verificables;
- selecciona agentes y herramientas;
- ejecuta dentro de limites de autonomia;
- valida el resultado;
- registra evidencia operativa;
- recuerda contexto del repo y del ecosistema.

## Objetivo funcional

El sistema debe permitir intenciones como:

- "levanta este repo"
- "corrige el build"
- "instala lo necesario"
- "crea un modulo nuevo"
- "analiza esta base de codigo"
- "refactoriza auth"

Y convertirlas en una mision operativa real.

## Capas oficiales

### 1. Experience Layer

Interfaz donde el usuario:

- expresa la intencion;
- ve plan, terminal, diff, validaciones y evidencia;
- aprueba acciones sensibles;
- inspecciona historial y artefactos.

### 2. Intent Layer

Convierte lenguaje natural en tarea estructurada:

- objetivo;
- categoria;
- nivel de riesgo;
- contexto del repo;
- necesidad de aprobacion.

### 3. Planning Layer

Transforma la tarea en pasos ordenados y verificables.

### 4. Orchestration Layer

Coordina:

- agentes;
- herramientas;
- memoria;
- permisos;
- reintentos;
- checkpoints;
- cierre de la mision.

### 5. Agent Layer

Agentes especializados por rol tecnico.

### 6. Tool Layer

Conjunto de herramientas normalizadas, tipadas y auditables.

### 7. Validation Layer

Confirma si el objetivo se cumplio realmente.

### 8. Governance Layer

Controla permisos, aprobaciones, limites y enforcement.

### 9. Memory Layer

Mantiene contexto persistente del repo, usuario, mision y arquitectura.

### 10. Audit Layer

Registra logs, comandos, salidas, artefactos y decisiones.

### 11. Provider Layer

Abstrae modelos y proveedores segun capacidad requerida.

## Taxonomia minima de agentes

### `diagnostic-agent`

- inspeccion de repo
- deteccion de stack
- lectura de errores
- localizacion de bloqueos

### `runtime-agent`

- shell
- procesos
- dependencias
- logs
- verificacion de entorno

### `backend-agent`

- NestJS
- Prisma
- APIs
- auth
- workers

### `frontend-agent`

- React
- Next.js
- Vite
- Tailwind
- UX tecnico

### `devops-agent`

- Docker
- CI/CD
- variables
- observabilidad

### `qa-agent`

- tests
- smoke
- regresiones

### `doc-agent`

- changelog
- ADR
- bitacora tecnica

### `governance-agent`

- riesgo
- permisos
- aprobaciones
- bloqueo de operaciones sensibles

### `architect-agent`

- fronteras modulares
- no duplicacion
- alineacion con arquitectura canonica

## Contrato de herramientas

La regla es `tool-first`, no `prompt-first`.

Herramientas minimas:

- `runCommand`
- `readFile`
- `writeFile`
- `patchFile`
- `listFiles`
- `searchCode`
- `runBuild`
- `runLint`
- `runTests`
- `gitStatus`
- `gitDiff`
- `installDependencies`
- `inspectEnv`
- `requestApproval`

Cada herramienta debe:

- aceptar input tipado;
- devolver output tipado;
- registrar duracion;
- registrar error estructurado;
- registrar actor/agente;
- ser auditable;
- obedecer policy engine.

## Niveles de autonomia

### `observation`

Solo diagnostico y lectura.

### `suggestion`

Propone plan, comandos y parches.

### `safe-execution`

Ejecuta acciones de bajo riesgo automaticamente.

### `supervised-execution`

Ejecuta acciones con checkpoints y aprobaciones.

### `controlled-autonomy`

Mision completa en entorno restringido.

Arranque recomendado para SEMSE:

- observation
- suggestion
- safe-execution

## Regla de cierre

SEMSE no puede declarar una mision como resuelta sin verificacion explicita o razon documentada para `skipped`.

Principio:

- `verify-before-claim`

## Evidencia operativa obligatoria

Cada mision debe poder responder:

- que quiso lograr el usuario;
- que plan construyo el sistema;
- que comandos se ejecutaron;
- que archivos se tocaron;
- que diffs se generaron;
- que validaciones pasaron o fallaron;
- que riesgos quedaron abiertos.

Artefactos minimos:

- output de comandos;
- diff;
- archivos creados o modificados;
- resultados de build/lint/test;
- resumen final de la mision.

## Memoria contextual

SEMSE debe iniciar con contexto y no "ciego".

Memorias minimas:

- memoria del repo
- memoria del usuario
- memoria de la mision
- memoria arquitectonica

## Flujos canonicos iniciales

### Bootstrap

- inspeccion
- deteccion de stack
- revision de entorno
- instalacion
- build/dev
- validacion

### Fix de build

- reproducir
- capturar error
- localizar fuente
- parchear
- recompilar
- validar

### Generacion de modulo

- entender requerimiento
- ubicar frontera correcta
- crear archivos
- integrar
- validar
- documentar

### Auditoria tecnica

- revisar estructura
- revisar scripts y dependencias
- revisar salud tecnica
- emitir backlog

## Mapa canónico en SEMSE

### Capa ecosistema

- este blueprint vive en `program/architecture`

### Capa monorepo

- la traduccion tecnica vive en `project-manager-app/docs/foundation`

### Capa agent runtime

- el prompt maestro y material operativo viven en `agents/agent-runtime`

## Roadmap recomendado

### Fase 1

- intent interpreter
- execution planner
- runtime shell adapter
- validation engine
- logs y artifacts

### Fase 2

- approval gateway
- diff viewer
- memoria por repo
- sesiones persistentes

### Fase 3

- multiagente real
- policy engine maduro
- routing por proveedor/capacidad

### Fase 4

- autonomia supervisada completa
- reintentos inteligentes
- observabilidad profunda

## Documento relacionado

- spec tecnica: `/home/yoni/labsemse/project-manager-app/docs/foundation/SEMSE_DEVELOPER_RUNTIME_SPEC.md`
- prompt maestro: `/home/yoni/labsemse/agents/agent-runtime/architecture/PROMPT_MAESTRO_SEMSE_DEVELOPER_RUNTIME.md`
