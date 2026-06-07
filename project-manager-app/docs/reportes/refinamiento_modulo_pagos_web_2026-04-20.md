# Refinamiento Módulo Pagos Web

- Fecha: 2026-04-20
- Frente: `project-manager-app`
- Estado: refinado y compilando

## Qué ya había

- pantallas de pagos para:
  - cliente
  - worker
  - admin finanzas
  - admin reportes
- modal de fondeo de escrow
- formulario de método de cobro
- BFF para fondeo y release de escrow
- fetchers en `apps/web/app/semse-api.ts`

## Huecos encontrados

1. cliente:
- selector de proyecto servía para fondear, pero no filtraba la vista
- el bloque de “aprobar y liberar” usaba estados equivocados
- intentaba liberar milestones que backend todavía no veía como `APPROVED`

2. worker:
- método de cobro se guardaba, pero no cargaba método actual
- el BFF de payout podía romper por ruta/import incorrecto
- no había protección razonable si backend real de payout no existía

3. admin:
- finanzas todavía arrastraba import muerto
- reportes mezclaban métricas reales con métricas decorativas

## Qué se corrigió

### Cliente pagos
- el filtro por proyecto ahora sí afecta:
  - transacciones
  - stats
  - milestones pendientes
- se corrigió la lógica de milestones:
  - reconoce `SUBMITTED`
  - reconoce `AWAITING_REVIEW`
  - reconoce `APPROVED`
- el botón ahora hace flujo real:
  - aprueba milestone si todavía no está aprobado
  - luego libera escrow
- errores de approve/release ya no se tragan en silencio

### Worker pagos
- se agregó carga del método de cobro actual desde BFF
- `PayoutMethodForm` ahora expone tipo reutilizable
- el panel de cobro rehidrata estado actual al abrirse

### Payout method BFF
- se corrigió import de `_server`
- GET cae limpio a `null` si endpoint real no existe
- POST cae limpio a mock success si endpoint real no existe

### PayoutMethodForm
- ahora valida y también respeta errores HTTP reales
- ya no “guarda” falsamente si backend responde mal

### Admin
- `admin/finance` quedó sin import muerto
- `admin/reports` ahora usa datos más honestos:
  - trabajos totales
  - volumen escrow
  - disputas abiertas
  - trabajos en curso
  - runs de agentes

## Verificación

- `npx tsc --project apps/web/tsconfig.json --noEmit` ✅
- `npx tsc --project apps/api/tsconfig.json --noEmit` ✅

## Lo que todavía falta

1. payout method:
- el backend real `/v1/workers/me/payout-method` todavía no está confirmado como implementado
- hoy la UI degrada bien, pero parte del flujo sigue mockeado

2. reportes admin:
- export CSV sigue visual
- la tarjeta expandida aún no consume `/v1/admin/reports/{selected}`

3. finanzas admin:
- conviene migrar de lectura por transacciones a resumen real de escrow por job/proyecto

4. pagos cliente:
- si el usuario filtra por proyecto, el CTA de “fondear escrow” funciona bien
- falta validar el flujo real con datos vivos y contrato firmado en todos los estados

## Siguiente paso recomendado

1. implementar backend real de payout method para worker
2. conectar export/report detail en admin reports
3. probar punta a punta:
- contrato firmado
- fondeo de escrow
- milestone enviado
- approve + release
- worker viendo pago liberado
