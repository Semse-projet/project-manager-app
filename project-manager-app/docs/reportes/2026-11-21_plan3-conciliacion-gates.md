# Plan 3 — Conciliación semanal: revalidación de gates (2026-11-21)

**Tipo:** sesión documental / inspección estática. **No** es implementación, prueba funcional, CI, merge, despliegue ni activación.
**Rama:** `claude/plan3-conciliacion-gates-32rob6` sobre `main@86c0be5468a7c96c0a9dd4bc8df34e386e7c8c7f`.
**Spec:** [`labor.weekly-reconciliation`](../specs/labor/weekly-reconciliation.spec.md) v0.8 `DRAFT`.

## Qué cambió en el repositorio

| Archivo | Cambio |
|---|---|
| `docs/specs/labor/weekly-reconciliation.spec.md` | Nuevo en el repositorio canónico. v0.8 `DRAFT` = cuerpo v0.6 (espejo Library rev. 22, copia Drive) sin cambios de texto + §0 y §10.10–§10.19 nuevos. |
| `docs/SPEC_INDEX.md` | Regenerado con `node scripts/spec-index.mjs` (219 → 220 filas). |
| Este reporte | Nuevo. |

No se tocó código, esquema, migraciones, workflows, permisos ni configuración.

## Hallazgos nuevos verificados en `86c0be5` (detalle en la spec)

1. **Escritores de TimeEntry:** 9 llamadas directas en 3 archivos (Labor Engine ×6, Field Ops ×2, BO-08 ×1) más escritores indirectos por FK (`Tenant` Cascade, `Job`/`FreeProject` SetNull), migraciones y scripts de smoke. Ninguno usa revisión/CAS; ninguno usa `appendInTransaction`; Labor Engine no audita; Field Ops audita después de escribir y no audita la edición de notas.
2. **Rutas admin** `admin/timer/:id/pause|stop` resuelven por `tenantId` sin `orgId`.
3. **Idempotencia de creación** existe (`clientEventId` único por tenant+creador); no hay idempotencia para updates ni aprobación.
4. **Identidad de worker:** sesión emitida vía bootstrap token con `userId/roles` declarados; roles efectivos acotados en cada request por membresías `ACTIVE`; no existe principal de servicio tipado. `workerId` es etiqueta libre.
5. **Auditoría:** `AuditService` no persiste `orgId`; ignora el `id` del llamador; `appendInTransaction` sólo lo usa `professional-skills`; no hay registro durable ALLOW/DENY; `AuditLog` se borra en cascada con el tenant.
6. **Perfil horario:** `LaborSchedulePolicy` sin zona horaria, inicio de semana, asignación por trabajador ni elegibilidad; `createManualEntry` interpreta fecha/hora en la zona del proceso; dos definiciones de semana (local vs UTC).
7. **Evidence:** `TimeEvidence` sin FK a `Evidence`, sin tenant/checksum; sin uso en código.
8. **CI:** los workflows existen en la raíz exterior (`.github/workflows/`, 19 archivos); corrige la afirmación de Plan 3 §32.1.
9. **Baseline:** hashes de CSV/JSON/derivado coinciden; 20/20 IDs; cifras 619,140 / 617,520 / 1,620 / 24 s confirmadas; +120 s sin causa; Δ marcas/duración +436.489 s en 11/15 filas.

## Validaciones ejecutadas

| Comando (desde `project-manager-app/`) | Resultado |
|---|---|
| `node scripts/spec-validate.mjs --strict` (antes del cambio) | 219 specs, 0 errores, 0 avisos |
| `node scripts/spec-validate.mjs --strict` (después) | 220 specs, 0 errores, 0 avisos |
| `node scripts/spec-validate.mjs --strict --base-ref origin/main` (`origin/main` = `86c0be5…`) | 0 errores, 0 avisos |
| `node scripts/spec-index.mjs` / `--check` | 220 filas, validado |
| `node scripts/audit-plan-spec-coverage.mjs` | Missing 0, Extra 0, Errors 0 |
| `node --test tests/unit/spec-lib.test.mjs tests/unit/spec-validate.test.mjs tests/unit/spec-index.test.mjs tests/unit/audit-plan-spec-coverage.test.mjs` | 29 pruebas, 29 pass, 0 fail (pruebas de los validadores documentales, no del producto) |
| `git diff --cached --check` | sin errores de whitespace |

