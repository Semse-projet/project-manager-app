# Plan técnico — Consolidación Semse Agro (Workforce + IncidentOps + Prometeo Agro)

Specs: [agro-workforce](./agro-workforce.spec.md) · [agro-incident-ops](./agro-incident-ops.spec.md) · [agro-prometeo-intake](./agro-prometeo-intake.spec.md) · AS-IS: [AGRO_AS_IS_AUDIT_2026-09-25](./AGRO_AS_IS_AUDIT_2026-09-25.md)

## Decisiones

| Tema | Decisión | Motivo (verificado en código) |
|---|---|---|
| Aislamiento | Finca como límite; `AgroFarmMember` para actores distintos del propietario | `AgroFarm` no tiene `tenantId` ni `orgId`; todo Agro es owner-scoped |
| Autorización | RBAC + `agro-farm-policy.ts` (función pura) | Los roles globales no expresan "capataz" o "veterinario de finca" |
| Auditoría | `AgroAuditEvent` vía `AgroAuditRepository` (con transacción opcional) | `AuditLog.tenantId` es obligatorio; no se crea un tercer sistema |
| Evidencia | `AgroEvidenceItem` (+INCIDENT, WORKER_CAPABILITY, AUDIO, FORM, MEASUREMENT) | `Evidence.projectId` es obligatorio |
| Tareas | `AgroTaskRef {source, id}` + `AgroTaskRefResolver` | La convergencia a `JobTask` sigue pendiente; los módulos nuevos no deben quedar atados a `AgroFarmTask` |
| Incidencias | Modelo nuevo `AgroIncident` | `JobIncident` exige `jobId`; `MissionControlIncident` es postura de IA |
| Prometeo | Motor de reglas local, solo propone | Privacidad por diseño, sin diagnóstico, revisión humana siempre |
| Validación HTTP | `parseWithSchema` en los controllers nuevos | `.parse()` en los controllers existentes produce 500 ante input inválido |

## Fases

1. F0 auditoría → 2. fixes R1–R4 → 3. PR1 Workforce (schema, migración, RBAC, política, servicio, API) → 4. PR2 IncidentOps → 5. PR4 Prometeo intake (backend, lo necesita la UI) → 6. PR3 UI + endpoint de contexto → 7. SDD + reporte.

## Riesgos

- Migración pendiente en Railway: es aditiva, pero requiere `prisma migrate deploy` en el deploy normal.
- Los servicios Agro existentes siguen siendo solo del propietario: un trabajador miembro todavía no puede completar tareas desde `/tasks` (siguiente PR, §7.2 del AS-IS).
- La evidencia por URL no sube binarios: falta integrar el flujo presignado (`semse-upload-flow`) para Agro.
