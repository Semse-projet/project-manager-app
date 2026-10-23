# Propuestas para cerrar OPEN-SUP-02…06 (P-02…P-06)
**Fecha:** 2026-10-22 · **Estado:** PROPUESTA / REVISIÓN DE PRODUCTO, sin aprobación todavía.  
**Fuente:** BO-01 (invitaciones), BO-05 (ofertas/engagement), BO-07 (Crew), BO-10
(TaskAllocation), universal-identity-multi-role, business-access-foundation,
P-01 owner authority y guía de jornada/evidencia de SEMSE.

> El propietario ya aprobó OPEN-SUP-01 (solo owner/representante verificado
> designa y revoca). **Nada en este documento amplía esa aprobación**.
> Solo se proponen decisiones conservadoras para revisión posterior.

## OPEN-SUP-02 — quién puede ser nombrado supervisor

**Problema:** `Membership WORKER ACTIVE` demuestra acceso a la Org, pero
no documenta por sí sola la forma de contratación legal ni autorización
para realizar tareas en una obra. `BusinessEngagement` es relación
comercial separada; su función BO-05 está documentada como DRAFT.

**Opción A (recomendada para MVP):** WORKER ACTIVE + designación
de supervisor por owner/representante verificado + vinculación efectiva
a la cuadrilla/obra autorizada. Antes de permitir trabajo real, la
empresa debe confirmar fuera de este slice que existe base adecuada
para prestar el servicio, sin inferir W-2/1099. Si más adelante
`BusinessEngagement` se vuelve obligatorio por un contrato aprobado,
adaptar guard y onboarding sin invalidar identidades portables.

**Opción B:** exigir además `BusinessEngagement ACTIVE` para cualquier
supervisor. Más exigente, pero bloquea escenarios de empresa donde el
engagement legal se maneje por otro sistema no integrado.

**Opción C:** exigir `WORKER ACTIVE` + vínculo externo verificado por
fuente autorizada alternativa al BusinessEngagement, con prueba de
alcance y caducidad. Útil a largo plazo; más complejo.

**Gate abierto:** quién certifica relación válida y cuál es
la fuente aprobada; ninguna opción autoriza firma automática, nómina
ni acceso a sueldo. No crear migración hasta ratificación.

## OPEN-SUP-03 — principal y suplencia

**Propuesta MVP:** máximo **un supervisor principal operativo**
por cuadrilla en un intervalo de autoridad; el owner verificado puede
sustituirlo con razón y marca temporal en transacción.
Permitir prepararse un suplente `PENDING` sin poder actuar hasta
activación o relevo explícito. Para períodos superpuestos, no
autorizar dos personas con la misma facultad de gestionar/revisar
tareas sin política de conflicto y registro de turno.

**Otras opciones:** varios supervisores concurrentes con separación
por trade/actividad/turno; capacidad de jerarquía general. Dejar
para S2+ con FSM específica y tests de carrera.

**Casos P1:** ausencia del principal, fin de vigencia a mitad de turno,
principal expulsado de Org, suplente no WORKER ACTIVE, y reemplazo
durante asignación concurrente.

## OPEN-SUP-04 — alcance operativo por defecto

| Operación | Supervisor de su crew | Escalamiento |
|---|---|---|
| Leer roster, estado de tareas y materiales no sensibles | grant explícito, misma org/crew | no |
| Crear/asignar tareas internas de su crew | grant explícito, miembros elegibles | no |
| Reasignar dentro de su crew | grant explícito, con motivo | cuando hay disputa/guard |
| Mover trabajador a otra crew/obra | solicitar, nunca ejecutar por defecto | dueño/representante/gestor con scope |
| Cargar fotos/evidencia propia/de equipo autorizada | sí bajo policy Evidence | aprobación independiente cuando aplique |
| Aprobar su propia ejecución/evidencia | no | revisor independiente |
| Leer horas de cuadrilla | lectura limitada con permiso específico | datos privados salariales ocultos |
| Corregir/aprobar horas ajenas | solicitud, no aprobación implícita | actor de time governance autorizado |
| Pedir materiales | sí | compras requieren delegación presupuestaria |
| Comprar / liberar pagos / cerrar milestone financiero | no, por supervisión solamente | policy económica independiente |
| Invitar, contratar o terminar engagement | no, por supervisión solamente | owner/HR autorizado |
| Consultar compensación de otros | no | policy de ofertas/nómina, separada |

