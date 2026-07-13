# Arquitectura Objetivo

> **SUPERSEDIDO PARCIALMENTE (2026-07-12):** contiene decisiones historicas y
> rutas locales que ya no son canónicas. La arquitectura vigente vive en
> [`../architecture/CURRENT_ARCHITECTURE.md`](../architecture/CURRENT_ARCHITECTURE.md).
> Consultar este archivo solo para trazabilidad.

## 1. Base Canonica

La base tecnica del sistema sera el monorepo ya existente en [project-manager-app](/home/yoni/labsemse/project-manager-app).

La fuente primaria de vision vive fuera del repo en:

- [vision](/home/yoni/labsemse/vision)
- documento canonico: [VISION_FUSIONADA_SEMSE_PROMETEO.md](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)

Se toma como canon porque ya contiene:

- `apps/web`
- `apps/api`
- `apps/worker`
- `packages/db`
- `packages/schemas`
- `packages/auth`
- `packages/agents`

## 2. Estructura Objetivo

```text
labsemse/
  vision/
  program/
  project-manager-app/
    apps/
      web/
      api/
      worker/
    packages/
      ui/
      shared/
      schemas/
      db/
      auth/
      agents/
      trust/
      governance/
    docs/
      foundation/
      vision/       # copia operativa subordinada a /home/yoni/labsemse/vision
```

## 3. Capas Funcionales

Adicionalmente, el ecosistema reconoce una capa transversal de operacion asistida que no pertenece al core funcional del producto, pero sí habilita la operación agentic del sistema y del operador.

```text
Operacion asistida
  operator_identity
  workspace_memory
  agent_runtime
  ephemeral_runtime_state
  backup_recovery
```

Esta capa no redefine el producto. Lo habilita, lo acelera y lo hace trazable.

### apps/web

Responsabilidad:

- experiencia cliente;
- experiencia profesional;
- experiencia ops;
- dashboards;
- formularios y workflows;
- chat;
- notificaciones visibles;
- vistas de governance futuras.

### apps/api

Responsabilidad:

- dominio central;
- autorizacion;
- validacion;
- reglas de negocio;
- contratos API;
- persistencia;
- ledger;
- auditoria;
- integracion con proveedores.

### apps/worker

Responsabilidad:

- reservas con expiracion;
- colas;
- notifications async;
- jobs de scoring;
- agentes;
- automatizaciones operativas;
- reconciliaciones;
- watchdogs.

## 4. Paquetes de Dominio

### packages/db

- Prisma schema;
- migrations;
- seeds;
- acceso DB compartido.

### packages/schemas

- Zod schemas;
- DTO contracts;
- eventos;
- validaciones compartidas.

### packages/shared

- utilidades;
- tipos comunes;
- cliente SDK;
- helpers de dominio.

### packages/auth

- autenticacion;
- sesiones;
- permisos;
- RBAC;
- actor context temporal mientras no exista auth final.

### packages/agents

- agentes de usuario;
- agentes de ops;
- agentes de governance futura;
- prompts;
- herramientas;
- trazas.

### packages/trust

- trust score;
- fraud heuristics;
- reputation signals;
- evidence scoring;
- dispute scoring.

### packages/governance

Fase posterior:

- policy engine;
- proposals;
- voting;
- treasury actions;
- sub-DAO primitives.

## 5. Modulos Backend Iniciales

Los modulos del API deben reorganizarse alrededor de estos dominios:

- `auth`
- `users`
- `organizations`
- `jobs`
- `reservations`
- `contracts`
- `milestones`
- `evidence`
- `escrow`
- `payments`
- `disputes`
- `ratings`
- `notifications`
- `audit`
- `agents`
- `ops`
- `trust`

## 6. Modelo de Dominio Inicial

Entidades del MVP:

- `User`
- `Organization`
- `Membership`
- `ProfessionalProfile`
- `ClientProfile`
- `Job`
- `JobReservation`
- `Contract`
- `Milestone`
- `MilestoneEvidence`
- `MilestoneReview`
- `EscrowAccount`
- `EscrowTransaction`
- `Payment`
- `Dispute`
- `Rating`
- `Notification`
- `TimelineEvent`
- `AuditLog`

Entidades posteriores:

- `PayoutAccount`
- `TrustSignal`
- `Policy`
- `Proposal`
- `Vote`
- `Wallet`
- `StakePosition`

## 7. Reglas de Dominio

Separar siempre:

- estado del trabajo;
- estado del milestone;
- estado del escrow;
- estado del pago;
- estado de disputa.

No deben acoplarse en un solo campo.

Ownership del MVP:

- la visibilidad de recursos sensibles debe poder resolverse por `Organization`
- no basta compartir `tenantId`
- `User` actua dentro de un contexto organizacional

## 8. Integracion del Frontend Existente

De [semseproject/app](/home/yoni/Descargas/semseproject/app) deben migrarse principalmente:

- dashboard;
- publicar trabajo;
- escrow;
- evidencias;
- profesionales;
- login/register;
- chat;
- agentes de usuario.

Estos flujos deben rehacerse contra `apps/api`, no mantener consultas directas dispersas a Supabase como nucleo definitivo.

## 9. Arquitectura de Datos

Fuente canonica:

- PostgreSQL via Prisma.

Soportes:

- Redis para locks, colas, timers y jobs async;
- S3 compatible para evidencias, contratos y adjuntos;
- proveedor de pagos para escrow/payouts;
- observabilidad para logs, traces y health.

## 9.1 Arquitectura documental y de trazabilidad de la operación asistida

La documentación de esta capa se distribuye así:

- canon operativo absorbido:
  - `agents/`
  - `agents/references/infclaude/`
- trazabilidad fechada:
  - `reportes/`
- reglas de precedencia:
  - `repository-rules/`
- formalización constitucional:
  - `constitution/`

Regla:

- si el contenido define patrón funcional absorbido por el subsistema agentic, vive en `agents/references/`;
- si el contenido registra una ejecución, destilación o intervención fechada, vive en `reportes/`;
- si el contenido redefine la arquitectura oficial, debe quedar absorbido por `constitution/` o `program/`.

## 10. Arquitectura de Evolucion

El sistema se expande asi:

1. `SEMSE Jobs`
2. `SEMSE Ops`
3. `SEMSE Trust`
4. `Prometeo`

Esto debe reflejarse tanto en carpetas como en decisiones de modelado.

En paralelo, la operación asistida del ecosistema debe endurecerse como una capacidad transversal:

1. identidad operativa
2. memoria de workspace
3. runtime agentic
4. observabilidad y estado efímero
5. resiliencia y respaldo

## 11. Regla de Seguridad Temporal

Mientras no exista auth real:

- headers y actor context son bootstrap tecnico
- ownership, permisos y policy por recurso siguen siendo obligatorios
- no se debe tratar bootstrap tecnico como seguridad final
