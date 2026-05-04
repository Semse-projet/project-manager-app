# Integración páginas faltantes + nav unificado — 2026-04-19

## Qué se hizo

### Páginas nuevas creadas (10 total)

#### Worker
| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/worker/tasks` | `apps/web/app/(app)/worker/tasks/page.tsx` | Lista de tareas por milestone con filtros y estado vencido |
| `/worker/incidents` | `apps/web/app/(app)/worker/incidents/page.tsx` | Reporte y listado de incidencias con severidad y tipo |
| `/worker/materials` | `apps/web/app/(app)/worker/materials/page.tsx` | Solicitud y rastreo de materiales con costo estimado |
| `/worker/profile` | `apps/web/app/(app)/worker/profile/page.tsx` | Perfil público, disponibilidad, especialidades y bio |

#### Client
| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/client/documents` | `apps/web/app/(app)/client/documents/page.tsx` | Contratos, facturas, reportes y permisos con descarga |
| `/client/reviews` | `apps/web/app/(app)/client/reviews/page.tsx` | Reseñas escritas a trabajadores con rating y respuesta |

#### Admin
| Ruta | Archivo | Descripción |
|------|---------|-------------|
| `/admin/qa` | `apps/web/app/(app)/admin/qa/page.tsx` | Checks automáticos del pipeline (evidencia, escrow, agentes, FSM) |
| `/admin/compliance` | `apps/web/app/(app)/admin/compliance/page.tsx` | Controles regulatorios: licencias, seguros, GDPR, escrow |
| `/admin/finance` | `apps/web/app/(app)/admin/finance/page.tsx` | Registro de escrow, liberaciones, disputas, comisión plataforma |
| `/admin/reports` | `apps/web/app/(app)/admin/reports/page.tsx` | Métricas por período: ops, financiero, agentes IA, usuarios |

### Nav actualizado

`apps/web/app/(app)/layout.tsx` — NAV expandido:

**Worker**: +tareas, +materiales, +incidencias, +mi perfil  
**Client**: +documentos, +reseñas  
**Admin**: +QA Center, +Compliance, +Finanzas, +Reportes (bajo sección "Control")

### Dashboard worker

Quick actions actualizadas con links reales a `/worker/materials` e `/worker/incidents`.

### TypeScript

`npx tsc --noEmit` → 0 errores.

## Estado de datos

Todas las páginas nuevas usan datos mock locales. El patrón de conexión a API ya está establecido en las páginas existentes (ej: `worker/jobs/page.tsx` → `fetch("/api/semse/jobs")`). Cuando los endpoints de API existan, se reemplaza el mock por el mismo patrón.

## Endpoints pendientes de implementar (backend)

| Endpoint | Para |
|----------|------|
| `GET /v1/worker/:id/tasks` | Tareas del trabajador |
| `POST /v1/jobs/:jobId/incidents` | Crear incidencia |
| `GET /v1/jobs/:jobId/incidents` | Listar incidencias |
| `POST /v1/materials/requests` | Solicitar material |
| `GET /v1/materials/requests` | Listar solicitudes |
| `GET /v1/admin/finance/escrow` | Datos financieros |
| `GET /v1/admin/qa/checks` | Estado checks QA |
| `GET /v1/admin/compliance` | Controles compliance |
| `GET /v1/admin/reports/:type` | Reportes por tipo |

## Próximo paso recomendado

1. Implementar endpoints de backend para tasks, incidents, materials
2. Conectar páginas QA/Finance/Reports a API real (ya tienen estructura visual)
3. Integrar `semse/node` (autonomy server :4310) como `apps/autonomy-server` en el monorepo
4. Formalizar `npm run smoke:domain-events` como gate de CI
