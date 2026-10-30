---
type: plan
feature: "Motor de costos unificado"
domain: "pricing"
spec: "docs/specs/api/cost-engine.spec.md"
version: "2.0"
status: "DRAFT"
branch: "feat/cost-engine"
date: "2026-10-30"
---

# Plan técnico: Motor de costos unificado

> Prerrequisito: spec `APPROVED`. Hoy está en `DRAFT` con preguntas abiertas (spec §11): este plan **no
> autoriza código**. Separa implementación, merge, despliegue y activación.

## 1. Snapshot de verdad

- `origin/main` SHA: registrar al iniciar cada fase.
- SHA desplegado API / Web: registrar al iniciar; no verificado al redactar.
- Estado de migraciones: la última en el repo era `20261020120000_geofence_policy` al redactar; no hay migración de esta feature.
- Flags: `COST_ENGINE_SHADOW` y `COST_ENGINE_SMART_INTAKE` no existen; alinear con el mecanismo de flags de la API (T-002).
- Deuda previa conocida: dos sistemas de costos paralelos; márgenes fijos en `cost-engine.ts`; `LocationCostIndex` sin ruta de escritura manual; el estado real de `LocationCostIndex` en producción no está verificado.

## 2. Constitution check

- [ ] Spec aprobado antes de código
- [x] Tenant/org/ownership y RBAC definidos por capa (spec §3); roles de organización por confirmar (Q4)
- [x] Payment Governance revisado: `platformFeeRate` y `taxRate` reservados a plataforma, con aprobación (Q1)
- [x] Audit definido (`AuditLog`); sin eventos de dominio nuevos
- [ ] Tests preceden implementación
- [x] No se expone secreto ni se crea backend paralelo: se envuelve `packages/tools` y `pricing/`
- [ ] Código, CI, merge, deploy y activación se medirán por separado

## 3. Arquitectura y autoridad

- Fuente de verdad de la fórmula: motores de `packages/tools`. Fuente de los parámetros: `PARAMETER_REGISTRY`
  (defaults) + `CostParameter` (excepciones por capa).
- Estrategia clave: **recalcular `buildCostSummary` fuera de los motores** con los parámetros efectivos, para no
  tocar los 24 motores. Debe validarse por motor (T-004). Si algún motor no expone la base antes de márgenes,
  se corrige solo ese motor.
- Servicio único `CostEngineService`; los consumidores no importan motores directamente.
- Región: se reutiliza `LocationCostService` y la resolución de región de la spec regional.
- Smart Intake: adaptador respuesta → entradas del motor; el rango sale de ejecutar el motor con escenarios bajo y alto.
- Contratos Zod en `packages/schemas`; BFF según `semse-bff-pattern`.
- ADR requerido: sí, para la decisión "recalcular márgenes fuera del motor" y la jerarquía de capas.

## 4. Datos y migración

- Solo la fase 3 toca el esquema: tabla `CostParameter` (spec §7), aditiva y sin FK.
- `costTrace` vive en `generatedEstimateJson` (JSON existente), sin migración.
- Compatibilidad durante deploy: sin filas, todo se comporta como el registro en código.
- Rollback o forward-fix: apagar flags; borrar filas; `DROP TABLE` en migración nueva solo como último recurso.
- Prueba de migración: base local limpia y copia con el esquema actual. Se crea con `prisma migrate dev` y
  **con aprobación explícita del owner** (AGENTS.md).

## 5. Seguridad y política

- Permisos por capa, en `rbac.ts`; plataforma/región solo `OPS_ADMIN`.
- Aislamiento: contratista solo su fila; organización solo su `orgId`; sin filtrar existencia entre tenants.
- Riesgos de pagos: cambios de fee o impuesto afectan cotizaciones y escrow; aprobación reforzada y sin efecto
  retroactivo sobre contratos existentes.
