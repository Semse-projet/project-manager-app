# SEMSE Governance System

Sistema de control, etiquetado y destilación del ecosistema SEMSE.

## Lectura mínima para agentes

Antes de trabajar en cualquier componente del ecosistema, lee:

1. `status/ECOSYSTEM_STATUS.md`
2. `protocol/AGENT_PROTOCOL.md`
3. `distillation/DISTILLATION_QUEUE.md`
4. el `STATUS.md` del componente específico cuando aplique

## Regla de oro

Solo modificas el canónico (`project-manager-app`). Los satellites son fuente de referencia o destilación. No deben volver a crecer como centros autónomos.

## Estructura actual

### `protocol/`

- `AGENT_PROTOCOL.md`

Normas de operación para agentes y sesiones de trabajo.

### `status/`

- `ECOSYSTEM_STATUS.md`

Estado maestro del ecosistema y de sus cuellos de botella.

### `distillation/`

- `DISTILLATION_QUEUE.md`
- `DISTILLATION_LOG.md`
- `DISTILLATION_CLAUDE_CODE_INSIGHTS.md`

Cola, historial e insights de destilación desde satellites o fuentes externas.

### `logs/`

- `WORK_SESSION_LOG.md`

Bitácora cronológica de sesiones de trabajo.

### `reports/`

Reportes periódicos generados para salud del ecosistema.

### `archive/`

Residuos históricos o artefactos archivados que ya no deben gobernar trabajo actual.

## Script de salud periódico

```bash
node scripts/semse-health-check.mjs
```

Genera un reporte en `_governance/reports/YYYY-MM-DD_health.md`.
