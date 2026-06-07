# Job vs Project Boundary

## Fuente Canonica

Este documento traduce:

- [`/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md`](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)

## Regla Central

- `Job` es la entidad canonica del marketplace y del lenguaje de producto
- `Project` es una abstraccion operativa transitoria de ejecucion

La implementacion actual todavia usa `Project` para varias responsabilidades de
runtime.
Eso no cambia la lectura correcta del dominio.

## Definicion de Job

`Job` representa:

- la oportunidad comercial publicada por un cliente
- el alcance de trabajo
- la categoria
- la ubicacion
- el presupuesto
- el estado comercial del flujo
- la relacion principal con cliente, pro y contrato

`Job` debe ser la referencia principal para:

- publicacion
- reserva
- aceptacion
- contrato
- ratings
- mensajeria contextual
- vista comercial del lifecycle

## Definicion de Project

`Project` representa:

- la materializacion operativa de un `Job` aceptado
- la asignacion actual al pro ejecutor
- la ejecucion de milestones
- el escrow operativo actual
- la evidencia y las disputas heredadas del runtime

`Project` debe leerse como soporte transitorio para:

- milestones
- escrow
- evidence
- parte de disputes
- parte de reporting operativo

## Tabla de Responsabilidades

### Job

Responsabilidades canonicas:

- identidad comercial del trabajo
- ownership del cliente via `clientOrgId`
- estado comercial principal
- reserva y aceptacion
- contrato digital
- relacion canonica con ratings

No debe concentrar todavia, en esta transicion:

- todas las escrituras de milestones
- todas las escrituras de escrow
- evidence runtime heredada

### Project

Responsabilidades transitorias:

- execution context derivado de un `Job`
- `assignedProOrgId`
- estado operativo de ejecucion
- enlace con milestones actuales
- enlace con escrow actual
- enlace con evidence/disputes actuales

No debe redefinir:

- el lenguaje principal de producto
- el ownership comercial del trabajo
- el significado canonico de la transaccion

## Reglas de Lectura

### Producto

Cuando se hable de:

- publicar
- reservar
- aceptar
- contratar
- pagar por hitos
- disputar trabajo

la lectura correcta debe partir desde `Job`, aunque el runtime todavia derive a
`Project`.

### Operaciones

Cuando se hable de:

- ejecucion actual
- milestones
- escrow activo
- evidence runtime
- trazabilidad operativa

puede aparecer `Project` como agregado tecnico transitorio.

## Ownership

### Job

- cliente dueno: `job.clientOrgId`
- profesional candidato o asignado: via reserva aceptada o contrato actual;
  `bid` queda como discovery/legacy

### Project

- cliente relacionado: `project.job.clientOrgId`
- pro asignado: `project.assignedProOrgId`

## Regla de Evolucion

Cada decision nueva debe preguntarse:

1. esto pertenece al lenguaje canonico de producto?
2. si la respuesta es si, debe vivir en `Job` o al menos modelarse primero desde `Job`
3. solo si el runtime heredado obliga, se implementa temporalmente en `Project`

## Regla Job-First para Sprint 1

Durante el cierre del happy path canonico:

- toda ruta nueva debe partir desde `jobId` o una entidad canonica derivada de `Job`
- `projectId` solo puede sobrevivir como puente transicional
- no deben nacer contratos nuevos de producto que profundicen `Project` como centro del flujo
- las surfaces nuevas deben hablar en lenguaje de `Job`, no de `Project`

## Decision Operativa

No se deben abrir features nuevas profundizando `Project` como si fuera la
entidad canonica del producto.

Si se toca `Project`, debe quedar claro si el cambio es:

- endurecimiento tecnico transitorio
- o parte de una migracion controlada hacia `Job`
