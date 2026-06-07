# API Boundaries

## Objetivo

Definir las fronteras oficiales entre:

- dominio;
- API;
- frontend;
- workers;
- agentes;
- y sistemas transicionales.

Este documento existe para evitar que SEMSEproject vuelva a tener multiples
fuentes de verdad o integraciones directas que fragmenten el sistema.

## Regla madre

Para dominios core:

- `apps/api` es la puerta oficial;
- `packages/schemas` define contratos compartidos;
- Prisma implementa persistencia canonica;
- `apps/web` no consulta fuentes core por acceso directo;
- workers y agentes operan sobre eventos, contratos y servicios oficiales.

## Capas oficiales

### 1. `apps/web`

Responsable de:

- renderizar vistas;
- capturar intenciones del usuario;
- consumir contratos oficiales;
- mostrar estados y resultados;
- orquestar UX.

No debe:

- inventar modelos de dominio;
- consultar directamente Supabase para flujos core;
- reimplementar reglas de negocio;
- mutar tablas core por acceso directo.

### 2. `apps/api`

Responsable de:

- auth de dominio;
- orquestacion de casos de uso;
- validacion de reglas;
- transiciones de estado;
- control de permisos;
- integracion con DB;
- emision de eventos de dominio.

Debe ser la unica puerta para:

- jobs;
- reservations;
- contracts;
- milestones;
- evidence;
- escrow y payments;
- disputes;
- trust;
- notifications core;
- audit trail sensible.

### 3. `packages/schemas`

Responsable de:

- DTOs de entrada;
- DTOs de salida;
- enums de estado;
- validaciones Zod;
- contratos compartidos UI/API/worker;
- view models canonicos cuando aplique.

No debe:

- contener acceso a DB;
- contener UI;
- contener side effects.

### 4. `packages/db`

Responsable de:

- esquema Prisma;
- migraciones;
- modelos persistentes;
- constraints;
- indices;
- seeds autorizados;
- adaptadores de acceso a datos.

Regla:

- Prisma implementa el dominio definido en `DOMAIN_MODEL.md`;
- no redefine reglas de negocio por cuenta propia.

### 5. `packages/ui`

Responsable de:

- componentes reutilizables;
- primitives;
- layout;
- representacion consistente del dominio.

No debe:

- pegarle a APIs;
- conocer detalles de persistencia;
- definir reglas de negocio.

### 6. `apps/worker`

Responsable de:

- trabajos asincronos;
- notificaciones;
- expiraciones;
- reconciliaciones;
- automatizaciones;
- procesos operativos de fondo.

Debe consumir:

- eventos;
- contratos;
- servicios de dominio;
- colas oficiales.

### 7. `packages/agents`

Responsable de:

- definicion de agentes;
- prompts;
- herramientas;
- salidas estructuradas;
- patrones de orquestacion.

No debe:

- alterar estado core por acceso directo a DB;
- saltarse la API o los servicios oficiales;
- operar como fuente silenciosa de verdad.

## Supabase en transicion

Supabase queda clasificado como transicional.

Uso permitido durante transicion:

- auth heredada si todavia no fue reemplazada;
- storage auxiliar;
- funciones heredadas que aun no hayan migrado;
- prototipos no core claramente marcados.

Uso no permitido:

- nuevos modulos core con `supabase.from(...)` desde frontend;
- nuevas mutaciones core fuera de `apps/api`;
- nuevas tablas canonicas que no existan tambien en Prisma.

## Matriz de responsabilidad por dominio

### Auth

- contrato: `packages/schemas`
- logica: `apps/api`
- persistencia: `packages/db`
- UI: `apps/web`
- estado transicional permitido: auth heredada mientras migra

### Jobs

- contrato: `packages/schemas`
- logica: `apps/api`
- persistencia: `packages/db`
- UI: `apps/web`

### Reservations / Contracts

- contrato: `packages/schemas`
- logica: `apps/api`
- persistencia: `packages/db`
- UI: `apps/web`

### Milestones / Evidence

- contrato: `packages/schemas`
- logica: `apps/api`
- persistencia: `packages/db`
- workers: `apps/worker` si hay automatizaciones
- UI: `apps/web`

### Escrow / Payments

- contrato: `packages/schemas`
- logica: `apps/api`
- persistencia: `packages/db`
- workers: `apps/worker`
- UI: `apps/web`

### Disputes / Trust

- contrato: `packages/schemas`
- logica: `apps/api`
- persistencia: `packages/db`
- workers/agentes: soporte, nunca fuente primaria
- UI: `apps/web`

### Agents

- contrato: `packages/schemas`
- definicion: `packages/agents`
- orquestacion: `apps/api` y/o workers
- UI: `apps/web`

### Knowledge / Docs

- contrato: `packages/schemas` cuando aplique
- ingest/retrieval: paquete o servicio especifico
- UI: `apps/web`
- referencia actual: extraer desde laboratorios, no adoptarlos en bloque

## Anti-patrones prohibidos

- frontend consultando DB core en directo;
- UI inventando enums o estados que no existen en schemas;
- workers escribiendo cambios sensibles sin pasar por servicios oficiales;
- agentes disparando cambios persistentes sin audit trail;
- features nuevas construidas en carpetas no canonicas.

## Definition of Done

Una frontera de API esta correctamente implementada cuando:

1. el contrato vive en `packages/schemas`;
2. la logica vive en `apps/api`;
3. la persistencia vive en Prisma;
4. `apps/web` solo consume la API oficial;
5. eventos y auditoria existen para cambios sensibles;
6. no queda acceso directo legacy para el mismo flujo core.
