# SEMSE Consolidation Action Plan

> Nota histórica: este plan captura acciones propuestas antes de que la consolidación principal del repositorio quedara cerrada. Algunas tareas ya fueron absorbidas o superadas por el estado actual de `labsemse`.

## Objetivo

Convertir `labsemse` de un ecosistema fragmentado en una sola plataforma SEMSEproject gobernada por un monorepo canonico.

## Decision oficial

El nucleo canonico definitivo es:

- `app semse/project-manager-app`

La raiz actual queda asi:

- `src/` = fuente transicional de UX
- `vision/` = fuente oficial de vision
- `program/` = fuente oficial de ejecucion
- resto = extraible, congelable, archivabile o ignorable como fuente

## Fase 0. Decision Arquitectonica Oficial

### Objetivo

Cerrar la ambiguedad sobre donde vive el sistema real.

### Resultado

- `project-manager-app` pasa a ser el tronco canonico
- no se crean nuevas apps paralelas
- toda nueva logica estructural entra al monorepo

## Fase 1. Limpieza de precedencia

### Objetivo

Volver visible la jerarquia del sistema.

### Acciones

- crear o mantener:
  - `repository-rules/CANONICITY.md`
  - `repository-rules/CONTRIBUTING.md`
  - `repository-rules/ARCHIVE_POLICY.md`
  - `repository-rules/MIGRATION_RULES.md`
- declarar reglas de precedencia
- marcar carpetas no canonicas con su estado

### Resultado esperado

Cualquier persona entiende en minutos:

- que carpeta manda
- que carpeta es referencia
- que carpeta esta congelada

## Fase 2. Limpieza rapida del repo

### Objetivo

Reducir ruido y evitar lecturas equivocadas del ecosistema.

### Acciones

#### Freeze inmediato

- `app semse/Agent_Matriz de agentes`
- `app semse/Agent_Chat semántico sobre PDFs`
- `app semse/app`

#### Preservar para extraccion

- `app semse/semse-control-mvp`
- `app semse/Agent_Semse App Maximizada`

#### Ignore as source

- `dist/`
- `node_modules/`
- `.next/`
- builds y caches

#### Revisar antes de eliminar

- `apps/` en raiz

### Resultado esperado

El repo deja de parecer un conjunto de plataformas compitiendo.

## Fase 3. Prioridad maxima: `packages/ui`

### Objetivo

Crear la capa de interfaz compartida que hoy falta.

### Componentes iniciales

1. `StatusBadge`
2. `StatCard`
3. `JobCard`
4. `AgentChatPanel`
5. `AppShell`

### Regla

Todo componente reutilizable nuevo entra primero en `packages/ui`.

### Resultado esperado

Se reduce la duplicacion entre `src/`, `apps/web` y referencias paralelas.

## Fase 4. Unificacion de contratos y tipos

### Objetivo

Eliminar divergencia entre UX, backend y datos.

### Acciones

- auditar `src/types/index.ts`
- cruzar con:
  - `packages/schemas`
  - `packages/db`
  - DTOs del backend
- clasificar cada tipo como:
  - igual
  - parecido
  - ViewModel
  - obsoleto
  - faltante

### Regla

- dominio compartido = `packages/schemas`
- presentacion local = app correspondiente
- tipos paralelos = en extincion

## Fase 5. Unificacion de fuente de datos

### Objetivo

Cerrar la ambiguedad entre fuentes de dominio.

### Decision

Para flujos core:

- Prisma/PostgreSQL = fuente oficial
- Nest API = puerta oficial
- Supabase = transitorio o auxiliar
- SQLite MVP = referencia o fixture

### Acciones

- no agregar nuevos modulos core acoplados directamente a Supabase
- construir matriz de equivalencia:
  - tabla legacy
  - modelo prisma
  - contrato canónico
  - transformacion

## Fase 6. Migracion del frontend por funcionalidad

### Regla madre

No migrar archivos.
Migrar funcionalidad.

### Orden recomendado

1. `PanelProfesional`
2. `Agenda`
3. `Evidencias`
4. `Profesionales`
5. `Escrow`
6. `AssistantSettings`

### Proceso por pagina

1. leer la pagina actual como spec UX
2. reconstruirla en `apps/web`
3. usar `packages/ui`
4. consumir `apps/api`
5. usar `packages/schemas`
6. validar con TypeScript
7. marcar la fuente vieja como absorbida

## Fase 7. Absorcion selectiva de valor externo

### Desde `semse-control-mvp`

Extraer:

- worklog
- evidence workflow
- knowledge flow
- milestone ops
- reporting patterns

### Desde `Agent_Semse App Maximizada`

Extraer:

- k8s
- compose
- observabilidad
- blueprint de servicios y agentes

### Desde `Agent_Chat semántico sobre PDFs`

Extraer:

- ingesta documental
- retrieval
- consulta semantica

## Fase 8. Consolidacion documental

### Objetivo

Evitar drift entre vision, programa y codigo.

### Reglas

- `vision/` queda blindado como fuente oficial
- `program/` queda como ejecucion oficial
- `docs/vision` espejo solo lectura
- la sincronizacion debe ser unidireccional desde `vision/`

## Fase 9. Freeze y archivo

### Objetivo

Cerrar oficialmente las lineas paralelas.

### Congelar

- `Agent_Matriz de agentes`
- `Agent_Chat semántico sobre PDFs`
- demos aisladas

### Archivar despues de extraer valor

- `semse-control-mvp`
- snapshots viejos
- ramas paralelas no activas

## Fase 10. Definir el core lanzable

### Backend minimo

- auth real
- jobs
- milestones
- evidence
- escrow minimo
- disputes minimo
- trust minimo

### Frontend minimo

- publish job
- client dashboard
- worker dashboard
- evidence flow
- escrow flow basico
- agenda base

### Plataforma minima

- `packages/ui` vivo
- contratos unificados
- API como fuente oficial
- auditabilidad minima

## Orden de ejecucion real sugerido

### Semana 1

- declarar canonicidad
- limpiar precedencia
- etiquetar carpetas

### Semana 2

- crear `packages/ui`
- mover 5 componentes base

### Semana 3

- auditar tipos
- definir politica de contratos
- matriz de equivalencia de datos

### Semana 4

- migrar `PanelProfesional`
- iniciar `Agenda`

### Semana 5

- migrar `Evidencias`
- iniciar `Escrow`

### Semana 6

- absorber `Profesionales`
- ajustar flujos client/worker

### Semana 7

- extraer valor de `semse-control-mvp`
- extraer infra y patterns de `Agent_Semse App Maximizada`

### Semana 8

- congelar ramas paralelas
- actualizar documentacion de estado

## Priorizacion absoluta

1. declarar `project-manager-app` como nucleo oficial
2. construir `packages/ui`
3. unificar tipos con `packages/schemas`
4. mover frontend de `src/` a `apps/web` por funcionalidad
5. cortar dependencia core de Supabase
6. congelar ramas paralelas

## Frase final

La solucion para SEMSEproject no es seguir explorando mas ramas.

La solucion es:

- consolidar
- endurecer
- unificar
- migrar