- Abuse cases: un parámetro hostil que mueva todos los precios (límites, motivo y auditoría); lectura de márgenes
  de un contratista por un cliente (modos y traza); consultas en vivo a BLS desde rutas públicas (prohibidas).

## 6. Eventos, idempotencia y reconstrucción

- Sin eventos de dominio nuevos. PUT por `scope+scopeId+key` idempotente con versión (409 en conflicto).
- Reproducibilidad por `costTrace`.

## 7. Estrategia de implementación

### Fase 0 — Verdad y red de seguridad (sin código de producto)

- Inventario de consumidores de los motores y de estimados guardados.
- **Tests de contrato por motor** (golden): resultado actual = `buildCostSummary(materials, labor)` con defaults.
- Validación externa de datos (plan §9).

### Fase 1 — Servicio y registro (sin migración, sin efecto visible)

- `CostEngineService`, `PARAMETER_REGISTRY`, resolvedor por capas con solo `platform` y `engine_default`, `costTrace`.

### Fase 2 — Smart Intake en modo sombra (sin migración)

- Adaptador por categoría con motor equivalente; rango por escenarios.
- `COST_ENGINE_SHADOW`: se sirve la fórmula plana y se registra la diferencia.
- Revisar la comparación con producto antes de activar.

### Fase 3 — Parámetros por capa (migración, API admin)

- `CostParameter`, permisos, endpoints, auditoría, límites, versión y reversión.
- Capas región, organización y contratista.

### Fase 4 — Pantallas

- Admin, organización, contratista y tarjeta de estimado con región y fuente.

### Fase 5 — Activación y migración de consumidores

- Activar `COST_ENGINE_SMART_INTAKE` por categoría; después ProTools, Prometeo, cotizaciones y órdenes de cambio, cada uno con su verificación.
- Retirar la fórmula plana solo con evidencia suficiente.

### Verificación (cada fase)

- Tests dirigidos y regresión `smart-intake-*`/`intake-*`/ProTools; build, typecheck y lint.
- `pnpm spec:validate:strict`, `pnpm spec:coverage`, `pnpm spec:index`.
- PR, CI terminal, merge con SHA, despliegue terminal, smoke en Chrome y registro de evidencia.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| El recalculo externo no reproduce algún motor | Media | Alto | Tests de contrato por motor antes de seguir (Fase 0) | Cualquier diferencia vs. golden |
| Datos de precios/tarifas desactualizados | Alta | Alto | Validación externa; mostrar fuente y fecha; modo sombra | Desviación frente a cotizaciones reales |
| Parámetros mal configurados mueven precios | Media | Alto | Límites, motivo, auditoría, reversión y aprobación para fee/tax | Cambio brusco del estimado medio |
| Mapeo respuesta → cantidades incorrecto | Alta | Alto | Revisión de oficio (Q9), sombra y activación por categoría | Ratio motor/plana fuera de lo aprobado |
| Latencia del servicio en rutas públicas | Media | Medio | Lectura sin red, caché y fallback a la fórmula plana | Regresión de p95 |
| Márgenes del contratista expuestos al cliente | Baja | Alto | Modos y recorte de traza; test explícito | Cualquier hallazgo |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| Vigencia y metodología de BLS OEWS por estado y oficio | BLS (a consultar) | Pendiente |
| Índices de costo de construcción por estado | RSMeans o equivalente (a consultar) | Pendiente |
| Márgenes típicos de overhead y ganancia por oficio, y tasas de impuesto por estado | Fuentes del sector / tributarias (a consultar) | Pendiente |
| Rendimientos y precios base de los motores por oficio | Cotizaciones reales, revisión de expertos de oficio | Pendiente |

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (spec §10)
- [x] Migración y rollback definidos
- [ ] Tests ordenados antes del código (la Fase 0 son tests)
- [ ] Canary y flags definidos (mecanismo por verificar en T-002)
- [ ] Evidencia requerida para cada estado de entrega
- [x] Scope cabe en PR reversibles (una PR por fase)
