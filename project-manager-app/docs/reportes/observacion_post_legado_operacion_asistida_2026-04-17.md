# Observacion Post-Legado de Operacion Asistida

- Fecha: 2026-04-17
- Estado: activo

## Resumen

- proveedor multipart actual: `filesystem_multipart`
- menciones legacy en runtime: `0`
- superficies observadas: `7`

## Menciones legacy encontradas

- ninguna

## Superficies inspeccionadas

- `apps/api/src/modules/evidence/evidence.controller.ts`: multipart=true, uploadMultipartPart=true, contextMemoryNaming=false
- `apps/web/app/jobs/[jobId]/evidence/page.tsx`: multipart=true, uploadMultipartPart=true, contextMemoryNaming=false
- `apps/web/app/(app)/admin/disputes/page.tsx`: multipart=true, uploadMultipartPart=true, contextMemoryNaming=false
- `apps/web/app/(app)/worker/tracker/page.tsx`: multipart=true, uploadMultipartPart=true, contextMemoryNaming=false
- `apps/web/app/(app)/worker/field-ops/page.tsx`: multipart=false, uploadMultipartPart=false, contextMemoryNaming=true
- `apps/web/app/api/semse/field-ops/facts/route.ts`: multipart=false, uploadMultipartPart=false, contextMemoryNaming=true
- `apps/web/app/semse-api.ts`: multipart=true, uploadMultipartPart=true, contextMemoryNaming=false