**No ejecutado (por gate DRAFT e instrucción del owner):** pruebas unitarias/integración/E2E del producto, `pnpm verify:workspace`, CI de GitHub (no se abrió PR para no disparar `ci.yml`), consultas a producción/Railway/BD.

## Estado

**PLAN 3 AÚN ABIERTO.** SDD `DRAFT`; B4-11/B4-12 abiertos; gates de lector, identidad, auditoría, CAS/STALE, Evidence, perfil horario, baseline y CI siguen abiertos o requieren decisión de owners.

---

## Addendum — aprobación de C3-17 (2026-11-21)

- **Decisión de producto aprobada por el dueño (literal):** «Si una conciliación de horas sigue sin resolverse después de 24 horas, SEMSE ajustará el tiempo conciliado al tiempo que estableció la compañía que paga ese trabajo.»
- Registrada en la SDD v0.9 §10.17 (requisitos R-C317-01…08, detalles pendientes P-C317-01…09, gates técnicos y trazabilidad) y en Plan 3 v72 (Drive).
- No cambia `status: DRAFT`, no concede permisos, no autoriza modificar `TimeEntry` ni implementar el ajuste automático.
- Corrección: el corte anterior trató la regla como «diseño pendiente» sin citar que ya existía como C3-17 (Plan 3 §9, borrador del 19-nov).
- Validaciones repetidas sobre la v0.9: estricto 220/0/0; `--base-ref origin/main` 0/0; índice 220; cobertura de planes 0/0/0; 29/29 pruebas de validadores; `git diff --cached --check` limpio.

## Addendum 2 — evidencia para los detalles de C3-17 (2026-11-21)

- SDD v0.10 §10.17.6: hechos de código para P-C317-01…09. `Notification.sentAt` se fija al crear la fila; `readAt` al leer. Sólo `OutboundDelivery` tiene estado de entrega. `Org` y `Worksite` no tienen zona horaria, y Daily Reports usa un desfase fijo enviado por el cliente. Los candidatos para el pagador son `Job.clientOrgId`, `Contract.clientOrgId` y `BusinessEngagement`; ninguno modela un pagador externo sin cuenta.
- Paquete de opciones para el dueño en Drive (`SEMSE_Plan3_Paquete_Decisiones_C3-17_2026-11-21.md`). No decide nada.
- Validaciones: estricto 220/0/0; `--base-ref origin/main` 0/0; índice 220; cobertura de planes 0/0/0; 29/29.

## Addendum 3 — detalles de C3-17 confirmados (2026-11-21)

El dueño confirmó: pagadora = emisor declarado y, si no lo hay, `Job.clientOrgId` (P-07); inicio = creación de la notificación (P-01); 24 h transcurridas entre instantes (P-02); efecto limitado a la base de facturación (P-06). Quedó registrado en la SDD v0.11 §10.17.7 (R-C317-09…12, pruebas T-V09…T-V12 sin ejecutar). Siguen pendientes P-01b, P-03, P-04, P-05, P-08 y P-09. Validaciones: estricto 220/0/0; `--base-ref` 0/0; índice 220; cobertura 0/0/0; 29/29.

## Addendum 4 — seis reglas operativas de C3-17 aprobadas (2026-11-21)

El dueño aprobó seis reglas: inicio con la constancia de notificación al usuario; contenido y registro de la constancia; «sin resolver» como ausencia de decisión autorizada; nuevo plazo ante un cambio material del parte; ajuste de la base de facturación hacia arriba o hacia abajo sin tocar `TimeEntry`; y reapertura por persona autorizada o por supervisor con delegación. Todas aplican sólo con el mismo Job y un alcance verificable. Quedaron en la SDD v0.12 §10.17.8 (R-C317-13…18, pruebas T-V13…T-V18 sin ejecutar, gates técnicos y de autorización). Queda un residual: P-C317-01c (alcances con varios usuarios). Validaciones: estricto 220/0/0; `--base-ref` 0/0; índice 220; cobertura 0/0/0; 29/29.

## Addendum 5 — precisiones derivadas de C3-17 (2026-11-21)

