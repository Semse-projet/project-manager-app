---
type: plan
feature: "Unified Operational Graph Contract"
domain: "prometeo"
spec: "docs/specs/prometeo/unified-graph-contract.spec.md"
version: "2.1"
status: "DRAFT"
branch: "feat/unified-graph-contract"
date: "2026-11-06"
---

# Plan técnico: Unified Operational Graph Contract

## Snapshot
Reescrito el 2026-11-06 contra `main` y el spec v1.1. El spec está en `REVIEW`; este plan no autoriza código. Refrescar `main` antes de implementar.

## Constitution check
- [ ] ADR-044 aceptado con fecha y acta aprobada
- [ ] spec `APPROVED` (decisiones Q-1 a Q-5 resueltas)
- [ ] permisos nuevos de solo lectura definidos en `rbac.ts` (D-04)
- [ ] pruebas escritas primero y en rojo
- [ ] sin autoridad ni almacén paralelo
- [ ] CI, merge, despliegue y activación registrados por separado

## Arquitectura
Librería de solo lectura, sin endpoint ni consumidor propios (D-16). Tres piezas:
1. **Contratos Zod** en `packages/schemas/src` (D-03): nodo, arista, consulta, resultado, `SourceRef`, catálogo de errores.
2. **Módulo nuevo y propio** en `apps/api/src/modules/` (nombre en Q-2): interfaz `OperationalGraphProvider`, registro y servicio de combinación.
3. **Proveedor Graphify** que lee `GRAPHIFY_GRAPH_PATH` y valida con Zod (opción A de la [prueba técnica](operational-intelligence-program.graphify-probe.md)).

Los proveedores de memoria y conversaciones quedan fuera hasta resolver Q-1.

## Datos
Sin migración Prisma. Sin tablas de grafo. Sin `db push`.

## Seguridad
- El servicio recibe una consulta ya autorizada y cada proveedor vuelve a comprobar el alcance de su fuente (G-07).
- Falla cerrada: 404 de otro tenant, 403 de otra organización (D-05).
- Ocultos se omiten sin rastro; denegación nunca es degradación (D-06).
- Allowlist de atributos y redacción en el proveedor (D-07).
- Sin cuerpos de fuentes ni atributos en logs.
- `SEMSE_OPERATIONAL_GRAPH_MODE` ausente o desconocido = `off`.

## Eventos e idempotencia
Solo lectura y reconstruible; sin eventos.

## Fases
A. pruebas y contratos en rojo → B. contratos Zod y proveedor → C. servicio de combinación → D. verificación local → E. PR, CI y merge. Sin fase de despliegue ni canary: los cubre el slice 3 (D-16).

## Rollback
El slice no tiene efectos de datos: se revierte quitando el código. No hay historial que conservar; eso aplica solo al slice 2.

## Gates
- [ ] archivos exactos confirmados contra `main`
- [ ] pruebas primero
- [ ] `spec:validate:strict` en verde
- [ ] regresión de `GraphifyService` y de `repo-knowledge`
- [ ] CI terminal
