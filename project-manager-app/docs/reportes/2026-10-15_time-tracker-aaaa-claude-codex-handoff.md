# Handoff de implementación — Time Tracker AAAA (para Claude/Codex)

**Fecha:** 2026-10-15 · **Trabajo padre:** [#935](https://github.com/Semse-projet/project-manager-app/issues/935) · **Informe maestro:** [2026-10-15_time-tracker-aaaa-inventory-delivery.md](2026-10-15_time-tracker-aaaa-inventory-delivery.md).

## Encargo operativo

Continuar sobre el Time Tracker existente de SEMSE Project. **No reemplazarlo**, no crear otro cronómetro, ni cambiar de manera masiva Job/Project/Labor/Evidence. Mantener UI, reloj, colores, seis pestañas y datos existentes. El usuario prioriza utilidad diaria desde teléfono, pero no autoriza sacrificar datos históricos, seguridad ni custodia de medios por velocidad.

**Primera ejecución esperada:** convertir EPIC #935 en PRs SDD de alcance pequeño con tests. No hacer merge/deploy/activar funciones sin la evidencia de gates correspondientes. No editar variables Railway. No ejecutar cambios en producción desde esta orden.

## Lectura obligatoria, en orden

1. project-manager-app/AGENTS.md, .specify/memory/constitution.md.
2. docs/SPEC_INDEX.md, docs/SOURCE_OF_TRUTH.md, docs/foundation/DOMAIN_INVARIANTS.md, STATE_MACHINES.md, EVENT_CATALOG.md.
3. docs/SDD_GOVERNANCE.md, .specify/templates/overrides/{semse-spec,semse-plan,semse-tasks,semse-checklist}.md.
4. docs/specs/core/universal-identity-multi-role.spec.md, docs/specs/tasks/task-unification-fase1.spec.md y specs existentes de labor.
5. Código relevante y tests en apps/web/app/(app)/worker/tracker; apps/api/src/modules/labor-engine, field-ops, tasks, communications, evidence; packages/auth y packages/db/prisma.
6. Issues #931, #932, #933, #934 y el EPIC #935; verificar su estado vivo antes de empezar y revisar PRs abiertos para no pisar a otros agentes.

## Orden de intervención

### Slice S0 — Seguridad de proyectos libres / Job conversion (P0)

- Inspeccionar POST convertToJob (controller → service → repository), PATCH y archive; trazar actor tenantId, createdBy y autorización de Job destino. No asumir que el tenant compartido implica propiedad.
- Proponer spec DRAFT y clarificar/obtener APPROVED antes de código. El primer patch debe permitir sólo mutaciones de FreeProject propias o explícitamente delegadas; comprobar destino existente/no eliminado y Job autorizado; no transferir propiedad.
- Empezar con tests negativos **mismo tenant + otro dueño**, otro Org, otro tenant, Job desconocido/eliminado, id arbitrario, conversión repetida, proyecto archivado/convertido, rol sin permiso, participación válida; verificar no cambio de status/convertedJobId tras rechazo.
- Añadir auditoría para transición permitida según catalogación de eventos vigente. No inventar eventos sin revisar EVENT_CATALOG.
- Si el flujo actual tiene dependencia funcional que todavía no está especificada, documentar decisión y mantenerlo bloqueado; no abrir acceso permisivo como parche.
- Relación con #934 y #933; **no** hacer operaciones de prueba sobre proyectos de usuarios reales.

### Slice S1 — Archivados e historial íntegro (P0)

- Leer status de FreeProject, proyección de lectura, resolveEntryProject, query de TimeEntry y export CSV. Crear filtro Activos/Archivados/Todos, detalle de proyecto archivado, y restauración sólo con owner/grant. Preservar nombre histórico y referencia; no cambiar duración/autoría/status de entradas al restaurar.
- Definir paginación de Todo (sin tope oculto de 200/500), distinción entre vista cargada y total histórico; conciliación exacta API ↔ dashboard ↔ CSV.
- Prueba con registro >8h30, pausas, cambio de día, UTC/horario local y cambio de zona horaria; no usar minutos decimales como HH:mm ni presentar cálculo aproximado como confirmado.
- Registrar audit de archivo/restauración; no presentar CSV como backup ni archivar ficheros de Evidence implícitamente.

### Slice S2 — Ubicación fiable (P0)

- Inspeccionar LocationPickerMap y defaults antes de cambiar mapa. Modelar sitio desconocido/aproximado/proporcionado/verificado y fuente de precisión.
- Mantener formulario guardable sin dirección y fichaje voluntario sin GPS. Dirección descriptiva y pin no deben contradecirse; sin fallback City of Mexico que parezca posición real; no pedir geolocalización continua sin consentimiento específico.
- Cuando un responsable confirme ubicación, actualizar la obra sin fingir que la persona estaba geolocalizada en turnos históricos.

### Slice S3 — Grupos y permisos supervisor (P1)

- Extender contexto User/Org/Membership/Job con asignación explícita y temporal a obra/cuadrilla; respetar roles CLIENT, PRO y WORKER definidos en spec de identidad. Un profesional puede ser encargado en una obra y trabajador en otra.
- Diseñar grant con actor, org, Job, crew, vigencia y capacidades; backend evalúa tenant + org + recurso + persona + vigencia en cada endpoint, incluyendo revocación.
- Una sola jornada TimeEntry y varios segmentos de actividad sin superposición. Crew mixta admite electricidad/drywall/pisos; no generar Timesheets por oficio.
- UI Mi equipo visible sólo con permiso efectivo y sin exponer nóminas privadas o ubicaciones personales. El Job sigue siendo del patrón/contratista.

### Slice S4 — Tareas y traducción en contexto (P1)

- Reutilizar JobTask y CommunicationThread. El supervisor prepara tareas (y dependencias) antes del turno; trabajador las recibe en ES o EN, con original conservado, autor, versión, prioridades, materiales, seguridad y next action.
- Persona puede marcar inicio/progreso/fin/bloqueo o pedir traducción/aclaración dentro de su ámbito; ninguna acción crítica de seguridad es autorizada por una traducción automática.
- No detener/iniciar el reloj principal al cambiar de tarea. Tras completar A, proponer B sólo cuando se cumplan permisos, skills y dependencias.

### Slice S5 — Media Library y Evidence (P1)

- Reutilizar Evidence/Storage por Job/tarea y permisos. Permitir política configurable: sólo supervisor captura, o trabajadores autorizados aportan; revisión/approval siempre segregada cuando requerido.
- Web y móvil presentan los mismos metadatos autorizados: obra, autor, fecha, tipo, fase, revisión, vínculo a tarea, miniatura y acceso temporal.
- Comprobar recuperación de fotos originales reales mediante copia cifrada, restore aislado y SHA-256 contra Evidence/DB ANTES de declarar cadena de custodia completa. No hacer restore destructivo en volumen productivo.

### Slice S6 — Informes, asistente y experiencia 4A (P2)

- Informes individuales y de equipo con desglose verificado sin revelar costos no autorizados. Integrar Cronos/Prometeo únicamente mediante tools con policy: consultas de horas, tareas asignadas y traducciones; no autorización implícita por chat.
- Revisar que localStorage de chat, cola de tiempo y filtros no queden mezclados entre usuarios/org; limpiar o aislar tras logout, revocación y cambio de cuenta.
- UAT real con 20+ trabajadores, un patrón, dos supervisores, subcontratista y segundo tenant; móvil, red intermitente, inglés/español, accesibilidad; monitoreo y rollback.

## Gates obligatorios para CADA slice

- [ ] Spec DRAFT → aclarado → APPROVED por el owner, plan, tasks, checklist y análisis constitucional sin gaps; index regenerado por pnpm spec:index.
- [ ] Test negativo del defecto/situación (FAIL previo) + test de aceptación + ausencia de regresión (PASS posterior).
- [ ] Migración expand/contract y rollback documentados si aplica; backups/retención en operaciones con datos.
- [ ] Typecheck/lint/tests, pnpm spec:validate:strict, cobertura dirigida; reportar qué fue ejecutado y qué no.
- [ ] PR acotado con archivos exactos, hashes de commit y política de riesgos, revisión de secretos, estado CI terminal y bloqueos.
- [ ] Si se aprueba merge, registrar SHA; después separar deploy/activación/canary y smoke autenticado. HEALTH no equivale a aceptación.
- [ ] Evidencia PASS de worker, supervisor, dueño, acceso no autorizado, otro tenant, archivados, y desincronización; IDs de prueba ficticios o autorizados.

## Política de coordinación

- No rebasar ni forzar ramas ajenas. Crear rama propia desde main actual y comprobar diff antes de escribir. No reutilizar el branch documental como rama de feature.
- No modificar CI, migraciones, Railway ni variables para hacer pasar pruebas.
- No confundir código existente, funcionalidad aprobada y producción verificada. Reportar separadamente: SPEC / CODE / TEST / CI / MERGE / DEPLOY / ACTIVATION / UAT.
- Anotar en #935 enlaces a cada child spec/PR/test; marcar dependencia con #931–#934; no cerrar #935 por terminar un slice parcial.
- Si un slice afecta Payment/Escrow, separar spec crítico y aplicar Payment Governance, nunca liberar fondos sólo por fichaje o por IA.
- No almacenar secretos, sesiones reales, documentos personales ni datos de trabajador en logs o tickets.
- Si no hay entorno autorizado para hacer un test, registrar NOT_VERIFIED y procedimiento requerido; **no inventar evidencia**.

## Primer entregable solicitado a Claude/Codex

Presentar un **diseño de S0** con diagnóstico fuente-línea, spec SDD 2.0 DRAFT, plan reversible, matriz de guardas, tests negativos y lista de decisiones pendientes para aprobación. **No iniciar S3–S6 como megacambio**. Antes de solicitar un merge, demostrar CI y protección de tiempo/evidencia de los recorridos existentes.

**Referencia:** [matriz funcional y UAT completa](2026-10-15_time-tracker-aaaa-inventory-delivery.md).