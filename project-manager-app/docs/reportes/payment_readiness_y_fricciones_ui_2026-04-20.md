# Payment Readiness y Fricciones UI

- Fecha: 2026-04-20
- Proyecto: `semseproject` / `project-manager-app`
- Estado: parcial fuerte

## Qué ya existía

- Pantalla cliente de pagos con selector de job, fondeo de escrow y liberación de milestone.
- Backend de pagos y contratos ya operativo.
- E2E de pagos previamente verde en un bucle anterior.

## Qué se hizo ahora

### 1. Backend real de payment readiness

Se agregó endpoint nuevo:

- `GET /v1/jobs/:jobId/payment-readiness`

Fuente:

- `apps/api/src/modules/payments/payments.controller.ts`
- `apps/api/src/modules/payments/payments.service.ts`
- `apps/api/src/modules/payments/payments.module.ts`

Checks que devuelve:

- `acceptedReservation`
- `projectLinked`
- `activeContract`
- `signedClient`
- `signedProfessional`
- `ready`
- `reasons[]`

La verdad ya no vive en la UI. Vive en backend.

### 2. BFF y fetcher web

Se agregó:

- `apps/web/app/api/semse/jobs/[jobId]/payment-readiness/route.ts`
- `fetchJobPaymentReadiness(jobId)` en `apps/web/app/semse-api.ts`

### 3. UX cliente más explícita

En `apps/web/app/(app)/client/payments/page.tsx`:

- la tarjeta de precondiciones ahora usa `payment-readiness` real
- muestra razones exactas del bloqueo
- separa carga de jobs vs carga de detalles
- ya no bloquea selector y botón por esperar detalles de otros jobs
- muestra:
  - reserva aceptada
  - proyecto operativo
  - contrato activo
  - firma cliente
  - firma profesional

## Validación

### TypeScript

- `apps/api`: sin errores
- `apps/web`: sin errores

### Validación directa de API fresca

Se reconstruyó API y se levantó un proceso nuevo en `127.0.0.1:4121`.

Caso probado:

- crear job fresco
- consultar `payment-readiness`

Respuesta real obtenida:

- `ready: false`
- `acceptedReservation: false`
- `projectLinked: false`
- `activeContract: false`
- `signedClient: false`
- `signedProfessional: false`

Razones reales:

- falta reserva aceptada
- no existe proyecto operativo enlazado
- falta contrato activo

Esto confirma que el endpoint nuevo devuelve exactamente el bloqueo operativo esperado.

### Playwright

Spec:

- `tests/e2e-semse/payments-flow.spec.js`

Resultado actual:

- `profesional guarda metodo de cobro y queda persistido` ✅
- `cliente fondea escrow y libera milestone desde pagos` ⚠️ inestable en dev

Falla actual:

- timeout en `page.goto("/client/payments")` o durante carga completa de la ruta en entorno dev
- ya no falla por reglas de negocio de readiness
- ahora el dolor está en estabilidad/cold-start de la ruta web durante E2E dev

## Fricción real detectada

No era solo tema de negocio. También había fricción de UX:

- la pantalla bloqueaba selector mientras cargaba detalles de otros jobs
- eso hacía parecer rota la vista aunque el job ya existiera

Se mitigó separando:

- `jobsLoading`
- `loading` de detalles

## Riesgo que sigue vivo

El flujo cliente en Playwright sigue siendo frágil en entorno dev por latencia/cold compile de la ruta `/client/payments`.

No parece bug del dominio de pagos.
Parece problema de estabilidad del entorno web dev para E2E.

## Siguiente plan recomendado

1. Hacer que el E2E de pagos corra contra web en modo más estable

- prewarm de `/client/payments`
- o usar build/start en vez de dev para esa spec

2. Reducir todavía más trabajo inicial de la pantalla

- primero cargar jobs
- luego lazy-load de pagos/readiness del job seleccionado
- no traer detalles de varios jobs al inicio

3. Subir un nivel más la ayuda al usuario

- backend puede devolver `nextAction`
- ejemplos:
  - `accept_reservation`
  - `generate_contract`
  - `sign_client`
  - `sign_professional`
  - `fund_escrow`

4. Mostrar CTA exacto por rol

- cliente: “Firmar contrato” o “Fondear escrow”
- profesional: “Firmar contrato”
- ops: “Revisar por qué no existe proyecto”

## Resumen bruto

golpe bueno:

- backend de readiness ya existe
- UI ya no adivina
- bloqueo de negocio ya se explica claro

espina viva:

- E2E cliente en dev sigue frágil por carga de ruta, no por lógica de pagos
