# OCR de Recibos + PDF Facturas + SSE Finance

Fecha: 2026-04-28
Estado: **build:api EXIT:0 | WEB TS: 0 errores | tests: 133/133 | Smokes OK**

## Qué se construyó

### 1. OCR de Recibos con Prometeo (Claude)

`apps/api/src/modules/finance/receipt-ocr.service.ts`

- `POST /v1/finance/expenses/scan` — extrae datos de recibo con Claude (taskType: `receipt_ocr`)
- Extrae: vendor, amount, currency, date, category, description, taxAmount, paymentMethod, receiptNumber, lineItems, confidence
- Detecta categoría SEMSE automáticamente (materials, labor, tools, transport, etc.)
- Parsea JSON del LLM con fallback a extracción por regex
- Nivel de confianza: high / medium / low

Smoke real:
```txt
Input: Home Depot, Folio 123456, Cable 12 AWG + Breaker 20A, Total $730.80, Tarjeta
→ vendor: Home Depot
→ amount: 730.8
→ category: materials
→ confidence: high
→ paymentMethod: tarjeta terminada en 4521
→ lineItems: 2 items
```

### 2. Escaneo en UI — Finance Hub

Modal "Escanear recibo con IA" en `/client/finance`:
- Textarea para pegar texto del recibo
- Campo URL de imagen/PDF
- Botón "Extraer datos" → llama OCR
- Muestra datos extraídos con badge de confianza coloreado
- Botón "Guardar como gasto" → crea el gasto pre-llenado

### 3. PDF / Vista de Factura

`apps/web/app/(app)/client/finance/invoices/[id]/page.tsx`

- Página de detalle de factura con diseño profesional
- Tabla de line items con subtotales, IVA y total
- Badge de status, fecha de vencimiento con alerta si vencida
- Botones contextuales: Enviar / Marcar pagada
- Botón "Imprimir / PDF" → `window.print()` con CSS `@media print`
- Link desde lista de facturas al detalle (número de factura clickeable)

### 4. SSE Finance Notifications

`/v1/sse/finance` endpoint + BFF `/api/semse/finance/stream`

Finance Hub escucha `EventSource /api/semse/finance/stream`:
- Al detectar `invoice-overdue` → toast rojo en bottom-right
- Toast muestra número de factura + monto + botón cerrar
- Máximo 3 toasts simultáneos (sliding window)
- Al recibir evento → también refresca la lista de facturas

### 5. Módulo circular resuelto

`AiModelsModule` y `FinanceModule` tienen dependencia bidireccional:
- `AiModelsModule` → `FinanceModule` (para `FinanceService` en `OperationalContextService`)
- `FinanceModule` → `AiModelsModule` (para `AiModelGatewayService` en `ReceiptOcrService`)
- Resuelto con `forwardRef` en ambos módulos + `@Inject(forwardRef(() => FinanceService))` en `OperationalContextService`

## Archivos nuevos

- `apps/api/src/modules/finance/receipt-ocr.service.ts`
- `apps/web/app/api/semse/finance/expenses/scan/route.ts`
- `apps/web/app/api/semse/finance/stream/route.ts`
- `apps/web/app/(app)/client/finance/invoices/[id]/page.tsx`

## Archivos modificados clave

- `apps/api/src/modules/finance/finance.module.ts` — forwardRef + ReceiptOcrService
- `apps/api/src/modules/finance/finance.controller.ts` — endpoint /scan
- `apps/api/src/modules/ai-models/ai-models.module.ts` — forwardRef
- `apps/api/src/modules/ai-models/context/operational-context.service.ts` — forwardRef inject
- `apps/api/src/modules/ai-models/types/ai-task.types.ts` — receipt_ocr, invoice_generation
- `apps/web/app/(app)/client/finance/page.tsx` — scan modal + SSE toasts + link a detalle

## Estado final

- `build:api EXIT:0`
- `WEB TS: 0 errores`
- `tests: 133/133`
- OCR smoke: vendor/amount/category/confidence OK con Claude
- API arranca sin errores con forwardRef
