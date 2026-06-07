# Business Continuity Plan (Overview)

## Objetivo

Mantener continuidad operativa de SEMSE ante perdida parcial de datos, corrupcion de runtime,
incidente de infraestructura o necesidad de reconstruccion narrativa de actividad agentic.

Este BCP cubre continuidad de negocio. No reemplaza monitoreo, seguridad ni incident response.

## Objetivos iniciales

- RTO: 4h
- RPO: 15m
- Restore drill: mensual
- Evidencia minima: snapshot usado, responsable, hora de inicio, hora de fin, resultado y brechas

## Controles minimos

- Backup diario full + WAL continuo para Postgres.
- Versionado de evidencia en storage.
- Restore drill mensual documentado.
- Runbook de incidentes para pagos, evidencias, auth y operacion asistida.
- Verificacion local de documentos BCP con `npm run verify:operacion-asistida:bcp`.

## Capas cubiertas

| Capa | Fuente primaria | Recuperacion |
|---|---|---|
| Datos transaccionales | Postgres / Prisma | backup full + WAL |
| Evidencia de negocio | storage versionado | restore por objeto/version |
| Auditoria | `AuditLog` y eventos de dominio | reconstruccion narrativa |
| Runtime agentic | `AgentRun` + traces Ops | replay controlado o cierre manual |
| Operacion asistida | `operatorContext` + `workspace_memory` | restore de DB + validacion de trazabilidad |

## Runbooks canonicos

- `docs/bcp/OPERACION_ASISTIDA_BACKUP_RECOVERY_RUNBOOK.md`
- `docs/bcp/OPERACION_ASISTIDA_RECOVERY_CHECKLIST.md`

## Regla operativa

`backup_recovery` no es runtime activo. Es una capa de continuidad:

- puede conservar copias, reportes y evidencia de restauracion;
- no debe ser fuente primaria de ejecucion;
- debe permitir reconstruir decisiones, operadores, runs y memoria contextual sin depender de caches.
