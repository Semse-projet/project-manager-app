# Finance & Document Tools — Bloque B

Fecha: 2026-04-28
Estado: **build:api EXIT:0 | WEB TS: 0 errores | tests: 133/133 | Smokes API OK**

## Qué se construyó

### Prisma — 3 modelos nuevos

- **`Invoice`** — facturas profesionales con line items, status lifecycle, vencimiento, PDF URL.
- **`ProjectExpense`** — gastos de proyecto con categoría, recibo, estado de aprobación, detección de duplicados.
- **`DocumentTemplate`** — plantillas reutilizables para facturas, cotizaciones, contratos, reportes, checklists.

Relaciones: `Tenant → Invoice[]`, `Tenant → ProjectExpense[]`, `Tenant → DocumentTemplate[]`, `Invoice → ProjectExpense[]`.

### API — FinanceModule (NestJS)

`apps/api/src/modules/finance/`

- **`FinanceRepository`** — CRUD completo de los 3 modelos + resumen financiero real por proyecto.
- **`FinanceService`** — lógica: numeración automática (`INV-XXXX`), cálculo de totales con IVA, detección de duplicados (mismo monto+proveedor en 7 días), bloque de contexto para Prometeo.
- **`FinanceController`** — 14 endpoints bajo `/v1/finance/`:

| Endpoint | Descripción |
|----------|-------------|
| `GET /invoices` | Lista facturas por tenant/org/proyecto/status |
| `POST /invoices` | Crea factura con line items y cálculo automático |
| `GET /invoices/:id` | Detalle |
| `PATCH /invoices/:id` | Actualizar |
| `POST /invoices/:id/send` | draft → sent |
| `POST /invoices/:id/pay` | → paid |
| `POST /invoices/:id/viewed` | → viewed |
| `GET /expenses` | Lista gastos filtrable |
| `POST /expenses` | Registra gasto + detección duplicado |
| `GET /expenses/:id` | Detalle |
| `POST /expenses/:id/approve` | Aprueba gasto |
| `POST /expenses/:id/reject` | Rechaza gasto |
| `GET /templates` | Lista plantillas |
| `POST /templates` | Crea plantilla |
| `GET /projects/:id/summary` | Resumen financiero real |
| `GET /projects/:id/summary/context` | Bloque de texto para Prometeo |

### RBAC — permisos `finance:read` y `finance:write`

Agregados a: `CLIENT`, `PRO`, `OPS_ADMIN`.

### BFF Routes (Next.js)

- `apps/web/app/api/semse/finance/invoices/route.ts` — GET/POST
- `apps/web/app/api/semse/finance/invoices/[id]/route.ts` — GET/PATCH
- `apps/web/app/api/semse/finance/invoices/[id]/send/route.ts` — POST
- `apps/web/app/api/semse/finance/invoices/[id]/pay/route.ts` — POST
- `apps/web/app/api/semse/finance/expenses/route.ts` — GET/POST
- `apps/web/app/api/semse/finance/expenses/[id]/approve/route.ts` — POST
- `apps/web/app/api/semse/finance/expenses/[id]/reject/route.ts` — POST
- `apps/web/app/api/semse/finance/templates/route.ts` — GET/POST
- `apps/web/app/api/semse/finance/projects/[projectId]/summary/route.ts` — GET

### Tipos y fetchers en semse-api.ts

`Invoice`, `ProjectExpense`, `DocumentTemplate`, `ProjectFinancialSummary` + fetchers:
`fetchInvoices`, `createInvoice`, `sendInvoice`, `markInvoicePaid`, `fetchExpenses`, `createExpense`, `approveExpense`, `rejectExpense`, `fetchTemplates`, `fetchProjectFinancialSummary`.

### UI — Finance Hub (`/client/finance`)

`apps/web/app/(app)/client/finance/page.tsx`

- KPIs: total facturado, cobrado, por cobrar, total gastos.
- Lista de facturas con badge de status y acciones rápidas (Enviar / Marcar pagada).
- Lista de gastos con badge + acciones (Aprobar / Rechazar).
- Modal crear factura: título, line items dinámicos, vencimiento, IVA por línea, cálculo automático.
- Modal registrar gasto: descripción, monto, categoría, proveedor, URL recibo.
- Link en nav de cliente: "Finance Hub".

## Smokes verificados (API directa)

```txt
POST /v1/finance/invoices → INV-0001, status=draft, total=2378
POST /v1/finance/invoices/:id/send → status=sent, sentAt OK
POST /v1/finance/expenses → category=materials, status=pending
GET /v1/finance/projects/proj_demo_001/summary:
  totalInvoiced=2378, totalExpenses=850, margin=64.26%
  expensesByCategory: { materials: 850 }
```

## Estado

- `build:api EXIT:0`
- `WEB TS: 0 errores`
- `tests: 133/133`

## Próximas extensiones naturales

- OCR de recibos (Prometeo RAG sobre documento escaneado)
- Export PDF de facturas (puppeteer o @react-pdf)
- Portal de cliente con enlace de pago
- Notificaciones de vencimiento de facturas (SSE)
- Finance Hub en admin con vista cross-org
