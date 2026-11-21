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
