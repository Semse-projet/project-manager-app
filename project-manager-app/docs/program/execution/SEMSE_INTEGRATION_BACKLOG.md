# SEMSE Integration Backlog

## Objetivo

Traducir la vision, el plan de consolidacion y la matriz de extraccion en una secuencia ejecutable.

Este backlog responde 5 preguntas:
- que construir primero;
- que rescatar y desde donde;
- que depende de que;
- que entra al MVP real;
- que se deja para fases posteriores.

## Fuentes rectoras

- vision oficial: `/home/yoni/labsemse/vision`
- programa oficial: `/home/yoni/labsemse/program`
- core tecnico canonico: `/home/yoni/labsemse/project-manager-app`
- matriz de extraccion: `/home/yoni/.openclaw/workspace/SEMSE_EXTRACTION_MATRIX.md`
- plan de consolidacion: `/home/yoni/.openclaw/workspace/SEMSE_CONSOLIDATION_PLAN.md`

---

## Fase 0. Alineacion estructural

### 0.1 Declarar oficialmente el core canonico
**Objetivo**
Eliminar ambiguedad sobre donde vive SEMSE.

**Fuente**
- hallazgos de consolidacion

**Entregable**
- decision documentada: `labsemse/project-manager-app` = core oficial

**Dependencias**
- ninguna

**Prioridad**
- critica

---

### 0.2 Clasificar satelites
**Objetivo**
Fijar el rol de cada pieza satelite.

**Fuente**
- `semseproject/app`
- `semse-control-mvp`
- `project-manager-app-local-wrapper`

**Entregable**
- tabla oficial: canonico / satelite UI / satelite Ops / wrapper / archivo

**Dependencias**
- 0.1

**Prioridad**
- critica

---

### 0.3 Resolver naming institucional
**Objetivo**
Cerrar la tension entre nombre heredado `project-manager-app` y nombre real SEMSE.

**Entregable**
- decision de naming para repo, docs y producto
- politica de transicion si no se renombra aun el repo

**Dependencias**
- 0.1

**Prioridad**
- alta

---

## Fase 1. Cierre del dominio canonico

### 1.1 Congelar el modelo MVP oficial
**Objetivo**
Cerrar el lenguaje y agregados principales del MVP.

**Entregable**
- modelo oficial basado en:
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
  - `TimelineEvent`
  - `AuditLog`

**Dependencias**
- Fase 0

**Prioridad**
- critica

---

### 1.2 Cerrar estados y transiciones
**Objetivo**
Evitar ambiguedad entre estados heredados y flujo canonico.

**Entregable**
- tabla de estados oficiales de:
  - Job
  - Reservation
  - Milestone
  - Escrow
  - Payment
  - Dispute
- reglas de transicion
- eventos auditables por transicion

**Dependencias**
- 1.1

**Prioridad**
- critica

---

### 1.3 Cerrar ownership y permisos
**Objetivo**
Asegurar que el acceso sensible dependa de ownership real.

**Entregable**
- mapa RBAC + ownership por organizacion
- reglas para CLIENT / PRO / OPS_ADMIN
- anti-regla: nada sensible solo por tenantId

**Dependencias**
- 1.1

**Prioridad**
- critica

---

## Fase 2. Ajuste del core backend

### 2.1 Reservations module completo
**Objetivo**
Formalizar la reserva como modulo oficial del happy path.

**Fuente**
- core canonico
- backlog foundation existente

**Entregable**
- `ReservationsModule`
- una sola reserva activa por job
- expiracion
- release
- accept
- auditoria

**Dependencias**
- 1.1
- 1.2
- 1.3

**Prioridad**
- critica

---

### 2.2 Contracts module completo
**Objetivo**
Formalizar el contrato como paso canónico entre reserva y ejecucion.

**Entregable**
- generar contrato desde reserva aceptada
- firma por partes
- `termsJson`
- `documentHash`
- consulta por `jobId`

**Dependencias**
- 2.1

