# SEMSE Sprint 1 Plan

## Nombre del sprint

**Sprint 1 — Happy Path Job-First**

## Tesis del sprint

SEMSE ya tiene suficiente base tecnica y suficiente vision.
Lo que falta no es mas expansion conceptual.
Lo que falta es cerrar el flujo canonico del MVP alrededor de `Job` como agregado principal.

Este sprint existe para reducir la distancia entre:
- dominio canonico declarado;
- backend en transicion;
- frontend util para cliente/pro;
- flujo comercial realmente ejecutable.

## Objetivo principal

Cerrar un flujo verificable y coherente de punta a punta:

1. cliente crea job;
2. profesional reserva;
3. reserva se acepta;
4. contrato se genera;
5. contrato se firma;
6. cliente fondea escrow;
7. profesional sube evidencia por milestone;
8. cliente aprueba o rechaza;
9. pago se libera;
10. si falla, se abre disputa.

## Resultado esperado al final del sprint

No buscamos lanzar todo SEMSE.
Buscamos terminar una cadena canonica demostrable.

Si el sprint sale bien, debe existir:
- un flujo backend consistente por `jobId`;
- naming de dominio suficientemente estable;
- surfaces frontend minimas para operar el flujo;
- evidencia de que `Project` ya no manda el producto;
- auditabilidad minima en cada paso importante.

---

## Alcance del sprint

### Entra
- dominio canonico visible;
- reservations;
- contracts;
- escrow funding + release;
- evidence upload + review;
- dispute basica;
- shell minima de frontend para publicar / escrow / evidencia.

### No entra
- governance;
- wallets;
- DAO;
- trust score completo;
- antifraude avanzado;
- units completas;
- knowledge completo;
- agenda completa;
- expansion multi-categoria.

---

## Workstreams

## WS1. Dominio y transicion

### Ticket 1.1 — Congelar naming visible del MVP
**Problema**
El runtime y Prisma aun mezclan estados/nombres heredados con el dominio canonico.

**Objetivo**
Definir y exponer un lenguaje visible unico para producto/API.

**Hacer**
- fijar estados visibles de `Job`:
  - `DRAFT`
  - `POSTED`
  - `RESERVED`
  - `ACCEPTED`
  - `IN_PROGRESS`
  - `REVIEW`
  - `DISPUTE`
  - `COMPLETED`
  - `CANCELLED`
- documentar equivalencias transicionales de:
  - `PUBLISHED`
  - `AWARDED`
- fijar semantica visible de transacciones:
  - `FUND`
  - `RELEASE`
  - `REFUND`
  - `HOLDBACK`
  - `FEE`
- evitar que surfaces nuevas muestren lenguaje legacy.

**Dependencias**
- ninguna

**Done cuando**
- docs y contracts visibles usan naming canonico;
- lenguaje legacy queda encapsulado o marcado como compatibilidad.

**Prioridad**
- critica

---

### Ticket 1.2 — Regla operativa Job-first
**Problema**
`Project` sigue absorbiendo demasiado significado de negocio.

**Objetivo**
Asegurar que toda nueva surface o endpoint del sprint piense primero en `Job`.

**Hacer**
- revisar endpoints nuevos del sprint y validarlos contra regla Job-first;
- no introducir nuevas rutas principales centradas en `projectId`;
- mantener puentes legacy solo donde sean inevitables.

**Done cuando**
- nuevas capacidades del sprint salen por `jobId` o entidades canonicas derivadas de `Job`.

**Prioridad**
- critica

---

## WS2. Backend canonico del happy path

### Ticket 2.1 — Reservations hardening
**Objetivo**
Cerrar reservations como paso real y confiable del flujo.

**Hacer**
- validar una sola reserva activa por job;
- endurecer accept / release / expire;
- asegurar ownership y permisos;
- auditar eventos clave.

**Dependencias**
- 1.1
- 1.2

**Done cuando**
- reservar, aceptar, liberar y expirar funcionan de forma consistente;
- la concurrencia no permite dos reservas activas validas.

**Prioridad**
- critica

---

