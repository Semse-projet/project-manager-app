# API Module Map

## Objetivo

Definir el mapa modular del backend para que la implementacion siga el dominio objetivo y no solo el estado historico del repo.

## Modulos Iniciales del MVP

### auth

Responsable de:

- signup;
- login;
- session/me;
- refresh;
- logout;
- actor context.

### users

Responsable de:

- perfil base;
- datos personales;
- rol primario;
- lectura de contexto del usuario.

### professionals

Responsable de:

- perfil profesional;
- verificacion basica;
- membresia;
- licencias y cobertura cuando aplique.

### jobs

Responsable de:

- draft;
- publish;
- list/filter;
- detail;
- ownership;
- cambios permitidos por estado.

### reservations

Responsable de:

- reservar job;
- expirar reserva;
- liberar reserva;
- validar concurrencia.

### contracts

Responsable de:

- generar contrato;
- guardar terminos;
- registrar firmas;
- asociar PDF y hash.

### milestones

Responsable de:

- crear hitos;
- secuenciar hitos;
- submit;
- approve;
- reject;
- request changes.

### evidence

Responsable de:

- presign/upload;
- asociacion a milestone;
- metadata;
- checklist;
- consulta de evidencia.

### escrow

Responsable de:

- fund;
- balance;
- estado de fondos;
- ledger asociado.

### payments

Responsable de:

- provider events;
- reconciliation;
- release;
- refund;
- fees;
- payout semantics.

### disputes

Responsable de:

- abrir disputa;
- asignar;
- revisar;
- resolver;
- congelar efectos financieros si aplica.

### ratings

Responsable de:

- crear rating;
- validar elegibilidad;
- consultar reputacion declarativa.

### notifications

Responsable de:

- email;
- app notifications;
- eventos asincronos del flujo.

### audit

Responsable de:

- append-only log;
- consultas operativas;
- trazabilidad transversal.

### ops

Responsable de:

- dashboard;
- queues;
- approvals;
- review operativa;
- runbooks visibles.

### agents

Responsable de:

- catalogo;
- runs;
- claim/heartbeat/complete/fail;
- agentes de usuario y ops.

### autonomy

Responsable de:

- coordinacion de ejecucion agentic;
- plan mode;
- delegacion;
- ownership tecnico de runtime;
- separacion entre catalogo, runtime y estado de ejecucion.

### knowledge

Responsable de:

- memoria institucional;
- memoria operativa;
- repo knowledge;
- runtime knowledge;
- futuras abstracciones de `workspace_memory`.

### trust

Responsable posterior:

- trust score;
- fraud flags;
- evidence scoring;
- risk signals.

### governance

Responsable futuro:

- policies;
- proposals;
- votes;
- treasury intents;
- sub-DAO primitives.

## Mapeo del Estado Actual

El repo ya contiene:

- `jobs`
- `bids`
- `projects`
- `milestones`
- `payments`
- `disputes`
- `ops`
- `agents`
- `auth`

## Ajuste Recomendado

Para alinearlo con la vision fusionada:

- `projects` debe reducirse o evolucionar hacia una abstraccion secundaria;
- `reservations`, `contracts`, `evidence`, `ratings`, `notifications` y `trust` deben quedar explicitados como modulos;
- `bids` puede mantenerse como modulo opcional si el vertical usa propuesta economica, pero debe tratarse como discovery/legacy y no como mecanismo principal de adjudicacion;
- `governance` no entra al MVP, pero debe existir como espacio reservado en arquitectura.
- `autonomy` y `knowledge` deben leerse como destinos naturales de la capa de operación asistida.

## Estado de Transicion

La implementacion actual todavia expone parte importante del flujo operativo por
medio de `projects`, especialmente en:

- milestones;
- escrow;
- payments;
- evidence;
- disputes derivadas del trabajo en ejecucion.

Esto no redefine el dominio canonico.
Se considera una etapa transitoria del backend actual.

Regla:

- el producto se piensa alrededor de `Job`
- `Project` representa ejecucion derivada o abstraccion secundaria
- cualquier modulo nuevo debe justificarse primero desde el flujo canonico de `Job`
- no deben nacer contratos nuevos que profundicen la centralidad de `Project` sin una razon tecnica transitoria
- durante Sprint 1, toda ruta nueva del happy path debe salir por `jobId` o por entidades canonicas derivadas (`reservationId`, `contractId`, `milestoneId`, `disputeId`)
