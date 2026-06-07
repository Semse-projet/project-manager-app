# Job-Centric Transition Plan

## Objetivo

Reducir la centralidad historica de `Project` y reordenar el producto alrededor
del flujo canonico definido por la vision:

`Job -> Reservation -> Contract -> Escrow -> Milestone -> Evidence -> Review -> Release -> Dispute/Close`

## Regla principal

- `Job` es la unidad principal de negocio.
- `Project` no define el canon del dominio.
- Mientras siga existiendo en el backend actual, `Project` se interpreta como
  abstraccion operativa derivada del `Job`.

## Que se considera transitorio

Hoy el repo todavia concentra varias operaciones en endpoints y modulos de
`projects`, por ejemplo:

- milestones por proyecto;
- escrow y payments por proyecto;
- evidence asociada a la ejecucion;
- disputes nacidas durante el trabajo.

Esto no debe leerse como decision final de dominio.

## Prioridades de migracion

### 1. Lenguaje

- nuevos documentos, schemas y superficies de UI deben hablar primero en
  terminos de `Job`;
- `Project` solo debe aparecer cuando represente ejecucion derivada.

### 2. Contratos

- no crear nuevos contratos cuya raiz conceptual sea `Project` si el flujo
  canonico nace en `Job`;
- cuando un endpoint actual siga siendo `projects/*`, documentarlo como puente
  transicional.

### 3. Modulos

Los modulos que deben ganar entidad propia en el backend son:

- `reservations`
- `contracts`
- `evidence`
- `escrow`
- `ratings`
- `trust`

### 4. UI

- dashboards y control surfaces deben mostrar primero el estado del flujo de
  `Job`;
- `Project` puede mostrarse como capa de ejecucion, no como producto central.

## Criterio de aceptacion para cambios nuevos

Un cambio esta alineado si cumple esto:

- fortalece `Job` como entidad principal;
- no aumenta el acoplamiento conceptual a `Project`;
- separa mejor negocio, finanzas y operacion;
- deja claro que parte es transicion y que parte es dominio objetivo.

Un cambio no esta alineado si:

- expande `Project` como centro del producto;
- crea nuevos enums o schemas centrados en `Project` sin justificacion;
- mezcla estados de negocio y estados financieros;
- introduce UI o integraciones que hagan invisible el flujo canonico.