**Prioridad**
- critica

---

### 2.3 Evidence reframing
**Objetivo**
Mover evidencia a su lugar correcto en el dominio.

**Entregable**
- `Job` y `Milestone` como referencias canonicas
- puente temporal desde `Project` si hace falta
- rutas y DTOs alineados con `MilestoneEvidence`
- base para `MilestoneReview`

**Dependencias**
- 1.1
- 1.2

**Prioridad**
- critica

---

### 2.4 Escrow / payments separation real
**Objetivo**
Separar dinero inmovilizado, movimientos y pagos de forma limpia.

**Entregable**
- vista principal de escrow por `jobId`
- ledger/transacciones separadas
- pagos y reconciliacion desacoplados del surface de producto
- nombres y semantica alineados al dominio canonico

**Dependencias**
- 1.1
- 1.2
- 2.2

**Prioridad**
- critica

---

### 2.5 Dispute y rating base
**Objetivo**
Cerrar el final del happy path con excepcion y reputacion.

**Entregable**
- abrir disputa
- review operativa basica
- resolucion minima
- rating mutuo al cierre

**Dependencias**
- 2.3
- 2.4

**Prioridad**
- alta

---

## Fase 3. Product shell del MVP

### 3.1 Publicar trabajo UX
**Fuente**
- `semseproject/app`

**Objetivo**
Llevar el wizard de publicacion al frontend canonico.

**Entregable**
- flujo de crear job:
  - categoria
  - detalles
  - presupuesto
  - urgencia
  - adjuntos
  - review final
- conectado al API canonico

**Dependencias**
- 1.1
- API basica de jobs

**Prioridad**
- critica

---

### 3.2 Dashboard cliente inicial
**Fuente**
- `semseproject/app`

**Objetivo**
Dar una shell real al producto para cliente.

**Entregable**
- overview
- jobs
- escrow
- bookings si aplica
- notificaciones basicas

**Dependencias**
- 3.1
- APIs principales

**Prioridad**
- alta

---

### 3.3 Escrow UX del cliente
**Fuente**
- `semseproject/app`

**Objetivo**
Hacer visible y entendible el flujo de fondos.

**Entregable**
- lista de escrows activos/completados/disputados
- timeline de hitos
- accion de release/dispute si corresponde

**Dependencias**
- 2.4
- 2.5

**Prioridad**
- critica

---

### 3.4 Evidence UX del cliente/pro
**Fuente**
- `semseproject/app`

**Objetivo**
Hacer util la carga y revision de evidencias.

**Entregable**
- upload modal
- checklist de calidad
- panel por estado
- vista detalle
- aprobacion / rechazo / solicitud de cambios

**Dependencias**
- 2.3

**Prioridad**
- critica

---

### 3.5 Supply side shell
**Fuente**
- `semseproject/app`

**Objetivo**
Preparar la experiencia del profesional.

**Entregable**
- panel profesional inicial
- cola de jobs
- reserva y aceptacion
- estatus de reputacion/perfil

**Dependencias**
- 2.1
- 3.1

**Prioridad**
- alta

---

## Fase 4. Ops alignment

### 4.1 Worklog operativo
**Fuente**
- `semse-control-mvp`

**Objetivo**
Capturar avance real y contexto de ejecucion.

**Entregable**
- reportes diarios o por hito
- done / next / blockers
- enlace con job, milestone y actor
- timeline operacional

**Dependencias**
- 2.3
- 3.4

**Prioridad**
- alta

---

### 4.2 Knowledge con procedencia
**Fuente**
- `semse-control-mvp`

**Objetivo**
Conservar hechos relevantes derivados de la operacion.

**Entregable**
- modelo de knowledge/facts
- procedencia a worklog/evidence
- lectura util para ops/trust

**Dependencias**
- 4.1

**Prioridad**
- media-alta

---

### 4.3 Units como ejecucion derivada
**Fuente**
- `semse-control-mvp`