- **R-C317-19 (precisión A):** un parte agregado sin desglose no se atribuye ni se reparte entre trabajadores. Con desglose comparable, cada trabajador recibe su propia notificación y corre su propio plazo. Resuelve el residual P-C317-01c.
- **R-C317-20 (precisión B):** una disputa o devolución no suspende ni reinicia el plazo; sólo resuelve una decisión de persona autorizada. Con un parte ambiguo o un alcance no comparable no hay ajuste.
- Consecuencia registrada: un parte agregado sin desglose no tiene plazo ni ajuste automático y queda pendiente de decisión humana.
- Registradas en la SDD v0.13 §10.17.9, con pruebas T-V19…T-V22 sin ejecutar. Validaciones: estricto 220/0/0; `--base-ref` 0/0; índice 220; cobertura 0/0/0; 29/29.

## Addendum 6 — plan, tareas, checklist y análisis (2026-11-21)

- Nuevos documentos SDD en DRAFT, sin ejecutar nada: `weekly-reconciliation.plan.md`, `.tasks.md`, `.checklist.md` y `.analyze.md`. La SDD pasa a v0.14 y los enlaza.
- El análisis concluye **con gaps**:
  - A-01: un cambio de `TimeEntry` durante el plazo C3-17 no está cubierto por las reglas aprobadas;
  - A-02: `packages/fsm` no existe, pese a la decisión bloqueada de la constitución;
  - A-03: eventos sin catalogar;
  - A-04: `TimeEvidence` sin `tenantId`;
  - A-05: confirmar el Art. III;
  - A-06: confirmar Payment Governance.
- Validaciones: estricto 220/0/0; `--base-ref` 0/0; índice 220; cobertura de planes 0/0/0; 29/29. `spec:coverage` (informativo) lista esta spec sin `related_tests` y como riesgo crítico no verificado, lo cual es correcto.

## Addendum 7 — A-01, A-05, A-06 y A-02 (2026-11-21)

- **A-01, decisión de producto (R-C317-21):** si `TimeEntry` cambia durante el plazo, el cotejo pasa a `STALE` de forma terminal y no se ajusta con él. Hace falta un cotejo nuevo y una nueva notificación válida para que vuelva a correr un plazo.
- **A-05, criterio de producto (R-C317-22):** Evidence es respaldo de la decisión humana, sin efecto automático sobre `TimeEntry` ni sobre la base. Falta la confirmación del owner de Plan 6 (Art. III y custodia).
- **A-06, pendiente del owner de Payments:** la base no emite facturas ni pagos (R-C317-23), pero **no se declara exenta** del Art. IV.
- **A-02, pendiente del owner de arquitectura:** no se elige entre crear `packages/fsm` y enmendar la constitución.
- Pregunta residual: el efecto de un cambio de `TimeEntry` después del ajuste.
- SDD v0.15 §10.17.10 (pruebas T-V23…T-V25 sin ejecutar); plan, tareas, checklist y análisis actualizados. Validaciones: estricto 220/0/0; `--base-ref` 0/0; índice 220; cobertura 0/0/0; 29/29.

## Addendum 8 — G45 como propuesta pendiente; solicitudes a Plan 4 y Labor (2026-11-22)

- Revalidado: `main@86c0be5…`; la rama estaba en `217e2fad…`, limpia, con la SDD v0.15 `DRAFT`.
- **G45** queda registrada **sólo como propuesta pendiente de aprobación** (SDD v0.16 §10.17.11), sin número R-C317. El cotejo con las reglas vigentes encontró una posible contradicción con Plan 3 §9.4 («se requiere nueva revisión» frente a la reapertura opcional). No hay conflicto con C3-09, R-C317-18, R-C317-21 ni R-C317-02/17/20. «Fuente cambiada» necesita un evento que no está catalogado.
- Solicitudes documentadas:
  - al owner de Plan 4, la autoridad efectiva para reabrir: hoy no existe `case.reopen`, y `org:labor:manage` sólo lo tienen CLIENT y OPS_ADMIN;
  - al owner de Labor, el contrato de etapa, concurrencia, idempotencia y auditoría.
- Plan, tareas, checklist y análisis actualizados (A-08…A-10). Validaciones: estricto 220/0/0; `--base-ref` 0/0; índice 220; cobertura 0/0/0; 29/29.

## Addendum 9 — G45 opción (b) aprobada (2026-11-22)

