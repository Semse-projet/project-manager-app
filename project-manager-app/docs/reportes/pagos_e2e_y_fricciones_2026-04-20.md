# Pagos Web E2E y Fricciones Reales

- Fecha: 2026-04-20
- Estado: completado
- Ámbito: `project-manager-app` módulo web pagos cliente/profesional

## Qué ya existía

- UI de pagos cliente en `apps/web/app/(app)/client/payments/page.tsx`
- UI de pagos profesional en `apps/web/app/(app)/worker/payments/page.tsx`
- modal de fondeo escrow
- formulario de payout method
- backend real para payout method
- smokes API de escrow, milestones y contratos ya verdes

## Qué se corrigió en este bloque

### 1. BFF con identidad real en pagos/milestones

Se cambiaron rutas web para usar identidad por request en vez de identidad estática:

- `apps/web/app/api/semse/jobs/[jobId]/escrow/route.ts`
- `apps/web/app/api/semse/milestones/[milestoneId]/[action]/route.ts`
- `apps/web/app/api/semse/milestones/[milestoneId]/release/route.ts`

Esto evita errores por rol al operar approve/release/fund desde sesión real.

### 2. Selectores estables para E2E

Se agregaron `data-testid` en:

- cliente pagos
- profesional pagos
- modal de fondeo
- payout form

Esto quitó fragilidad de pruebas basada en texto/estilos.

### 3. E2E real de pagos

Se creó:

- `tests/e2e-semse/payments-flow.spec.js`

Casos cubiertos:

- cliente crea flujo válido de contrato+escrow+milestone y libera desde UI
- profesional guarda método de cobro y queda persistido

### 4. Reducción de fricción y riesgo de escala en cliente pagos

Problema detectado:

- la pantalla cargaba pagos+milestones de todos los jobs en ráfaga
- con historial grande disparaba `429 Too Many Requests`
- eso rompía:
  - milestones listos para aprobar
  - historial pagado después del release
  - estabilidad del módulo

Corrección aplicada en:

- `apps/web/app/(app)/client/payments/page.tsx`

Cambios:

- carga secuencial por job
- tolerancia a jobs sin pagos
- cuando hay job seleccionado, solo carga ese job
- carga por defecto limitada a jobs recientes

Resultado:

- desaparece la auto-saturación del frontend
- refresh del job seleccionado es mucho más estable

### 5. UX explícita para precondiciones de fondeo

Se convirtió una regla oculta del dominio en señal visible para el cliente.

Archivo:

- `apps/web/app/(app)/client/payments/page.tsx`

Ahora, cuando el cliente selecciona un proyecto, la pantalla muestra:

- si el proyecto está listo para fondear
- si falta contrato activo
- si falta firma del cliente
- si falta firma del profesional

Además:

- el botón `Fondear escrow` se deshabilita si el proyecto seleccionado todavía no cumple precondiciones
- la UI explica que, si no hay contrato activo, normalmente primero debe existir una reserva aceptada y luego generar contrato

Impacto:

- la operación deja de fallar “por sorpresa”
- el cliente entiende por qué no puede pagar todavía
- soporte y ops reciben menos ruido por conflictos `409`

## Fricciones reales encontradas

### 1. Escrow no se puede fondear en job fresco

Hallazgo:

- `POST /v1/jobs/:jobId/escrow/fund` devuelve `409`
- causa real: el dominio exige:
  - reserva aceptada
  - contrato activo
  - contrato firmado por cliente y profesional

Lectura:

- no era bug de test
- era regla real de negocio

### 2. Contrato exige documento canon compartido

Hallazgo:

- segunda firma fallaba si cambiaba `documentHash`
- luego fallaba si cambiaba `pdfUrl`

Lectura:

- el contrato se firma sobre el mismo documento canon por ambas partes

### 3. Carga inicial de pagos no escalaba

Hallazgo:

- muchos jobs históricos generaban ráfagas de lecturas por job
- eso terminaba en `429`

Lectura:

- la pantalla funcionaba con pocos datos
- al crecer operación, se mordía sola

## Validación ejecutada

### TypeScript

- `npx tsc --project apps/web/tsconfig.json --noEmit` ✅

### Playwright real

Comando ejecutado:

- `SEMSE_WEB_BASE_URL=http://127.0.0.1:3000 npx playwright test -c playwright.semse.config.js tests/e2e-semse/payments-flow.spec.js`

Resultado:

- `cliente fondea escrow y libera milestone desde pagos` ✅
- `profesional guarda metodo de cobro y queda persistido` ✅

Resumen final:

- `2 passed`

## Archivos tocados

- `apps/web/app/(app)/client/payments/page.tsx`
- `apps/web/app/(app)/worker/payments/page.tsx`
- `apps/web/app/components/payments/EscrowFundModal.tsx`
- `apps/web/app/components/payments/PayoutMethodForm.tsx`
- `apps/web/app/api/semse/jobs/[jobId]/escrow/route.ts`
- `apps/web/app/api/semse/milestones/[milestoneId]/[action]/route.ts`
- `apps/web/app/api/semse/milestones/[milestoneId]/release/route.ts`
- `tests/e2e-semse/payments-flow.spec.js`

## Siguiente paso recomendado

### Corto plazo

- crear endpoint agregado de pagos por actor para no iterar job por job
- exponer estado de precondiciones desde backend en vez de inferirlo desde contrato actual
- mostrar al cliente por qué no puede pagar si falta:
  - reserva
  - contrato
  - firma cliente
  - firma profesional

### Mediano plazo

- endpoint agregado para reportes admin financieros
- e2e adicional:
  - disputa sobre escrow
  - refund
  - historial del profesional con filtro por job
- quitar dependencia de múltiples BFF por job para construir dashboards