**Objetivo**
Representar verticales donde un job se ejecuta sobre unidades fisicas.

**Entregable**
- submodelo opcional `Unit`
- relacion con `Job` o `Milestone`
- tracking de estado y ultimo reporte

**Dependencias**
- 1.1
- 4.1

**Prioridad**
- media-alta

---

### 4.4 Ops console minima
**Objetivo**
Dar visibilidad a operaciones sobre reservas, disputes y excepciones.

**Entregable**
- panel ops basico
- cola de alertas
- jobs con riesgo o bloqueo
- disputas abiertas
- SLAs minimos

**Dependencias**
- 2.x
- 4.1

**Prioridad**
- alta

---

## Fase 5. Trust layer inicial

### 5.1 Trust signals model
**Objetivo**
Crear senales reales de confianza basadas en comportamiento.

**Entregable**
- completion rate
- first-pass approval rate
- dispute rate
- evidence completeness
- response time

**Dependencias**
- 2.5
- 4.1
- 4.2

**Prioridad**
- alta

---

### 5.2 Risk and anomaly basics
**Objetivo**
Tener una primera capa antifraude y de alertas.

**Entregable**
- alertas por comportamiento atipico
- jobs en riesgo
- reglas iniciales de mitigacion

**Dependencias**
- 5.1

**Prioridad**
- media-alta

---

## Fase 6. Scheduling y supply expansion

### 6.1 Agenda / bookings
**Fuente**
- `semseproject/app`
- `semse-control-mvp`

**Objetivo**
Convertir la agenda en soporte real para reservas y ejecucion.

**Entregable**
- slots / visitas / bookings
- agenda conectada con reserva y ops

**Dependencias**
- 3.5
- 4.4

**Prioridad**
- media

---

### 6.2 Professionals marketplace shell
**Fuente**
- `semseproject/app`

**Objetivo**
Expandir la capa supply del marketplace.

**Entregable**
- exploracion de profesionales
- perfil basico
- estado de verificacion
- compatibilidad con trust

**Dependencias**
- 5.1

**Prioridad**
- media

---

## Fase 7. Agent surfaces utiles

### 7.1 Assistant UX
**Fuente**
- `semseproject/app`
- `semse-control-mvp`

**Objetivo**
Agregar ayuda inteligente donde acelera trabajo real.

**Entregable**
- bubble/chat opcional
- sugerencias para redactar alcance
- resumen de evidencia
- alertas operativas

**Dependencias**
- 3.x
- 4.x
- 5.x

**Prioridad**
- media

---

## Lo que NO entra primero

No priorizar antes del MVP funcional:
- governance completa;
- wallets como dependencia del flujo base;
- DAO/sub-DAOs;
- smart contracts como centro del producto;
- demasiadas categorias simultaneas;
- automatizacion total sin supervision.

---

## Cadena minima del MVP real

La definicion minima de exito debe ser:

1. cliente publica job;
2. profesional reserva;
3. profesional acepta;
4. contrato se genera y firma;
5. cliente fondea escrow;
6. profesional ejecuta milestone;
7. sube evidencia;
8. cliente aprueba o rechaza;
9. pago se libera;
10. si algo falla, se abre disputa;
11. cierre con rating;
12. todo deja audit trail.

---

## Top 10 de ejecucion inmediata

1. fijar core canonico oficialmente
2. cerrar modelo de dominio MVP
3. cerrar estados y transiciones
4. cerrar ownership/RBAC
5. terminar reservations
6. terminar contracts
7. separar escrow/payments correctamente
8. alinear evidence al dominio canonico
9. integrar UX de publicar trabajo
10. integrar UX de escrow + evidencias

---

## Veredicto operativo

Si SEMSE quiere dejar de ser piezas regadas y pasar a sistema real, la ruta correcta es:

- primero dominio;
- luego backend feliz del flujo canonico;
- luego product shell visible;
- luego ops alignment;
- luego trust;
- luego expansiones de scheduling, agents y Prometeo.
