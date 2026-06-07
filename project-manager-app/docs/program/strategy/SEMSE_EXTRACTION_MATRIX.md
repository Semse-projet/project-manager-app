# SEMSE Extraction Matrix

## Objetivo

Identificar que valor concreto deben aportar los satelites al core canonico de SEMSE:

- core canonico: `/home/yoni/labsemse/project-manager-app`
- satelite UI/producto: `/home/yoni/Descargas/semseproject/app`
- satelite operativo: `/home/yoni/Descargas/semse-control-mvp`

## Regla de integracion

Nada entra al core solo por existir.
Todo modulo o pantalla debe evaluarse por:

- alineacion con el dominio canonico;
- utilidad para el MVP;
- claridad de ownership;
- compatibilidad con `Job` como agregado principal;
- auditabilidad;
- costo de migracion.

---

## 1. Core canonico: project-manager-app

### Rol
Base tecnica oficial de SEMSE.

### Estado
Ya contiene la direccion correcta:
- monorepo;
- apps web/api/worker;
- Prisma;
- schemas;
- auth;
- agents;
- docs foundation/vision;
- backlog de dominio.

### Decision
No extraer desde aqui hacia otros.
Todo lo demas debe migrar hacia este repo.

---

## 2. Satelite: semseproject/app

### Lectura general
Este satelite aporta principalmente capa de producto visible y experiencia de usuario.
No parece gobernar el dominio, pero si acelera frontend comercial.

### Evidencias vistas
Rutas/paginas relevantes:
- `src/pages/Dashboard.tsx`
- `src/pages/Publicar.tsx`
- `src/pages/Escrow.tsx`
- `src/pages/Evidencias.tsx`
- `src/pages/Agenda.tsx`
- `src/pages/Profesionales.tsx`
- `src/pages/PanelProfesional.tsx`
- `src/pages/Login.tsx`
- `src/pages/Register.tsx`

Hooks/librerias relevantes:
- `useJobs`
- `useEscrow`
- `useEscrows`
- `useProfessionals`
- `useDashboardStats`
- `useUserBookings`
- `useUserNotifications`
- `context/AuthContext`
- `context/AgentContext`

### Aportes de alto valor

#### 2.1 Publicar trabajo
Valor:
- alto

Aporta:
- wizard de publicacion;
- UX de categoria, detalles, presupuesto, urgencia y adjuntos;
- flujo mental claro de creacion de job.

Decision:
- **rescatar concepto y UX**;
- **adaptar al dominio canonico Job**;
- no copiar directo si depende de esquema Supabase heredado.

Destino recomendado:
- `apps/web` del core canonico.

#### 2.2 Dashboard cliente
Valor:
- alto

Aporta:
- shell de dashboard;
- tarjetas de estado;
- tabs de jobs/escrow/bookings;
- experiencia de control de usuario final.

Decision:
- **rescatar layout, IA UX y estructura de vistas**;
- reimplementar sobre APIs canonicas.

Destino recomendado:
- `apps/web/app` o equivalente dentro del frontend oficial.

#### 2.3 Escrow UX
Valor:
- alto

Aporta:
- timeline visual;
- separacion entre activos/completados/disputados;
- vista entendible para cliente.

Decision:
- **rescatar UX y componentes visuales**;
- conectar a modelo canonico `EscrowAccount`, `EscrowTransaction`, `Milestone`.

Destino recomendado:
- frontend oficial de escrow/release/disputes.

#### 2.4 Evidencias UX
Valor:
- alto

Aporta:
- panel de evidencias;
- upload modal;
- checklist de calidad;
- estados pending/approved/rejected;
- idea de reporte/validacion.

Decision:
- **rescatar fuertemente**;
- adaptar a `MilestoneEvidence` y `MilestoneReview`.

Destino recomendado:
- modulo `evidence` del frontend oficial.

#### 2.5 Auth UX / Agent UX
Valor:
- medio-alto

Aporta:
- login/register;
- contexto de auth;
- agent bubble / chat / assistant settings.

Decision:
- **rescatar patrones UX**;
- no asumir implementacion actual como canonica.

Destino recomendado:
- shell de producto y experiencia asistida.

### Aportes de valor medio

#### Agenda / bookings
Valor:
- medio

Lectura:
- util como capa de scheduling y reservas operativas.
- no es el corazon del MVP canonico.

Decision:
- conservar como feature posterior o como soporte a reserva/visita.

#### Profesionales / panel profesional
Valor:
- medio-alto

Lectura:
- importante para lado supply del marketplace.
- necesita alineacion con perfiles, membership y trust.

Decision:
- rescatar estructura y journeys, pero rehacer con dominio correcto.

### Riesgos del satelite semseproject/app
- depende de Supabase y mocks/herencia que pueden no coincidir con el dominio final;
- tiene buen frontend pero no prueba por si solo solidez de dominio;
- puede arrastrar nombres de estados no canonicos.

### Veredicto
**Usar como banco de producto/UI.**
No usar como fuente de verdad de dominio.

---

## 3. Satelite: semse-control-mvp

### Lectura general
Este satelite aporta operacion de campo, memoria verificable y puente entre ejecucion real y trazabilidad.
Es especialmente valioso para `SEMSE Ops`.

