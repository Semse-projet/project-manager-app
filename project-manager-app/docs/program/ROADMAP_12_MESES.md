# Roadmap 12 Meses

> **SUPERSEDIDO COMO PLAN DE EJECUCION (2026-07-12):** conserva contexto
> historico. Usar el [`ROADMAP.md`](../../ROADMAP.md) F0-F9 y la
> [`arquitectura vigente`](../architecture/CURRENT_ARCHITECTURE.md).

## Tramo 0: Preparacion

Duracion:

- 2 a 4 semanas

Meta:

- congelar dominio;
- preparar arquitectura;
- ordenar backlog;
- decidir vertical y zona inicial.

Resultados:

- esquema inicial;
- API surface del MVP;
- mapa de roles;
- definicion del flujo canonico;
- priorizacion realista.

## Tramo 1: MVP Comercial

Duracion:

- meses 1 a 3

Meta:

Lanzar la primera version de `SEMSE Jobs + Escrow`.

Capacidades:

- auth;
- perfiles cliente/pro;
- publicacion de jobs;
- cola;
- reserva;
- aceptacion;
- contrato;
- milestones;
- evidencia;
- approval/reject;
- funding;
- release;
- disputes simples;
- ratings.

Indicadores:

- primer job creado;
- primer job reservado;
- primer contrato firmado;
- primer milestone aprobado;
- primer release ejecutado.

## Tramo 2: Operacion Controlada

Duracion:

- meses 4 a 6

Meta:

Consolidar `SEMSE Ops`.

Capacidades:

- expiracion automatica de reservas;
- notifications;
- panel ops;
- audit feed;
- observabilidad;
- runbooks;
- reconciliaciones;
- colas y workers.

Indicadores:

- reservas expiran automaticamente;
- eventos quedan auditados;
- ops puede intervenir disputas y excepciones;
- sistema soporta cargas iniciales sin caos manual.

## Tramo 3: Confianza y Calidad

Duracion:

- meses 7 a 9

Meta:

Activar `SEMSE Trust`.

Capacidades:

- trust score inicial;
- evidence completeness score;
- dispute analytics;
- fraud flags;
- reputation by behavior;
- ranking interno.

Indicadores:

- actores confiables se pueden identificar;
- patrones de riesgo se detectan;
- ratings dejan de ser la unica senal.

## Tramo 4: Preparacion Prometeo

Duracion:

- meses 10 a 12

Meta:

Preparar primitivas de gobernanza sin romper el core.

Capacidades:

- policy domain;
- proposals internas;
- voting experimental;
- identity roadmap;
- treasury conceptual;
- governance docs.

Indicadores:

- el sistema ya tiene where-to-place claro para governance futura;
- no hay reescritura estructural pendiente para crecer a Prometeo.
