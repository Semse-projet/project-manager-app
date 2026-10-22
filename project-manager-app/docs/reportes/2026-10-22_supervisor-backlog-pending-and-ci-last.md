# SEMSE — Pendientes consolidados de supervisores y cuadrillas
**Corte:** 2026-10-22  
**PR de referencia:** [#1027](https://github.com/Semse-projet/project-manager-app/pull/1027) (`docs/sdd-crew-supervisor-delegations-20261022`)  
**Tipo:** registro de decisiones, riesgos, dependencias y pendientes. **No autoriza implementación ni cambios en producción.**

## 0. Instrucción operativa del propietario (2026-10-22)

**CI PARA EL FINAL DE LA PREPARACIÓN.** Primero terminar la conciliación documental,
resolver decisiones funcionales, autorizar el spec, preparar tests, corregir
código por slices, ejecutar pruebas locales y revisión independiente. Después,
cuando el HEAD esté estabilizado y los gates previos cumplidos, revisar/reparar
lo necesario del CI y exigir resultado terminal PASS **antes de fusionar el PR
técnico**. No merge/deploy/activar con CI fallido. No desactivar, esquivar ni
suavizar workflows/gates para aplazar el CI. Los workflows automáticos de GitHub
pueden arrancar por eventos push/PR: esta instrucción difiere el *trabajo activo
de diagnóstico/reruns*, no garantiza impedir triggers automáticos.

**Alcance:** esta priorización corresponde al programa de supervisores y
cuadrillas (#1027), no desactiva controles obligatorios para otros PR.

## 1. Inventario de lo decidido y evidencias

| ID | Tema | Situación | Fuente/nota |
|---|---|---|---|
| DEC-SUP-01 | Solo propietario o representante **verificado** de la Org nombra y revoca supervisores | **APROBADO** 2026-10-22 | `crew-supervisor-delegations.spec.md` OPEN-SUP-01 |
| DEC-SUP-02 | No crear rol global SUPERVISOR; distinguir CLIENT/PRO/WORKER y autoridad por contexto | **DISEÑO EXISTENTE / CONSERVAR** | `universal-identity-multi-role.spec.md` y BO-07 |
| DEC-SUP-03 | No convertir invitación, tarea, fichaje o fotos en contrato, nómina o pago | **REGLA EXISTENTE / CONSERVAR** | BO-01/05/10, Payment Governance |
| DEC-SUP-04 | Preservar `JobTask`, `TaskAllocation`, `TimeEntry` y Evidence | **REGLA EXISTENTE / CONSERVAR** | BO-10, Time Tracker handoff |
| DEC-SUP-05 | CI como último gate de preparación antes de merge | **INSTRUCCIÓN DEL PROPIETARIO** 2026-10-22 | este documento |
| OBS-CI-01 | CI previo con `unit-coverage` y `quality-gates` en failure; `e2e` skipped | **HISTÓRICO, CAUSA NO_VERIFIED** | run `39827733152`; logs no recuperados en esa lectura |

**Estado no validado actualmente:** deploy API/Web, flags, migraciones,
UAT y prueba de producción de BO-07/BO-10; no extrapolar desde specs DRAFT.
El PR #1027 es exclusivamente documental y sigue DRAFT. Ningún test de S0
ha sido ejecutado por la auditoría estática.

## 2. Registro priorizado de pendientes (single source para este programa)

| ID | Prioridad | Pendiente verificable | Requisito previo | Cierre observable |
|---|---|---|---|---|
| P-01 | P0 diseño | Identificar fuente canónica que prueba dueño/representante de Org; diseñar claim, verificación, revocación y protección de último propietario | DEC-SUP-01 | policy comprobable por `tenantId+orgId+actorId`, sin inferencia por PRO/CLIENT/OPS_ADMIN |
| P-02 | P0 diseño | Resolver OPEN-SUP-02: elegibilidad `WORKER ACTIVE` + `BusinessEngagement ACTIVE` o fuente alternativa de autorización | P-01 y política de ofertas | contrato ratificado que nunca confunda invitación y contratación |
| P-03 | P1 diseño | Resolver OPEN-SUP-03: supervisor principal y suplente, sustitución, superposición de fechas y concurrencia | P-01 | cardinalidad y FSM definidos |
| P-04 | P0 diseño | Resolver OPEN-SUP-04: permisos que puede ejecutar vs solicitar (tareas, horas, materiales, mover personal entre crews/obras) | P-01 | matriz de capabilities por recurso y responsabilidad |
| P-05 | P0 diseño | Resolver OPEN-SUP-05: quién registra/escala/cierra incidentes; work-stop y persona competente sin equiparar título digital a acreditación | seguridad de obra | responsabilidad, escalamiento y trazabilidad |
| P-06 | P0 diseño | Resolver OPEN-SUP-06: activación reversible, migración desde `Crew.supervisorUserId` sin backfill ciego ni fallback permisivo | P-01 a P-05 | transición legacy, flags y rollback seguro |
| P-07 | P0 security | S0-F01: WORKER suspendido + PRO ACTIVE aún pasa checks basados en cualquier Membership ACTIVE | spec BO-07/10 aprobado | pruebas N01/N02 + guard backend efectivo |
| P-08 | P0 security | S0-F02: assign usa `CrewMember.ACTIVE` sin revalidar WORKER ACTIVE del destinatario | P-07 / guard común | prueba N03 y 0 mutaciones ilegítimas |
| P-09 | P0 security | S0-F03: `TaskAllocationsService.listMine/updateStatus` con acceso anterior tras revocación de membership/crew | P-07 / política de historical read | pruebas N04-N07; conservación de historial |
| P-10 | P0 security | Separar acceso de gestor org (`org:crews:manage`) del supervisor operativo; no retirar facultades legítimas a PRO dueño | P-01 | pruebas de dueño verificado, PRO ajeno, OPS_ADMIN, cross-org |
| P-11 | P1 integridad | S0-F05: definir atomicidad all-or-nothing/resultado parcial explícito de asignación masiva, reintentos y revocación concurrente | contrato de lote | pruebas N10-N12, audit consistente |
| P-12 | P0 SDD | Actualizar/armonizar BO-07, BO-10, identidad, Membership y business offers; permisos, respuestas 401/403/404/409/422, eventos y estados | P-01…P-11 | spec coherente `APPROVED`, plan/tasks/checklist y análisis |
| P-13 | P1 seguridad | Diseñar `CrewSupervisorDelegation` con tenant/org/crew, vigencia, permisos, versión, motivo y revocación | P-01…P-06 | schema, índices, lifecycle, política y rollout revisados |
| P-14 | P1 implementación | S0a: tests rojos antes del parche mínimo de guardas; PR acotado | P-12 | N01-N09 demostradas FAIL antes / PASS después, sin regresión |
| P-15 | P1 implementación | S0b: atomicidad de lote/idempotencia bajo fallo tardío | P-11, P-12 | N10-N12 PASS y efecto observable coherente |
| P-16 | P1 implementación | S1: fuente de autoridad del dueño/representante y sus controles | P-01, P-12 | grant/revoke protegido y auditable |
| P-17 | P1 implementación | S2: migración aditiva, endpoints y policy de supervisión; outbox/auditoría coherentes | P-13, P-16 | tests, version CAS, evento catalogado, checksum y rollback |
| P-18 | P2 interfaz | S3: panel /client/team, /worker/crew, BuildOps, ES/EN, formularios sin pérdida de datos | P-17 | journeys multi-rol y UI mobile/denied/degraded |
| P-19 | P2 integración | Time Tracker/Evidence/Prometeo: permisos de lectura/acciones mínimos, sin cronómetro duplicado ni aprobación automática de pago | P-17 | smoke local con datos sintéticos y no-regresión |
| P-20 | P0 calidad local | Tests unitarios, API integración, negative auth, concurrencia; lint/typecheck/build; `spec:validate:strict` local y review independiente | P-14…P-19 | evidencia local y aprobación de revisión sobre HEAD estable |
| P-21 | P0 CI último | **Al terminar lo demás**, diagnosticar y corregir fallos de CI sin alterar gates, ejecutar/verificar check completo sobre HEAD final | P-20 | PASS terminal, cobertura/quality/e2e exigibles, SHA exacto |
| P-22 | P0 entrega | Merge explícitamente autorizado, migración versionada, staging, smoke autenticado ES/EN, canary y rollback; separar estados | P-21 | pruebas/evidencia por etapa, nunca producción desde DRAFT |

Prioridad P0 indica **bloqueo de seguridad/diseño**, no autorización
para ejecutar acciones sensibles. Las fases S0–S4 requieren PRs separados.

## 3. Guía de decisiones restantes

**OPEN-SUP-02 — vínculo/engagement:** ¿cómo demostrar la relación y
consentimiento para trabajo de una cuadrilla cuando todavía no existe
una oferta confirmada? Propuesta conservadora: WORKER ACTIVE +
autorización empresarial verificable y específica; si se usa un
engagement, exigir su vigencia, sin dar por sentado contrato legal.

**OPEN-SUP-03 — suplencia:** propuesta para primer slice: un supervisor
principal operativo por cuadrilla y sustitución auditada; suplente solo
con grant expreso, limitado y sin dos autoridades concurrentes sobre
la misma acción sin política. Requiere ratificación.

**OPEN-SUP-04 — capacidades:** asignar/reasignar dentro de propia crew,
ver roster, registrar avance y solicitar material directamente; horas
ajenas solo lectura laboral acotada si se concede; corrección/aprobación
de horas, compra y movimiento a otra crew sujetos a autoridad adicional.
No aprobar su propio trabajo cuando se exige segregación.

**OPEN-SUP-05 — seguridad de obra:** cualquier trabajador debe poder
informar y detener una actividad peligrosa según política real del sitio;
el software debe facilitar reporte/escalamiento. La designación digital
no confiere calificación OSHA de persona competente. Cierre formal y
aceptación de riesgos requieren responsables verificados.

**OPEN-SUP-06 — migración:** sin importar `supervisorUserId` legado
como grant universal. Validar individualmente designaciones legítimas,
doble lectura solo si es *no permisiva*, y cortar flag en caso de
accesos indebidos, conservando auditoría e historial.

## 4. Orden de trabajo sin CI ahora

1. **Consolidar dominio y decisiones** (P-01…P-06); no cambiar permiso
   de PRO/CLIENT/OPS_ADMIN para tratar a un usuario como dueño.
2. **Cerrar controles S0 y contratos** (P-07…P-12). Hacer análisis de
   los casos negativos N01–N12 y especificar sus errores esperados.
3. **Solicitar aprobación del SDD aplicable** antes de modificar negocio
   (P-12). El consentimiento sobre OPEN-SUP-01 es *parcial*, no APPROVED.
4. **Implementación por incrementos reversibles** (P-13…P-19).
5. **Pruebas locales, documentación, index y revisión de seguridad**
   (P-20); pueden iterarse durante desarrollo.
6. **CI AL FINAL DE LA PREPARACIÓN** (P-21). Diagnosticar run histórico
   y comprobar HEAD final, sin debilitar validaciones. Puede haber CI
   automático por pushes durante el proceso.
7. **Solo luego**, autorización de merge, deploy, migración y canary
   (P-22). No dejar CI pendiente *después* del merge/deploy.

## 5. Criterio para marcar cada pendiente `DONE`

- Enlace a spec y decisión ratificada, o prueba/código/PR pertinente.
- SHA del head probado y archivos afectados cuando aplica.
- Evidencia de tests ejecutados (no solo casos enumerados).
- Owner del cambio y siguiente acción operativa.
- No marcar DONE por documento, propuesta o resultado de healthcheck
  si exige UAT o runtime.

## 6. Próxima sesión: punto de reentrada

**Empezar por P-01:** reconciliar la fuente de propietario/representante
en `Org` y flujos de onboarding/claim; proponer policy en SDD y tests
denegados para PRO/CLIENT/OPS_ADMIN sin verificación. En paralelo
completar OPEN-SUP-02…06 en documento, sin generar nuevo módulo ni
cambiar Payment/TimeEntry/Evidence. Luego S0-F01…05.

**No hacer todavía:** rerun manual del CI; relajar quality-gates;
fusionar #1027; editar migraciones/flags de Railway; activar con
personas reales; afirmar que BO-07/BO-10 está verificado en producción.

## 7. Estado de esta sesión

- Se modifican solamente documentos del PR #1027.
- Los pendientes aquí están **documentados, no implementados**.
- La causa del fallo CI histórico sigue `NO_VERIFIED`, para el
  último gate; no hay evidencia nueva de éxito.