### Evidencias vistas
Rutas/paginas relevantes:
- `app/marketplace/page.tsx`
- `app/escrow/page.tsx`
- `app/knowledge/page.tsx`
- `app/units/page.tsx`
- `app/agenda/page.tsx`
- `app/assistant/page.tsx`

README aporta conceptos clave:
- units;
- worklog/reportes;
- evidencia;
- knowledge compartido;
- milestones;
- vendors/compliance.

### Aportes de alto valor

#### 3.1 Knowledge
Valor:
- muy alto

Aporta:
- concepto de hechos inmutables con procedencia;
- memoria operacional durable;
- distincion entre nota cruda y hecho consolidado.

Decision:
- **rescatar concepto de dominio**;
- posiblemente no meterlo completo en MVP comercial inicial, pero si dejarlo previsto dentro de Ops/Trust.

Destino recomendado:
- dominio de knowledge / facts / provenance;
- posible extension de evidence + audit + timeline.

#### 3.2 Units tracking
Valor:
- alto

Aporta:
- seguimiento por unidad;
- estado + ultimo reporte;
- puente entre job comercial y ejecucion fisica.

Decision:
- **rescatar como submodelo opcional de ejecucion**;
- no debe reemplazar `Job` como agregado principal.

Destino recomendado:
- capa de ejecucion derivada para verticales de field work / property ops.

#### 3.3 Evidence + worklog orientation
Valor:
- muy alto

Aporta:
- mentalidad operativa real;
- reportes diarios;
- evidencia ligada a avance;
- captura de contexto que luego alimenta knowledge.

Decision:
- **rescatar fuertemente a nivel conceptual y UX**;
- integrar con milestones/evidence/audit del core.

Destino recomendado:
- extension de `MilestoneEvidence`, timeline y surfaces de Ops.

#### 3.4 Marketplace + escrow bridge desde operacion
Valor:
- medio-alto

Aporta:
- intento de conectar marketplace con unidades y backoffice;
- escrow conectado con milestones reales.

Decision:
- rescatar ideas de integracion entre capas.
- no tomar sus pantallas como canon definitivo si el dominio aun esta simplificado.

### Aportes de valor medio

#### Assistant
Valor:
- medio

Lectura:
- util como superficie de apoyo operativo;
- probablemente subordinado al trabajo principal de Jobs/Ops.

Decision:
- mantener como linea complementaria, no como prioridad de integracion inmediata.

#### Agenda
Valor:
- medio

Lectura:
- puede ser soporte operativo para visitas, crews o slots.
- no es prioridad por encima de reservation/contract/escrow/evidence.

### Riesgos del satelite semse-control-mvp
- puede arrastrar el sistema hacia control operativo antes de completar el happy path comercial;
- si se migra sin criterio, puede recentrar el producto alrededor de `Unit` en vez de `Job`;
- mezcla capa de operacion con capa de producto si no se modulariza bien.

### Veredicto
**Usar como fuente de conceptos y superficies para SEMSE Ops.**
No reemplaza el flujo comercial canonico.

---

## 4. Matriz resumida por modulo

| Modulo / capacidad | Fuente principal | Valor | Accion | Destino |
|---|---|---:|---|---|
| Publicar trabajo | semseproject/app | Alto | Rescatar UX | apps/web |
| Dashboard cliente | semseproject/app | Alto | Rescatar layout/patrones | apps/web |
| Escrow UX | semseproject/app | Alto | Rescatar UI | apps/web + dominio canonico |
| Evidencias UX | semseproject/app | Alto | Rescatar fuerte | evidence frontend |
| Auth UX | semseproject/app | Medio-alto | Adaptar | auth frontend |
| Agent chat UX | semseproject/app | Medio | Evaluar y adaptar | assistant surfaces |
| Knowledge / hechos con procedencia | semse-control-mvp | Muy alto | Rescatar concepto | Ops/Trust |
| Worklog operativo | semse-control-mvp | Muy alto | Rescatar concepto + flujo | Ops / timeline |
| Units tracking | semse-control-mvp | Alto | Integrar como ejecucion derivada | Ops / field model |
| Marketplace bridge | semse-control-mvp | Medio-alto | Extraer ideas | Jobs + Ops alignment |
| Agenda operativa | ambos satelites | Medio | Posponer o integrar luego | scheduling layer |
| Supply/profesionales UX | semseproject/app | Medio-alto | Adaptar | marketplace supply |

---

## 5. Orden recomendado de extraccion

### Ola 1: Product shell
- dashboard;
- publicar trabajo;
- escrow UX;
- evidencias UX.

### Ola 2: Domain-aligned ops
- worklog;
- knowledge;
- units tracking;
- timeline operacional.

### Ola 3: Supply + scheduling
- profesionales;
- agenda;
- bookings;
- panel profesional.

### Ola 4: Agent surfaces
- bubble/chat;
- settings;
- assistive ops surfaces.

---

## 6. Regla final

La integracion no debe hacerse por copiar carpetas.
Debe hacerse por modulo, con traduccion al dominio canonico de SEMSE.

Mandato:
- `Job` sigue siendo el agregado principal;
- `Project` y `Unit` solo viven como soportes de ejecucion transicional o verticalizada;
- `Evidence`, `Escrow`, `Dispute`, `Trust` y `Audit` deben ganar estructura propia;
- el frontend rescatado debe conectarse al core canonico, no al reves.
