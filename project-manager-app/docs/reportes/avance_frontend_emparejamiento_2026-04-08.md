# Avance Frontend Emparejamiento

Fecha: 2026-04-08
Ruta objetivo: `/home/yoni/labsemse/project-manager-app`
Referencia ejecutada: `/home/yoni/labsemse/reportes/prompts/prompt_codex_frontend_emparejamiento_2026-04-07.md`

## Objetivo

Continuar el frente web tomando ese prompt como especificación operativa, reemplazando datos mock por surfaces reales del API y cerrando proxies faltantes.

## Tareas cerradas

### 1. `semse-api.ts`

Archivo actualizado:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/semse-api.ts`

Funciones agregadas:

- `fetchJobPayments(jobId)`
- `fetchJobContract(jobId)`
- `fetchFieldUnits(query?)`
- `fetchFieldWorklogs(query?)`
- `fetchFieldFacts(query?)`
- `fetchFieldVendors()`
- `createFieldWorklog(input)`
- `fetchOrganizations()`
- `fetchOrganization(orgId)`
- `fetchOrganizationMembers(orgId)`
- `fetchOpsAuditLog()`
- `fetchOpsTrustOverview()`
- `fetchOpsRiskScores()`

### 2. Proxies faltantes

Archivos creados:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/ops/audit/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/ops/trust-overview/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/ops/risk-scores/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/organizations/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/organizations/[orgId]/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/organizations/[orgId]/members/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/jobs/[jobId]/payments/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/jobs/[jobId]/contracts/current/route.ts`

Todos quedaron sobre el patrón de `_server.ts`.

### 3. Página nueva `/client/jobs/[jobId]`

Archivo creado:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/client/jobs/[jobId]/page.tsx`

Comportamiento implementado:

- carga paralela de job, milestones, escrow, payments y evidence;
- header con estado, presupuesto, categoría, ubicación, urgencia y deadline;
- panel de escrow con fondeo, holdback y movimientos;
- timeline de milestones con aprobar, pedir cambios y liberar pago;
- grid de evidencias;
- loading y error states.

También se corrigió la navegación de:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/client/jobs/page.tsx`

para que cada card apunte al detalle real del job.

### 4. `/client/milestones`

Archivo actualizado:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/client/milestones/page.tsx`

Cambios:

- se eliminó la fuente mock;
- ahora carga jobs reales;
- para jobs activos obtiene milestones reales;
- agrupa por job;
- permite aprobar y rechazar con recarga posterior;
- mantiene el mismo layout general de grupos y resumen.

### 5. `/client/payments`

Archivo actualizado:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/client/payments/page.tsx`

Cambios:

- se eliminó `TRANSACTIONS` mock;
- ahora consulta jobs reales y luego payments por job;
- concatena y ordena transacciones;
- mantiene el layout de stats, tabs y lista;
- agrega estados de loading y error.

### 6. `/admin/field-ops`

Archivo reescrito:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/admin/field-ops/page.tsx`

Resultado:

- se eliminaron `DEMO_UNITS`, `DEMO_WORKLOGS`, `DEMO_FACTS`, `DEMO_VENDORS`;
- cada tab carga su dataset real de forma independiente;
- counts de tabs y KPIs ahora salen de datos reales;
- se mantuvo el panel de unidades, feed de worklogs, tabla de conocimiento y cards de vendors;
- se preservó el lenguaje visual dark del proyecto.

### 7. `/worker/tracker`

Archivo actualizado:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/worker/tracker/page.tsx`

Cambios:

- jobs del selector ya vienen del API;
- worklogs recientes ya vienen del API;
- el formulario manual guarda por `POST /api/semse/field-ops/worklogs`;
- se mantienen timer, selector y formulario.

## Verificación

Comando ejecutado:

- `npm exec tsc --workspace @semse/web -- --noEmit`

Resultado:

- pasa con `0` errores

## Estado de cierre

El prompt de frontend quedó cubierto en su bloque principal:

- functions en `semse-api.ts`
- proxies faltantes
- detalle de job
- milestones cliente
- payments cliente
- field-ops admin
- worker tracker

No se ejecutó `npm run dev:web` en esta ronda. La validación hecha fue de tipado estático.

## Siguiente paso recomendado

La siguiente continuación útil ya no es cableado básico, sino validación funcional:

1. levantar `dev:web`;
2. probar rutas reales con datos del tenant activo;
3. corregir posibles discrepancias de payload que no aparecen en `tsc`.
