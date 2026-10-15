# SEMSE Time Tracker AAAA — inventario funcional, brechas y arquitectura de integración

**Corte de análisis:** 2026-10-15 · **Repositorio:** Semse-projet/project-manager-app · **Origen:** experiencia real de uso + lectura de archivos de main + [EPIC #935](https://github.com/Semse-projet/project-manager-app/issues/935).

**Naturaleza:** informe de descubrimiento y contrato de alcance para descomponer en SDD 2.0. No es una spec APPROVED, ni prueba de CI, ni confirmación de producción. **AAAA es una meta interna**: Exactitud, Autorización, Autonomía operativa y Auditabilidad; no una certificación externa. No efectuar mutaciones de datos productivos desde este informe.

## 1. Decisión de arquitectura

Evolucionar la superficie existente /worker/tracker en vez de duplicar un Time Tracker, un Timesheet, un motor de tareas o un almacén de evidencia. Mantener los seis tabs y su navegación: Timer, Resumen, Registros, Proyectos, Reportes, Asistente. Los dashboards adicionales deben ser vistas contextuales bajo un grant efectivo (por ejemplo Mi equipo), no nuevas identidades de usuario ni una sesión OPS_ADMIN para un capataz.

El flujo **de trabajo asignado y ejecución** pertenece a Time Tracker; **diagnóstico/levantamiento, inspección inicial, presupuesto y cotización** continúan en Intake → Estimate/ProTools. La supervisión puede enviar una incidencia a un flujo especializado sin convertir el tracker en un segundo módulo de cotizaciones.

Fuentes canónicas y reutilización:

| Responsabilidad | Fuente/capa actual | Evolución permitida |
|---|---|---|
| Identidad y alcance | User, Org, Membership, capacidades CLIENT/PRO/WORKER, packages/auth | Grant contextual de trabajador, encargado o propietario, fechado y revocable. No crear un RBAC global SUPERVISOR con acceso a todas las empresas. |
| Tiempo | Labor Engine / TimeEntry | Única jornada neta; actividades como atribución/subintervalos y no segundo tiempo pagable. |
| Obra/servicio | Job/Project, FreeProject personal | Assignment explícita a Job del patrón; vinculación histórica por conciliación, nunca propiedad implícita ni coincidencia de nombre. |
| Tareas | JobTask; adaptadores BuildOps/agro en convergencia | Lista diaria, dependencias, bloqueo, reparto de tareas por persona/zona/turno; no tabla paralela permanente. |
| Multimedia | Evidence + Storage + revisiones | Media Library como vista de Evidence por obra, tarea, etapa y permisos; originales y custodia quedan en dominio Evidence. |
| Conversación | CommunicationThread / Communications | Mensajes de obra/cuadrilla/directos y notificaciones autorizadas; conservar texto fuente y versión traducida. |
| IA | Cronos en Time Tracker, Prometeo en ecosistema | Cronos muestra tiempo; Prometeo ayuda con instrucciones/tareas/traducción bajo Policy y aprobación humana cuando corresponda. No ejecutar mutaciones por interpretar una conversación. |

Referencias decisivas: docs/specs/core/universal-identity-multi-role.spec.md (CLIENT ≠ PRO ≠ WORKER, capacidad activa por contexto); docs/specs/tasks/task-unification-fase1.spec.md; docs/architecture/PRODUCTION_CONVERGENCE_MAP.md; docs/foundation/DOMAIN_INVARIANTS.md. **Pertenecer a un tenant no da por sí solo permiso sobre cada recurso.**

## 2. Estado de seis pestañas (observado en código, NO homologado en vivo)

| Tab | Capacidades presentes en main | Brecha a cerrar |
|---|---|---|
| Timer | Reloj iniciar/pausar/reanudar/detener, personal/libre/Job, nota, entrada manual, recuperación local y cola offline | Jornada/turno, obra ajena asignada, tarea actual, descanso regulado, conciliación de dispositivos y zona horaria, offline durable. |
| Resumen | Horas de hoy/semana/mes, gráficos, costos indicativos, entradas pendientes | Contexto persona/equipo autorizados, previsto-vs-real, segmentos por tarea y datos pendientes claramente diferenciados. |
| Registros | Historial 7/30/Todo, búsqueda de notas, filtro por destino, entrada manual, CSV | Ficha de entrada, distinción original/ajustada/aprobada, filtros históricos de archivados, reconciliación sin edición silenciosa; paginación real. |
| Proyectos | Alta/edición de FreeProject, color, texto ubicación, LocationPickerMap, archivar y elegir Job de conversión | Archivados/Restaurar, dirección desconocida o aproximada, vínculo entre pin/texto, trabajos asignados por empresa sin traspaso de propiedad, guard de conversión. |
| Reportes | Series semanal/mensual, exportación CSV semanal, top por propósito y Job | Cierre de nómina/periodos y políticas, desglose por cuadrilla/tarea/cliente autorizado, integridad de exportes, no confundir costo estimado con pago acreditado. |
| Asistente | Cronos, mensaje a Labor Engine/Ollama, historial de chat en localStorage | ES/EN por preferencia, herramientas sólo lectura por scope, coordinación supervisión/Prometeo, no filtrar chat entre cuentas/organizaciones en dispositivo compartido. |

### Hallazgos puntuales de UX y exactitud

- Archivar FreeProject oculta su ficha de las listas activas; la entrada de tiempo conserva referencia histórica. El resolutor visual puede presentar una etiqueta genérica si el proyecto archivado no se devuelve. Falta lista Archivados, detalle y restauración; vinculado a [#933](https://github.com/Semse-projet/project-manager-app/issues/933).
- Elegir Job al convertir FreeProject no es equivalente a incorporarse a la obra del empleador. Un trabajador por horas no debe ser propietario del Job; se necesita invitación/asignación. Seguridad por revisar en conversión y mutaciones vecinas; [#934](https://github.com/Semse-projet/project-manager-app/issues/934). **Señal de riesgo por inspección de código, no explotación demostrada.**
- Seleccionar ubicación en el mapa puede resultar en una ciudad ajena o exigir arrastrar el mapa. Se necesita dirección exacta, región aproximada o ubicación desconocida, con procedencia, texto/pin consistentes, sin falso GPS; [#931](https://github.com/Semse-projet/project-manager-app/issues/931).
- Crear proyecto libre, programar turno, fichar llegada y registrar tiempo manual son **cuatro acciones distintas**. El trabajador puede no conocer calle/número, hora de llegada ni de inicio cuando primero conoce el encargo.
- Existe un caso de jornada que el usuario percibió como mayor de 8h30; la UI mostró tiempos distintos en filtros y discutió un número cercano a 8.15. **No inferir que el dato productivo está incorrecto.** Reconstruir inicio, pausas, fin, zona horaria y unidad decimal antes de cualquier ajuste; never mutate original.
- El código usa Date.toISOString().slice(0, 10) para algunos filtros/fechas locales, y una entrada local normalizada puede llevar currency MXN mientras hay estimaciones en USD. **Revisar explícitamente** límites de día local, DST, moneda y fuente de tarifa; no afirmar un defecto productivo sin un test reproducible.
- La sincronización basada en localStorage es una protección parcial en un navegador, **no una garantía de backup o persistencia entre dispositivos**. Auditar eventos pendientes, reintentos, borrado de caché, sesiones cambiantes, autenticación y expiración.
- Los listados usan límites de 200/500 entradas en determinadas vistas; **Todo** significa actualmente la consulta cargada, no necesariamente todo el histórico si supera el límite. Requiere contrato paginado y conteos verificados.
- El historial de Cronos se conserva por claves locales de navegador. Confirmar aislamiento por actor/tenant/organización y limpieza segura en logout/cambio de cuenta; mensajes históricos nunca deben autorizar nuevas consultas.

## 3. Permisos por empresa / Job / cuadrilla

**Una sola cuenta puede ser CLIENT en un contexto, PRO independiente en otro y WORKER de una empresa en un tercero.** Supervisor/encargado es un permiso delegado sobre conjunto acotado de obras, personas y fechas; el nombre comercial del rol no extiende permisos de API.

| Acción | Trabajador asignado | Supervisor con grant | Dueño/admin de empresa | Cliente/contratista externo |
|---|---|---|---|---|
| Ver sus propias horas | Sí | Sí | Sí, propias | Sólo propias |
| Ver horas de terceros | No | Sólo su cuadrilla y periodo | Sólo su plantilla autorizada | No por defecto |
| Empezar/detener reloj de otra persona | No | No por defecto; solicitud/atestación | No por defecto | No |
| Asignar/reasignar tarea | No, salvo rol delegado específico | Dentro del ámbito y skill habilitado | Dentro del ámbito empresarial | Sólo tareas contractuales delegadas |
| Revisar/corregir hoja de tiempo | Solicita ajuste, no reescribe original | Revisa según política y separación de deberes | Revisa según política de empresa | Sólo entregables/horas compartidos expresamente |
| Subir foto/video | Si grant de captura de tarea | Si grant | Si grant | Si grant limitado |
| Aprobar/publicar evidencia | No su propia captura como aprobación independiente | Sólo si autorizado | Según política | Sólo hitos/entregables autorizados |
| Ver biblioteca completa de empresa | No | Sólo obra/equipo a cargo | Sólo proyectos propios permitidos | No |
| Acceder a nómina/costos privados | Sólo sus datos, donde aplique | No por defecto | Según permiso financiero sensible | No por defecto |

**Seguridad negativa obligatoria:** user A y B en el mismo tenant, dos org, dos cuadrillas del mismo patrón, subcontratista y cliente externo. Denegar id URL, recurso archivado, grant revocado, tarea reasignada y enlaces multimedia directos. Tanto UI como API/BFF deben evaluar el mismo scope. La revocación invalida vistas y lecturas futuras. No mostrar tarifas privadas, GPS personal histórico ni fotos ajenas como efecto de compartir un Job.

Asignación propuesta (sujeta a SDD): invited → accepted → active → ended/revoked, con actor invitante, scope Job/site/crew, periodo, fuente contractual, derechos y audit trail. No implementar estos estados sin cotejo con STATE_MACHINES y EVENT_CATALOG.

## 4. Experiencia objetivo y navegación progresiva

**Trabajador:** abre Time Tracker → ve empresa/obra/supervisor y horario previsto si existe → inicia o continúa UNA jornada → lee lista preasignada de tareas y documentación → cambia actividad manteniendo jornada → comunica bloqueo/falta de material → captura evidencia sólo si está autorizado → sale y comprueba horas y sincronización.

**Supervisor:** entra con la misma cuenta → la vista Mi equipo aparece únicamente si hay grant efectivo → ve sólo miembros/Jobs de su ámbito → distribuye actividades y dependencias antes del turno → manda instrucciones en inglés o español → recibe estados, bloqueos y evidencia → valida sin alterar unilateralmente el reloj de cada trabajador → escala anomalías y genera reporte. Puede dirigir cuadrilla especializada o mixta.

**Patrón/empresa:** conserva propiedad de Job/contrato, invita a encargados y personal, configura permisos por obra y turno, ve reportes autorizados y conversa con equipos. No requiere visitar físicamente cada sitio para administrar la operación.

**Subcontratista:** recibe alcance de entregables definido por contrato, no una Membership general de la empresa principal; gestiona su gente en su propia organización y publica únicamente lo convenido.

**UX de tabs:** conservar Timer, Resumen, Registros, Proyectos, Reportes, Asistente. Integrar Mis tareas e instrucciones como tarjetas/enlaces contextuales desde Timer y proyecto. Añadir Mi equipo contextual si la complejidad exige una pantalla propia. Biblioteca de obra mediante componente/vista de Evidence reutilizable desde las tareas o proyecto. No volver la barra principal una docena de tabs permanentes.

**Idioma:** cada persona define idioma preferido; la instrucción del patrón conserva original y versión/revisión. Traducciones ES↔EN (texto y, si se habilita, voz) con glosario de oficio; poder oír y responder en el propio idioma. Instrucciones críticas (electricidad energizada, altura, izaje, maquinaria) exigen confirmación humana de contenido y procedimiento autorizado; traducción automática no sustituye la seguridad laboral.

## 5. Descomposición reversible para SDD 2.0

| Wave / prioridad | Slice de implementación | Dependencia | Gate de salida |
|---|---|---|---|
| S0/P0 | Guard de conversión FreeProject→Job y mutaciones equivalentes, tests contra IDOR | #934 y policy real | Tests backend negativos cross-user/org/tenant y respaldo de datos intactos |
| S1/P0 | Archivo/restauración y lectura histórica/paginada; exactitud fechas/periodos y reconciliación | #933 | Reloj/registro/CSV/Reporte coinciden en segundos; restaurar no altera TimeEntry |
| S2/P0 | Ubicación exacta/aproximada/desconocida; corrección pin-dirección/consentimiento | #931 | Sitio sin dirección fichable; CDMX no se usa como fallback ficticio |
| S3/P1 | Invitación y participación limitada en Job ajeno + grants supervisor/crew | #932, #934; identity spec | 2 org / 2 cuadrillas / 3 perfiles con permisos revocables reales |
| S4/P1 | Tareas preasignadas, dependencias, incidencias y comunicación ES/EN | Convergencia JobTask, Communications | Trabajador sabe qué sigue sin instrucción verbal y sin iniciar segunda jornada |
| S5/P1 | Media Library por obra, captura delegada, revisión y retención | Evidence/Storage y restore aislado | SHA-256 del archivo original coincide con Evidence; permisos y revocación probados |
| S6/P2 | Reportes multi-contexto, asistente Cronos/Prometeo, accesibilidad y rendimiento | S0–S5 | UAT real autenticado, reintentos offline, sin fugas entre cuentas y métricas |

Cada slice crea spec/plan/tasks/checklist según plantillas; abrir un PR **reversible y limitado**. El programa no autoriza implementar todo en un solo cambio. Cambios a pagos y escrow exigen su gate Payment Governance propio.

## 6. Pruebas transversales de aceptación (UAT) y evidencias

| ID | Caso medible | Qué demuestra |
|---|---|---|
| UAT-01 | Worker nuevo acepta invitación del patrón y ve Job que nunca poseyó; otro worker no invitado ve 403/404 | Asignación, no transferencia de propiedad |
| UAT-02 | Una cuadrilla 20 personas, supervisor A de 7 y supervisor B de 6; cada uno sólo ve su ámbito | Scope exacto, sin filtraciones |
| UAT-03 | Cuadrilla mixta: misma persona trabaja electricidad, drywall, pisos en jornada neta 8h40; segmentos suman 8h40 | No doble conteo por actividad |
| UAT-04 | Dispositivo pierde señal tras iniciar, pausar, cerrar y volver; no se duplican events al sincronizar | Idempotencia y durabilidad observadas |
| UAT-05 | Reinicio navegador, salto de medianoche y cambio DST; fecha local y UTC concordantes | Precisión calendárica |
| UAT-06 | Proyecto libre archivado vuelve visible, conserva nombre/historia, sin alterar las horas | Integridad y reversibilidad |
| UAT-07 | Trabajador sin dirección registra horas; supervisor luego confirma sitio, sin falsificar GPS histórico | Ubicación y privacidad |
| UAT-08 | Encargado emite orden original EN; worker la lee ES y pide aclaración; original y versión auditables | Comunicación sin barrera idiomática |
| UAT-09 | Worker termina tarea A, puede empezar B sólo si dependencia/permiso/seguridad lo permiten | Autonomía operativa controlada |
| UAT-10 | Una foto sube, se revisa, se rechaza y repite; originales no se sustituyen y firma SHA/bytes verificable | Custodia y control de evidencia |
| UAT-11 | Se revoca supervisor y se intenta API/URL anterior de horas/fotos; acceso denegado | Revocación efectiva |
| UAT-12 | Usuario alterna org/rol en mismo navegador y chat de Cronos no expone contexto ajeno | Aislamiento de sesión/local storage |
| UAT-13 | Persona trabaja en dos empresas y factura una obra como PRO en otra; datos y permisos separados | Identidad multicapa |
| UAT-14 | Descargar CSV semanal y comprobar igualdad con entradas de API y filtros; advertir pendiente offline | Exactitud exportable |
| UAT-15 | Limpieza comercial por tres turnos, reparaciones en sitios múltiples y reparto con ruta de entrega | Núcleo multisectorial, especializaciones separadas |
| UAT-16 | Integración autenticada por rol desde web móvil y backend, CI, Railway deploy terminal, smoke y rollback | Evidencia de funcionamiento real |

**Regla para cerrar:** cada caso debe registrar fixture/datos autorizados, actor, entorno, commit SHA, endpoints, respuesta, capturas/logs sin PII y resultado PASS/FAIL. Un 200 health no equivale a prueba de rol, custodia o nómina. La restauración real de fotografías en almacén aislado y el cotejo SHA↔Evidence siguen como gate separado del módulo de captura.

## 7. Riesgos y decisiones de ingeniería

1. **Riesgo alto — IDOR:** conversión de FreeProject por identificador arbitrario. Revisar service/repository/guarda de owner, Job y contexto; NO intentar explotación sobre recursos de usuarios reales en producción.
2. **Riesgo alto — offline/shared device:** localStorage sin atadura comprobada a sesión/tenant, cambios sin receptor tras logout, cola expirada; proteger datos locales, revalidar en replay, disponer de export/recovery de pendientes.
3. **Riesgo alto — tiempo y dinero:** precisión de descansos, overtime por empleador y workweek/jurisdicción, fechas UTC vs local; jamás hacer liberación de escrow a partir de un timer.
4. **Riesgo alto — evidencia:** original, URL temporal firmada, malware/MIME, retención, back-up y restore, aislamiento de org y revocación. No confundir una miniatura visible con custodia recuperable.
5. **Riesgo medio — experiencia en campo:** ubicación arbitraria por mapa, nombres archivados ocultos, paginación de historial, datos por navegador, navegación con guantes/sin red, accesibilidad y traducción errónea.
6. **Decisión pendiente:** política de quién puede aprobar timesheets/entrada corregida y cómo es remunerado un descanso según empleador, contrato y jurisdicción. No codificar reglas únicas globales.
7. **Decisión pendiente:** protección de instrucciones de alto riesgo en ES/EN, cuándo requiere revisión humana y quién puede confirmarla.
8. **Decisión pendiente:** qué medios/subidas se admiten inicialmente según storage real, límites y retención; empezar por foto/video/documento soportados, no prometer audio/360 sin spec.

## 8. Fuentes, trazabilidad y entrega

- Código observado: apps/web/app/(app)/worker/tracker/page.tsx; sections/ResumenTab.tsx, RegistrosTab.tsx, ProyectosTab.tsx, ReportesTab.tsx, AsistenteTab.tsx; trackerLocalStore y labor-api. Revisar HEAD de main antes de escribir código.
- Dominio y base: apps/api/src/modules/labor-engine/; tasks/; communications/; evidence/; field-ops/; packages/auth/src/rbac.ts; packages/db/prisma/schema.prisma.
- Registro maestro: [#935](https://github.com/Semse-projet/project-manager-app/issues/935). Dependencias: [#931 mapa](https://github.com/Semse-projet/project-manager-app/issues/931), [#932 equipos](https://github.com/Semse-projet/project-manager-app/issues/932), [#933 archivados](https://github.com/Semse-projet/project-manager-app/issues/933), [#934 patrón](https://github.com/Semse-projet/project-manager-app/issues/934).
- Gobierno: AGENTS.md, .specify/memory/constitution.md, docs/SDD_GOVERNANCE.md, docs/SPEC_INDEX.md, docs/SOURCE_OF_TRUTH.md, DOMAIN_INVARIANTS, STATE_MACHINES y EVENT_CATALOG.

**Estado de este informe:** documentado. **No realizado:** especificación SDD por slice aprobada, código, tests, CI, merge, deploy, canary autenticado ni gate de fotos reales. Abrir primero S0 (seguridad) como cambio pequeño; no reescribir todo Time Tracker.