**Punto de compatibilidad:** `org:crews:manage` de PRO/CLIENT
existe como permiso de membresía actual. Nunca usarlo como
sustituto del grant temporal del supervisor. Un propietario
con permisos legítimos de gestión puede conservarlos,
pero el acto de *designar supervisor* exige fuente de
propietario/representante verificada por separado.

## OPEN-SUP-05 — seguridad de obra

**Propuesta:** cualquier trabajador debe poder reportar peligro o
solicitar detener actividad insegura; no condicionar esa comunicación
a un grant de supervisor. Los responsables de la obra reciben
alerta y deben coordinar protección conforme a reglas reales.
El supervisor puede registrar/escalar observación con trazabilidad;
resolver/cerrar oficialmente un incidente requiere actor delegado
y criterios validados. La designación de `crew supervisor` por
SEMSE **no prueba** nombramiento ni formación de
`competent person` según OSHA.

**No objetivos:** SEMSE no certifica seguridad ni reemplaza
supervisión humana. Fotos de lesiones/salud/datos personales se tratan
como privacyCritical; no enviarlas a RAG por defecto.

**P1:** empleado reporta peligro aunque supervisor suspendido,
revocación durante incidente activo, intento de auto-cerrar sin
revisión, retención de evidencia histórica tras cambiar de Org.

## OPEN-SUP-06 — migración/activación del legado

**AS-IS:** `Crew.supervisorUserId` es referencia singular;
`rosterForSupervisor` y `requireCrewScope` revalidan
alguna Membership ACTIVE, no siempre WORKER ACTIVE. El
PR #1027 no activa flags BO-07 o BO-10.

**Propuesta por fases:**
1. Documentar/asentar S0-F01…F05, escribir tests negativos
   y corregir guardas bajo spec aprobado, sin tabla nueva.
2. Introducir `CrewSupervisorDelegation` de manera aditiva,
   con estado y audit, flag OFF.
3. Para orgs existentes, inventariar `Crew.supervisorUserId`
   y verificar WORKER ACTIVE + autorización empresarial;
   nunca hacer backfill indiscriminado.
4. Canary solo organizaciones sintéticas autorizadas:
   grant explícito obligatorio para las rutas nuevas; no
   confiar en un `supervisorUserId` desactualizado.
5. En caso de error, pausar feature conservando datos;
   rollback sin abrir acceso más permisivo que antes.
6. Actualizar `STATE_MACHINES.md` y `EVENT_CATALOG.md`
   antes de nuevos eventos; smoke autenticado y evidencia
   por SHA desplegado, nunca solo HEALTH.

**Pruebas P1:** cruzar 2 tenant, 2 org, 2 crews, 1 persona
PRO + WORKER; caducidad/revocación, grant ausente,
registro sin owner verificado, cambio de obra durante
jornada, no perder horas/evidencia, cambio ES/EN sin
perder datos.

## Recomendación de paquete de decisiones

| ID | Recomendación a ratificar | Estado |
|---|---|---|
| OPEN-SUP-02 | Opción A con requisitos laborales externos y ningún W-2/1099 inferido | PENDIENTE |
| OPEN-SUP-03 | Un principal, suplencia en estado sin autoridad hasta activarse | PENDIENTE |
| OPEN-SUP-04 | Operaciones dentro de crew; cambios entre obras/horas/compras sujetos a autoridad aparte | PENDIENTE |
| OPEN-SUP-05 | Reporte de riesgos sin gate; cierre solo responsable verificado | PENDIENTE |
| OPEN-SUP-06 | Guardas S0 primero, migración aditiva, backfill selectivo, canary fail closed | PENDIENTE |

## Siguiente gate y orden

- Antes de aprobar la spec global, ratificar las cinco propuestas
  o editarlas sin cambiar la regla ya aprobada OPEN-SUP-01.
- El documento P-01 del owner verifica **no hay fuente canónica
  ya existente** en las rutas observadas; la propuesta
  `OrgAuthorityGrant` es modelo nuevo candidato, **no creado**.
- Solo después iniciar tests/código S0 bajo SDD autorizado; review
  independiente y tests locales. **CI manual al final de
  preparación y antes de merge**, según instrucción del owner.
- Este archivo no es consentimiento legal, ni autorización de
  contratos, deploy, migraciones o personas reales.
