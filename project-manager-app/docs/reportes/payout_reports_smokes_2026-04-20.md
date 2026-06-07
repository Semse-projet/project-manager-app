# Payout, Reportes Admin y Smokes de Pagos

- Fecha: 2026-04-20
- Frente: `project-manager-app`
- Estado: backend payout real activo, reportes admin conectados, flujo de pagos validado

## Qué ya existía

- módulo de pagos backend con:
  - fondeo de escrow
  - release de milestone
  - listados por job
- pantallas web de:
  - pagos cliente
  - pagos worker
  - finanzas admin
  - reportes admin
- BFF web para jobs/escrow/milestones
- smokes:
  - `smoke:escrow-contract`
  - `smoke:milestones`

## Qué faltaba de verdad

1. `workers/me/payout-method`
- el BFF existía, pero el backend real no
- el formulario guardaba, pero no había persistencia real detrás

2. reportes admin
- tenían métricas parciales
- la vista expandida era placeholder
- export CSV era solo botón bonito

3. validación punta a punta
- el smoke de escrow estaba desalineado con el contrato visible actual
- también estaba desalineado con reglas reales de negocio:
  - evidencia obligatoria antes de submit
  - tipo visible `FUND/RELEASE`

## Qué se implementó

### 1. Backend real de payout method

Ruta nueva real en API:
- `GET /v1/workers/me/payout-method`
- `POST /v1/workers/me/payout-method`

Decisión técnica:
- sin migración pesada
- persistencia usando `workspaceMemory`
- workspace por usuario:
  - `worker:{userId}:payments`
- guardado saneado:
  - tipo
  - label
  - bankName
  - last4
  - email
  - verified
- no se guardan routing/account completos

Además:
- audit log:
  - `worker.payout_method.update`
- BFF web corregido para usar identidad real del request
- fallback limpio cuando el endpoint no existe

### 2. Reportes admin conectados

`admin/reports` ahora:
- construye filas reales para:
  - `ops`
  - `finance`
  - `agents`
  - `users` usando dataset de disputas como fuente operativa actual
- muestra tabla expandida real
- exporta CSV real desde el dataset activo en cliente

Métricas ya conectadas:
- trabajos totales
- volumen escrow
- disputas abiertas
- trabajos en curso
- runs de agentes

### 3. Regla de acceso financiero ajustada

Hallazgo:
- el `PRO` no podía leer `/v1/jobs/:jobId/escrow`
- eso rompía la idea de pagos reales para worker/pro

Cambio:
- `canReadProjectFinancials` ahora permite:
  - `OPS_ADMIN`
  - org cliente
  - org profesional asignado

Esto mantiene ownership real, pero deja de romper el flujo del profesional.

### 4. Smokes alineados al contrato real

`api-escrow-contract-smoke.mjs` fue corregido para reflejar negocio actual:
- tipo visible:
  - `FUND`
  - `RELEASE`
- agrega evidencia antes de `submit`

## Validaciones ejecutadas

### TypeScript
- `apps/api` ✅
- `apps/web` ✅

### Build
- `build:api` ✅

### Smokes
- `smoke:milestones` ✅
- `smoke:escrow-contract` ✅

### Verificación directa del payout method

POST real:
- `POST /v1/workers/me/payout-method`
- guardó:
  - `type=paypal`
  - `email=worker@example.com`

GET real:
- `GET /v1/workers/me/payout-method`
- devolvió el método persistido correctamente

## Archivos tocados

Backend:
- `apps/api/src/modules/payments/payments.controller.ts`
- `apps/api/src/modules/payments/payments.service.ts`
- `apps/api/src/modules/projects/projects.policy.ts`
- `apps/api/src/modules/knowledge/workspace-memory.business-records.ts`

Web:
- `apps/web/app/api/semse/workers/payout-method/route.ts`
- `apps/web/app/(app)/admin/reports/page.tsx`

Smokes:
- `scripts/api-escrow-contract-smoke.mjs`

## Lectura operativa honesta

- payout method ya no es humo
- reportes admin ya no son puro cartón
- flujo de pagos backend quedó validado:
  - contrato
  - fondeo
  - evidencia
  - submit
  - approve
  - release
- el profesional ya puede leer financials del proyecto asignado

## Lo que sigue

1. conectar worker payments y client payments en e2e web real
2. hacer smoke específico de payout method BFF + UI
3. si quieres más rigor:
  - endpoint backend dedicado para reportes admin
  - en vez de armar datasets solo en cliente
