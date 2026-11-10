---
type: plan
feature: "Unified Query and Lineage Layer"
domain: "prometeo"
spec: "docs/specs/prometeo/unified-query-lineage.spec.md"
version: "2.1"
status: "DRAFT"
branch: "feat/unified-query-lineage"
date: "2026-11-06"
---

# Plan técnico: Unified Query and Lineage Layer

## Snapshot
Reescrito el 2026-11-06 contra `main` y el spec v1.1. El spec está en `REVIEW`: este plan no autoriza código. Refrescar `main` antes de implementar. Supone la recomendación Q-1 del slice 1 (solo Graphify, decisiones y ejecuciones).

## Constitution check
- [ ] ADR-044 aceptado con fecha y acta aprobada
- [ ] slices 1 y 2 aprobados y fusionados
- [ ] spec `APPROVED` (decisiones de la sección 14 resueltas)
- [ ] permisos de lectura definidos en `rbac.ts` (D-04)
- [ ] campo de exposición del registro de herramientas para excluir la tool de MCP (D-10)
- [ ] pruebas escritas primero y en rojo
- [ ] sin almacén paralelo ni autorización implícita por consultar
- [ ] CI, merge, despliegue y activación registrados por separado

## Arquitectura
Sobre el contrato y el registro de proveedores del slice 1:
1. **Proveedor de decisiones**: lee solo el Decision Ledger (slice 2).
2. **Proveedor de ejecuciones**: consulta H05 con `ToolExecutionQueryService`, validando `executionId` con `tenantId`; no copia resúmenes.
3. **Endpoint** `POST <prefijo>/graph/query` con los modos `neighbors`, `lineage`, `impact` y `path`; la autorización ocurre en el servicio.
4. **Herramienta de Prometeo** de solo lectura que llama al mismo servicio con el actor del usuario. Si el owner divide el slice (Q-1), esta pieza va en 3b.

## Datos
Sin migración Prisma ni caché persistente. Si el registro de acceso se persistiera en una tabla nueva sería una migración y exigiría decisión previa (Q-4); la recomendación es reutilizar `AuditLog`.

## Seguridad
- 404 de otro tenant o nodo no visible, 403 de otra organización; nodos ocultos omitidos sin rastro.
- Denegación nunca en `degradedSources`.
- Topes del servidor aplicados aunque el cliente pida más; cuota por actor.
- `label` y `attributes` entregados como datos no confiables.
- Fuente autoritativa caída → 503, no linaje parcial que parezca completo.
- La tool no figura en MCP.
- Flag ausente o desconocido = `off`; con `off`, endpoint 404 y tool no listada.

## Eventos e idempotencia
Solo lectura; sin eventos de negocio. El registro de acceso no es un evento de dominio.

## Fases
A. inventario de superficies y `SOURCE_OF_TRUTH.md`; pruebas en rojo → B. proveedores de decisiones y ejecuciones → C. servicio y endpoint → D. campo de exposición y herramienta de Prometeo (3b) → E. verificación local → F. PR, CI y merge → G. despliegue, `shadow`, canary autenticado con un tenant.

## Rollback
Flag en `off`: el endpoint responde 404 y la herramienta desaparece del registro. No hay datos que revertir; se revierte quitando el código.

## Gates
- [ ] archivos exactos confirmados contra `main`
- [ ] pruebas primero, incluida integración con base de datos
- [ ] `spec:validate:strict` en verde
- [ ] regresión del registro de herramientas y de H05
- [ ] CI y despliegue terminales
- [ ] canary autenticado
