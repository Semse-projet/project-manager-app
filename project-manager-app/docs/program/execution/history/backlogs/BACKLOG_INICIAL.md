# Backlog Inicial

## Epica 1. Dominio canonico

- definir entidad central `Job`;
- definir estados oficiales;
- definir transiciones validas;
- separar estados de job, milestone, escrow, payment y dispute;
- cerrar glosario comun.

## Epica 2. Base de datos

- revisar schema Prisma existente;
- mapear solapamientos con modelo de `semseproject`;
- crear esquema minimo unificado;
- preparar migraciones iniciales;
- definir seeds de demo.

## Epica 3. API del MVP

- `POST /auth/signup`
- `POST /auth/login`
- `POST /jobs`
- `GET /jobs`
- `POST /jobs/:id/reserve`
- `POST /jobs/:id/accept`
- `POST /contracts/:jobId/generate`
- `POST /contracts/:id/sign`
- `POST /escrow/:jobId/fund`
- `POST /milestones/:id/evidence`
- `POST /milestones/:id/submit`
- `POST /milestones/:id/approve`
- `POST /payments/milestones/:id/release`
- `POST /disputes/:id/open`
- `POST /disputes/:id/resolve`
- `POST /ratings`

## Epica 4. Frontend producto

- login/register;
- dashboard cliente;
- dashboard profesional;
- publicar trabajo;
- cola de trabajos;
- detalle de job;
- contrato;
- escrow;
- evidencias;
- review de hitos;
- ratings.

## Epica 5. Ops

- audit log;
- timeline event feed;
- reserva con expiracion;
- notification service;
- panel ops minimo;
- dispute review screen.

## Epica 6. Trust

- completion rate;
- first-pass approval rate;
- dispute rate;
- evidence completeness;
- response time;
- alerts por riesgo.

## Epica 7. Fundacion Prometeo

- glosario governance;
- domain stub para policy/proposal/vote;
- identidad y wallet roadmap;
- treasury conceptual;
- reglas de evolucion.

## Criterio de orden

Construir en este orden:

1. dominio
2. datos
3. API
4. frontend happy path
5. ops
6. trust
7. governance futura
