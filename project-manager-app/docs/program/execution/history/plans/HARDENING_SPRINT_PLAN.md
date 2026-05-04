# Hardening Sprint Plan

## Fuente Canonica

Este plan se alinea con:

- [`/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md`](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)

Y se traduce tecnicamente en:

- [`/home/yoni/labsemse/project-manager-app/docs/foundation`](/home/yoni/labsemse/project-manager-app/docs/foundation)

## Objetivo

Endurecer la base actual para que el sistema sea:

- mas seguro
- mas coherente a nivel de dominio
- mas estable a nivel de integracion
- mas facil de evolucionar hacia el modelo canonico `Job -> execution`

## Reglas de Trabajo

- no abrir features nuevas sobre zonas ambiguas
- no profundizar deuda heredada si contradice la vision
- priorizar invariantes de dominio sobre conveniencia de implementacion
- preservar compatibilidad externa mientras exista transicion
- dejar cada sprint con validacion real

## Sprint 1. Dominio e Invariantes

### Objetivo

Congelar semantica y responsabilidades de `Job`, `Project`, `Milestone`, `Escrow` y `Dispute`.

### Trabajo

- definir que vive en `Job`
- definir que sigue viviendo en `Project` como transicion
- escribir tabla de invariantes por agregado
- documentar lifecycle oficial y condiciones de cambio
- marcar estados historicos como compatibilidad, no como lenguaje canonico

### Entregables

- `DOMAIN_INVARIANTS.md`
- `JOB_VS_PROJECT_BOUNDARY.md`
- actualizacion de `DOMAIN_MODEL_MVP.md`

### Definition of Done

- cualquier worker puede explicar:
  - que es `Job`
  - que es `Project`
  - quien posee cada recurso
  - que transiciones son validas

## Sprint 2. Seguridad y Ownership

### Objetivo

Cerrar autorizacion por recurso en agregados vecinos de `projects`.

### Trabajo

- revisar `payments`
- revisar `milestones`
- revisar `evidence`
- revisar `disputes`
- verificar permisos sensibles y financial reads
- evitar cualquier acceso solo por `tenantId`

### Entregables

- policies o checks por agregado
- permisos actualizados si hace falta
- smoke de denegacion por ownership

### Definition of Done

- cliente solo ve lo suyo
- pro solo ve lo asignado a su org
- `OPS_ADMIN` opera con privilegio explicito
- financials no quedan abiertos por accidente

## Sprint 3. Contratos Compartidos

### Objetivo

Hacer que `packages/schemas` sea el contrato real entre backend y web.

### Trabajo

- alinear schemas con shapes reales del backend
- eliminar tipos duplicados innecesarios en `web`
- definir snapshots y responses compartidas por agregado
- revisar enums y nombres

### Entregables

- schemas publicados y usados por consumidores reales donde sea seguro
- matriz `backend -> schema -> web`

### Definition of Done

- backend y schemas describen lo mismo
- cualquier divergencia queda documentada como transicion

## Sprint 4. Integracion Web y Proxy

### Objetivo

Hacer que `apps/web` degrade correctamente frente a permisos reales, runtime parcial y errores de dominio.

### Trabajo

- endurecer proxy `/api/semse/*`
- preservar `403/404/409`
- normalizar mensajes
- garantizar fallback seguro cuando el runtime no esta configurado
- revisar control surface y cortex contra contratos reales

### Entregables

- web build estable
- UX que tolere acceso parcial
- warnings visibles y no engañosos

### Definition of Done

- el build no cae por el proxy
- la UI no asume acceso total
- los errores del backend llegan con semantica util

## Sprint 5. Transicion Job -> Project

### Objetivo

Reducir dependencia estructural de `Project` como agregado principal sin romper API actual.

### Trabajo

- listar responsabilidades hoy atrapadas en `Project`
- separar lectura canonica de escritura heredada
- mover primero lenguaje y contratos
- luego mover lifecycle y relaciones
- mantener rutas legacy mientras exista dependencia real

### Entregables

- `JOB_PROJECT_TRANSITION_MAP.md`
- backlog tecnico de migracion incremental
- primeros cambios de lectura canonica si son seguros

### Definition of Done

- existe mapa claro de transicion
- ya no se toman decisiones nuevas profundizando la deuda de `Project`

## Sprint 6. Validacion y Operacion

### Objetivo

Cerrar una base verificable para futuras expansiones.

### Trabajo

- typecheck
- build api
- build web
- smoke de proyectos
- smoke de marketplace si se toca dominio
- smoke de milestones/disputes si se tocan agregados

### Entregables

- `VALIDATION_STATUS.md`
- lista corta de bloqueos reales si algo falla

### Definition of Done

- evidencia de validacion real
- no solo compilacion local parcial

## Orden Recomendado

1. Sprint 1
2. Sprint 2
3. Sprint 3
4. Sprint 4
5. Sprint 6
6. Sprint 5

## Nota de Ejecucion

Aunque `Sprint 5` es estrategicamente importante, conviene ejecutarlo despues de
cerrar dominio, seguridad y contratos. Si se adelanta demasiado, mezcla migracion
estructural con endurecimiento y aumenta el riesgo.
