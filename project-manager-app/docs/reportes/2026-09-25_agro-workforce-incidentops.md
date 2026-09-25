# Reporte de sesión — Consolidación Semse Agro: Workforce + IncidentOps + Prometeo Agro

Fecha: 2026-09-25 · Rama: `claude/semse-agro-consolidation-c23tpv` · PR #675 (draft)

## Qué se hizo

1. **Auditoría AS-IS** (`docs/specs/agro/AGRO_AS_IS_AUDIT_2026-09-25.md`): modelos, API, web, integraciones, relaciones rotas (R1–R9), duplicaciones con Core, gap matrix, arquitectura y plan de migración.
2. **Fixes**: R1 (tipos de tarea de reproducción), R2 (tipos de unidad de infraestructura), R3/R4 (rutas de tools de Prometeo), R7 (WORKER sin permisos Agro).
3. **PR1 Workforce**: membresía de finca, taxonomía sembrada (13 oficios, 14 especialidades, 16 capacidades jerárquicas), capacidades por persona, verificación que solo añade registros, con evidencia y auditoría atómica.
4. **PR2 IncidentOps**: `AgroIncident` con FSM, severidad sugerida o confirmada, relaciones validadas, `AgroTaskRef` (AgroFarmTask | JobTask), historial sobre `AgroAuditEvent`, idempotencia offline.
5. **PR4 Prometeo Agro**: intake determinista y local (buscar → relacionar → completar → crear) + 3 tools, con `create_incident` sujeta a confirmación.
6. **PR3 UI**: Incident Center, detalle con historial, reporte móvil con Prometeo, matriz de equipo y perfil Agro con verificación.

## Verificación

| Verificación | Resultado |
|---|---|
| `prisma validate` + `migrate deploy` (Postgres 16 local) + `migrate diff` sin drift | OK |
| `pnpm --filter @semse/api build` | OK |
| `tsc --noEmit` web, eslint de los archivos tocados (API y web) | OK |
| Tests nuevos: política 12, workforce 26, incidencias 20, intake 11 | 69/69 |
| Suites Agro + Prometeo existentes | sin regresiones |
| E2E HTTP contra Postgres real (10 pasos del brief) | OK; una mutación de control hace fallar el test, así que las aserciones se ejecutan de verdad |
| Navegador (Playwright 390px): trabajador reporta → supervisor clasifica y asigna → veterinaria evalúa → trabajador resuelve → supervisor cierra; capacidades declaradas y verificadas; un trabajador no ve perfiles ajenos | OK |
| `pnpm spec:validate:strict` | 0 errores |

## Estado de entrega (SDD 2.0)

Código COMPLETE · CI sin ejecutar · sin merge · sin deploy · activación INACTIVE · migración PENDING en Railway.

## Pendiente (no se declara hecho)

- Servicios Agro existentes siguen siendo solo del propietario (T-050): los trabajadores miembros aún no completan tareas desde `/tasks`.
- Dual-write/backfill AgroFarmTask → JobTask (T-051).
- Eventos `agro.*` en EVENT_CATALOG (T-052). No se inventaron nombres de eventos.
- Subida binaria de evidencia Agro (hoy se guarda la URL o una nota) (T-053).
- ASR/visión para el intake (T-054). Pantallas nativas en `apps/mobile` (T-055).
- R8: los controllers Agro existentes devuelven 500 ante un body inválido.