- **Decisión de producto (R-C317-24):** si `TimeEntry` cambia después del ajuste por vencimiento, el resultado se marca como desactualizado y se exige una revisión nueva. La base aplicada se conserva hasta que una persona autorizada la resuelva, sin cambios automáticos en la base ni en `TimeEntry`. Es coherente con Plan 3 §9.4 y sustituye a la propuesta (a).
- Residuales: G45-R1 (cómo se abre la revisión exigida) y G45-R2 (si su cotejo tiene un plazo C3-17).
- Gates técnicos de estados, permisos, auditoría y concurrencia: pendientes. SDD v0.17 §10.17.12, pruebas T-V26…T-V29 sin ejecutar. Validaciones: estricto 220/0/0; `--base-ref` 0/0; índice 220; cobertura 0/0/0; 29/29.

## Addendum 10 — G45-R1 y G45-R2 aprobadas; revalidación de `main` (2026-11-22/23)

- **Decisiones de producto:**
  - R-C317-25 (G45-R1): la revisión exigida la inicia una persona autorizada; SEMSE no crea la etapa de forma automática.
  - R-C317-26 (G45-R2): esa revisión no tiene plazo automático ni ajuste por vencimiento.
- Consecuencia registrada: un resultado desactualizado puede quedarse así mientras nadie lo revise; no hay recordatorios definidos.
- `origin/main` avanzó a `dbf64b7…` (#1054). No toca Labor, TimeEntry, auditoría, autenticación ni esquema. Sí aprueba `core.crew-supervisor-delegations` (código `NOT_STARTED`), candidata a fuente de la delegación para G46, aunque no define acciones de conciliación y su OPEN-SUP-04 sigue abierto.
- SDD v0.18 §10.17.13, pruebas T-V30 y T-V31 sin ejecutar. Validaciones: estricto 220/0/0; `--base-ref origin/main` (`dbf64b7…`) 0/0; índice 220; cobertura 0/0/0; 29/29.

## Addendum 11 — OPEN-SUP-04 (horas): decisión del responsable del producto (2026-11-23)

- **Inspeccionado antes de editar:**
  - `core.crew-supervisor-delegations` (APPROVED v0.2, código `NOT_STARTED`), con su plan, tareas y checklist;
  - la propuesta no ratificada `2026-10-22_p02-p06-supervisor-decision-proposals.md`;
  - `core.labor-policy` (BO-08) y `packages/auth/src/rbac.ts` (blob `d344c29b…`);
  - la decisión de Plan 3 del 17-11 y C3-04.
- **Registrado:** spec de delegaciones v0.3 §3.1. Incluye las cinco reglas, la matriz por actor y los tres estados (propuesta, corrección enviada, aprobación final para pago).
  - Los permisos candidatos `crew:time:read` y `crew:time:correct` se marcan como **no existentes**.
  - Se añaden seis pruebas previstas, sin ejecutar.
- **Estado de OPEN-SUP-04:** **parcialmente resuelto.** La parte «horas» está decidida como producto. «Materiales» y «reasignación fuera de crew» siguen abiertos. Nada está implementado y `code_status` sigue en `NOT_STARTED`.
- **Conflictos documentados sin resolver**, cada uno con la decisión concreta que falta:
  - **K1:** la corrección enviada por el supervisor frente a la regla del 17-11 y C3-04 («el supervisor verifica y recomienda; el responsable decide»).
  - **K2:** quién revisa la propuesta del trabajador.
  - **K3:** `org:labor:manage` lo tiene cualquier CLIENT u OPS_ADMIN, no sólo «el dueño»; no hay fuente canónica de dueño; falta el papel de OPS_ADMIN.
  - **K4:** el ámbito de «dueño de la empresa» frente a «dueño del trabajo» y su relación con C3-17.
  - **K5:** el supervisor que corrige sus propias horas.
  - **K6:** la aprobación para pago y Payment Governance (A-06); no existe un estado «aprobado».
- **Documentos actualizados:**
  - delegaciones: plan, tareas (DOC-07 `[~]`) y checklist;
  - nota de referencia cruzada en `core.labor-policy`, sin cambiar sus reglas;
  - SDD de conciliación v0.19 §10.17.14, con su plan de tareas (T-009f), checklist y análisis.
- **Mientras K1 no se decida**, las reglas vigentes de Plan 3 siguen siendo la referencia para la conciliación. G46 sigue abierto.
- **`origin/main`** avanzó a `dcf1e12…` (#1154): sólo toca `AgentRun`, sin efecto en estas rutas.
- **Validaciones:** estricto 220/0/0; `--base-ref origin/main` 0/0; índice 220; cobertura 0/0/0.

## Addendum 12 — Respuestas del propietario a K1–K6; aclaración de fechas y de Drive (2026-11-23 UTC)

- **Decididos** (dirección del propietario):
  - **K1:** la corrección enviada por el supervisor no cambia `TimeEntry` y queda pendiente de decisión. Se mantienen la decisión del 17-11 y C3-04, sin enmienda.
  - **K2:** ante una propuesta, el supervisor revisa y recomienda; el responsable decide.
  - **K5:** nadie revisa ni decide lo suyo; el supervisor sobre sus propias horas sólo propone como trabajador.
- **Abiertos:**
  - **K3:** `org:labor:manage` no equivale a dueño.
  - **K4:** no hay regla de aprobación única ni doble; C3-17 no la resuelve.
  - **K6:** no hay estado «aprobado para pago»; A-06 pendiente.
- **Siguen abiertos:** materiales, reasignación fuera de crew, G46, G47, A-02…A-06 y los gates técnicos.
- **Registrado como pendiente de aprobación:** EF-SUP-01, la incorporación formal de §3.1 a la spec `APPROVED` de delegaciones (añadida después de la aprobación del 2026-11-20).
- **Documentos:**
  - delegaciones v0.4: §3.1, pruebas previstas, §12, plan, tareas (DOC-07b) y checklist;
  - nota en `core.labor-policy`;
  - SDD v0.20 §10.17.14, con sus tareas (T-009f `[~]`), checklist y análisis.
- **Fechas:** todas las fechas de este reporte y de las specs son fechas **UTC del entorno**.
  - Reloj del contenedor: `2026-11-23T02:09Z`, zona `Etc/UTC`.
  - Commits `dd0f5f4`/`44142dd`: `2026-11-23T01:46:51Z`.
  - Archivos de Drive del Addendum 11: `createdTime` entre `2026-11-23T01:48:19Z` y `01:48:24Z`.
  - En husos al oeste de UTC (p. ej. UTC−5) ese instante corresponde a la tarde del **2026-11-22**. Por eso la fecha de revisión del propietario (2026-11-22) y la de los archivos (2026-11-23) difieren sin contradecirse. No se renombraron archivos.
- **Drive, evidencia real del Addendum 11:**
  - Existencia: los cinco archivos están en la carpeta `1y8A3OiXv9EHGxrJkhQ1pu1Jbnc3BFE_3`, uno por título, sin duplicados; se comprobó con una nueva consulta del 2026-11-23.
  - **Sólo el registro** OPEN-SUP-04 se descargó y cotejó por SHA-256 (`2d25d6d8…`).
  - Los otros cuatro (matriz, delegaciones v0.3, SDD v0.19 y Plan 3 v81) se comprobaron **sólo por tamaño** en bytes.

## Addendum 13 — Ratificación de OPEN-SUP-04 y decisiones de navegación de Plan 7 (2026-11-22 America/Chicago · 2026-11-23 UTC)

- **Fuente:** mensaje del propietario en esta conversación.
- **OPEN-SUP-04, ratificado sin cambios de contenido:**
  - K1 y K2 se mantienen como están aprobados en Plan 3: el supervisor verifica y recomienda, y una corrección enviada no modifica por sí sola el `TimeEntry` oficial; queda pendiente de la decisión del responsable.
  - K5: nadie revisa ni decide su propia corrección.
  - No hizo falta tocar la spec de delegaciones (v0.4) ni la SDD (v0.20): ya lo recogían.
- **Siguen pendientes de respuesta del propietario:** K3, K4, K6, materiales y reasignación fuera de crew.
- **Plan 7 (navegación):** se registraron siete decisiones, N7-01…N7-07, en una versión nueva del documento maestro de Plan 7 en Drive (§74), sin modificar el original. Ninguna spec del repositorio cubre esa navegación, así que aquí sólo queda esta referencia.
  - Time Tracker y Time Entry son páginas separadas.
  - Un carrusel único: Resumen, Jornadas, Conciliar, Evidencias, y el resto por desplazamiento horizontal, sin «Más».
  - Resumen general es la página inicial y está separado de Conciliar.
  - Las secciones pueden tener resúmenes contextuales, sin mezclarse con el Resumen general.
- **Sustituidas sin borrarse:** la propuesta provisional de dos niveles (D7-10) y la agrupación «Más».
- **Preguntas abiertas de Plan 7:** Q7-01…Q7-07.
- **Sin cambios técnicos:** sólo cambia este reporte. Sin código, permisos, datos, configuración, producción, despliegue, PR ni pagos.