### Ticket 2.2 — Contracts closing
**Objetivo**
Convertir contracts en paso operativo real despues de reservation.

**Hacer**
- crear contrato desde reserva aceptada;
- asegurar `termsJson`;
- registrar firmas;
- persistir `documentHash` y `pdfUrl` cuando aplique;
- consulta del contrato vigente por `jobId`.

**Dependencias**
- 2.1

**Done cuando**
- existe un contrato vigente por job;
- ambas partes pueden firmar;
- el estado contractual queda trazable.

**Prioridad**
- critica

---

### Ticket 2.3 — Escrow funding por job
**Objetivo**
Cerrar el primer paso financiero canonico por `jobId`.

**Hacer**
- asegurar `POST /v1/jobs/:jobId/escrow/fund`;
- alinear naming de funding;
- validar consistencia con contrato/job;
- exponer lectura principal por `jobId`.

**Dependencias**
- 2.2

**Done cuando**
- el cliente puede fondear escrow asociado al job correcto;
- el estado financiero puede consultarse por `jobId`.

**Prioridad**
- critica

---

### Ticket 2.4 — Evidence by job/milestone
**Objetivo**
Cerrar evidencia como parte del flujo real de ejecucion y review.

**Hacer**
- reforzar registro de evidencia por `jobId` + `milestoneId`;
- mantener `projectId` solo como puente transicional;
- asegurar consulta por job;
- validar kind / key / ownership;
- preparar base estable para review.

**Dependencias**
- 1.2

**Done cuando**
- la evidencia del sprint se consulta principalmente por `jobId`;
- `projectId` no manda la experiencia nueva.

**Prioridad**
- critica

---

### Ticket 2.5 — Milestone review loop
**Objetivo**
Cerrar approve / reject / request changes.

**Hacer**
- validar `MilestoneReview`;
- conectar review con evidencia;
- soportar:
  - approve
  - reject
  - request changes
  - opcionalmente escalate dispute

**Dependencias**
- 2.4

**Done cuando**
- un milestone puede pasar por review clara y trazable.

**Prioridad**
- critica

---

### Ticket 2.6 — Release por milestone
**Objetivo**
Cerrar liberacion de pago como paso posterior a aprobacion.

**Hacer**
- validar release desde milestone;
- alinear ledger/transacciones;
- evitar semantica confusa entre escrow y payment;
- asegurar trazabilidad financiera.

**Dependencias**
- 2.3
- 2.5

**Done cuando**
- se puede liberar pago por milestone aprobado sin ambiguedad de estado.

**Prioridad**
- critica

---

### Ticket 2.7 — Dispute baseline
**Objetivo**
Cerrar el camino de excepcion minimo del MVP.

**Hacer**
- abrir disputa desde job/milestone;
- congelar o marcar impacto financiero si corresponde;
- asignacion/revision minima por ops;
- resolucion basica.

**Dependencias**
- 2.5
- 2.6

**Done cuando**
- existe camino de disputa util y trazable para el happy path fallido.

**Prioridad**
- alta

---

## WS3. Frontend shell minimo del flujo

### Ticket 3.1 — Create Job UI
**Fuente**
- `semseproject/app`

**Objetivo**
Injertar el wizard de publicar trabajo en el frontend canonico.

**Hacer**
- integrar flujo visual de publish;
- conectar a API canonica de jobs;
- adaptar categorias, presupuesto, urgencia, adjuntos;
- limpiar dependencias heredadas de Supabase.

**Dependencias**
- 1.1
- endpoint de jobs operativo

**Done cuando**
- un cliente puede crear job desde el frontend canonico.

**Prioridad**
- critica

---

### Ticket 3.2 — Escrow UI minimo
**Fuente**
- `semseproject/app`

**Objetivo**
Volver entendible el funding y estado del escrow para el cliente.

**Hacer**
- vista de escrow por job;
- timeline o panel de hitos;
- funding state;
- releases y disputas visibles.

**Dependencias**
- 2.3
- 2.6
- 2.7

**Done cuando**
- el usuario puede entender el estado del dinero sin ir a surfaces tecnicas.

**Prioridad**
- critica

---

