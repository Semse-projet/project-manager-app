# Masterplan

## 1. Objetivo

Convertir la vision fusionada en una secuencia de entregas que permita pasar de cero a:

- un MVP comercial usable;
- una plataforma operativa confiable;
- una capa de confianza medible;
- una base compatible con la evolucion Prometeo.

## 2. Principio Rector

La ejecucion sigue esta regla:

1. construir el flujo canonico;
2. estabilizar la operacion;
3. medir confianza y riesgo;
4. habilitar capas institucionales futuras.

## 3. Secuencia de Construccion

### Etapa A. Fundacion del sistema

Objetivo:

Definir arquitectura, dominio, reglas de estado y estructura de codigo.

Entregables:

- dominio unificado;
- modulos backend definidos;
- contratos API iniciales;
- esquema Prisma inicial;
- mapa de roles y permisos;
- backlog ejecutable del MVP.

### Etapa B. MVP comercial

Objetivo:

Lanzar `SEMSE Jobs + Escrow` para una red curada de clientes y profesionales.

Entregables:

- auth;
- perfiles;
- publicacion de trabajos;
- bolsa de trabajos;
- reserva con temporizador;
- aceptacion;
- contrato digital;
- milestones;
- evidencia;
- approval/reject;
- funding y release;
- disputes basicas;
- ratings.

### Etapa C. Operacion confiable

Objetivo:

Consolidar `SEMSE Ops`.

Entregables:

- workers;
- expiraciones automaticas;
- notificaciones;
- auditoria robusta;
- panel de operaciones;
- monitoreo;
- SLA internos;
- runbooks.

### Etapa D. Capa de confianza

Objetivo:

Consolidar `SEMSE Trust`.

Entregables:

- trust score;
- antifraude basico;
- evidence scoring;
- dispute analytics;
- reputation by behavior;
- señales de riesgo.

### Etapa E. Capa institucional

Objetivo:

Preparar la evolucion Prometeo sin contaminar el core comercial.

Entregables:

- governance domain;
- policy engine;
- identity primitives;
- wallets;
- treasury primitives;
- proposals y voting;
- sub-DAOs de bajo riesgo.

## 4. Regla de Alcance

Cada fase debe:

- resolver un flujo real;
- dejar trazabilidad;
- mejorar control;
- evitar deuda estructural;
- producir datos para la siguiente fase.

Cada fase no debe:

- duplicar auth;
- duplicar modelos;
- romper el dominio unificado;
- introducir complejidad institucional antes de tiempo.

## 5. Orden de Prioridad

### Prioridad 1

Flujo canonico completo:

- crear job;
- reservar;
- aceptar;
- firmar;
- fondear;
- ejecutar;
- evidenciar;
- revisar;
- liberar;
- cerrar.

### Prioridad 2

Operacion controlada:

- auditoria;
- disputes;
- notifications;
- expiraciones;
- logs;
- panel ops.

### Prioridad 3

Confianza:

- ratings;
- completion metrics;
- risk signals;
- fraud controls.

### Prioridad 4

Gobernanza:

- proposals;
- policies;
- treasury;
- identities;
- nodos.

## 6. Artefactos Vivos

Estos documentos deben mantenerse:

- `VISION_FUSIONADA_SEMSE_PROMETEO.md`
- `MASTERPLAN.md`
- `ARCHITECTURE_TARGET.md`
- `ROADMAP_12_MESES.md`
- `BACKLOG_INICIAL.md`
- `PHASE_01_MVP.md`

## 7. Definicion de Exito

El programa esta funcionando bien si:

- el equipo sabe que se construye ahora y que no;
- cada modulo tiene un lugar claro;
- el MVP puede operar un trabajo real de punta a punta;
- la plataforma genera datos verificables;
- la arquitectura no bloquea el crecimiento a `SEMSE Ops`, `SEMSE Trust` y `Prometeo`.