### Ticket 3.3 — Evidence UI minima
**Fuente**
- `semseproject/app`

**Objetivo**
Permitir carga y revision visual de evidencias.

**Hacer**
- upload modal;
- panel de evidencias por estado;
- vista detalle;
- accion de approve/reject/request changes si aplica por rol.

**Dependencias**
- 2.4
- 2.5

**Done cuando**
- la evidencia del flujo puede cargarse y revisarse desde UI coherente.

**Prioridad**
- critica

---

### Ticket 3.4 — Dashboard shell minima
**Fuente**
- `semseproject/app`

**Objetivo**
Dar una entrada usable al MVP para cliente/pro.

**Hacer**
- resumen de jobs;
- accesos a escrow y evidencias;
- indicadores basicos;
- shell sin depender aun de toda la experiencia final.

**Dependencias**
- 3.1
- 3.2
- 3.3

**Done cuando**
- existe una home operable del flujo comercial.

**Prioridad**
- alta

---

## WS4. Auditabilidad minima

### Ticket 4.1 — Audit trail por hitos del flujo
**Objetivo**
Asegurar trazabilidad minima en cada paso importante.

**Hacer**
- auditar:
  - reservation create/accept/release/expire
  - contract create/sign
  - escrow fund
  - evidence register
  - review decision
  - release
  - dispute open/resolve

**Dependencias**
- WS2

**Done cuando**
- el flujo deja rastro suficiente para ops y debugging.

**Prioridad**
- critica

---

## Orden de implementacion recomendado

### Ola A — Cierre de base
1. Ticket 1.1
2. Ticket 1.2
3. Ticket 2.1
4. Ticket 2.2

### Ola B — Dinero y evidencia
5. Ticket 2.3
6. Ticket 2.4
7. Ticket 2.5
8. Ticket 2.6
9. Ticket 2.7

### Ola C — Shell de producto
10. Ticket 3.1
11. Ticket 3.2
12. Ticket 3.3
13. Ticket 3.4

### Ola D — Cierre operacional
14. Ticket 4.1

---

## Definition of Done del sprint

El sprint se considera completado si se puede demostrar este escenario:

1. cliente crea un job desde UI canonica;
2. profesional reserva el job;
3. la reserva se acepta correctamente;
4. se genera un contrato para ese job;
5. ambas partes pueden firmarlo;
6. el cliente fondea escrow por job;
7. el profesional sube evidencia asociada al milestone;
8. el cliente aprueba o rechaza;
9. el sistema permite liberar pago por milestone aprobado;
10. si hay conflicto, se puede abrir disputa;
11. cada paso deja rastro auditable;
12. las surfaces nuevas hablan lenguaje canonico, no legacy.

---

## Riesgos del sprint

### Riesgo 1
`Project` siga filtrandose como centro accidental del flujo.

**Mitigacion**
- revisar cada ticket con regla Job-first.

### Riesgo 2
Intentar arreglar todo el dominio financiero en una sola pasada.

**Mitigacion**
- cerrar funding + release con semantica minima correcta;
- dejar reconciliacion avanzada y provider complexity para fases siguientes.

### Riesgo 3
Injertar frontend del satelite sin traducirlo al dominio canonico.

**Mitigacion**
- rescatar UX, no copiar contratos ni naming heredado.

### Riesgo 4
Abrir demasiadas features laterales.

**Mitigacion**
- toda decision debe pasar la prueba del happy path minimo.

---

## KPI interno del sprint

No son KPIs de mercado. Son KPIs de integracion.

- `% del happy path cubierto por rutas canonicas de job`
- `% de pasos del flujo con audit trail`
- `% de surfaces nuevas usando naming canonico`
- numero de dependencias nuevas a `projectId` introducidas en sprint = **0**
- numero de demos end-to-end exitosas del flujo objetivo

---

## Veredicto final del sprint

Este sprint no busca embellecer SEMSE.
Busca darle columna vertebral real.

Si este sprint sale bien, SEMSE deja de ser principalmente:
- vision + arquitectura + piezas satelite

y pasa a ser:
- un flujo comercial canonico parcialmente ejecutable y demostrable.
