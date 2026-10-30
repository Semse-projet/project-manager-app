---
type: plan
feature: "Smart Intake — Tarifas regionales y rango de estimado"
domain: "smart-intake"
spec: "docs/specs/api/smart-intake-regional-rates.spec.md"
version: "2.0"
status: "DRAFT"
branch: "feat/smart-intake-regional-rates"
date: "2026-10-30"
---

# Plan técnico: Smart Intake — Tarifas regionales y rango de estimado

> Prerrequisito: spec `APPROVED`. Hoy está en `DRAFT` con preguntas abiertas (spec §11), así que este
> plan **no autoriza código**. Separa implementación, merge, despliegue y activación.

## 1. Snapshot de verdad

- `origin/main` SHA: `609471f8` al redactar (PR #915 incluido). Registrar el SHA real al iniciar cada fase.
- SHA desplegado API / Web: pendiente de registrar. Web `609471f8` consta como `success` en el estado de commit de GitHub; el estado de API quedó `pending` y no se verificó.
- Estado de migraciones: la última en el repo es `20261020120000_geofence_policy`. No hay migración de esta feature.
- Flags/allowlists: `SMART_INTAKE_REGIONAL_RATES` no existe aún. Alinear el mecanismo con el patrón de flags ya usado en la API (verificar en T-002).
- Drift o deuda previa: ninguno conocido. Pendiente verificar el estado real de `LocationCostIndex` en producción (filas, `dataSource`, `validUntil`).

## 2. Constitution check

- [ ] Spec aprobado antes de código
- [x] Tenant/org/ownership y RBAC definidos (spec §3): datos globales, permiso nuevo solo para `OPS_ADMIN`
- [x] Evidence/Payment Governance: no aplica, el estimado es informativo y no mueve dinero
- [x] Audit definido para cambios críticos (`AuditLog`); sin eventos nuevos
- [ ] Tests preceden implementación
- [x] No se expone secreto ni se agrega backend paralelo: se reutiliza `pricing/`
- [ ] Código, CI, merge, deploy y activación se medirán por separado

## 3. Arquitectura y autoridad

- Fuente de verdad de escritura: `LocationCostIndex` (datos OEWS/estáticos, escrito por `price-refresh.job`) y
  `LocationCostOverride` (nuevo, escrito solo por el admin). El intake solo lee.
- Read models/proyecciones: ninguno. El estimado se calcula en `generateEstimate`, que sigue siendo pura;
  recibe `regional` como argumento y no accede a la base.
- Módulos afectados: `smart-intake` (consume) y `pricing` (expone lectura sin red y endpoints admin).
- Contratos Zod: `packages/schemas/src/` para `RegionalAdjustment` y los payloads admin.
- API/BFF/UI: BFF admin con el patrón de `semse-bff-pattern`; tarjeta de estimado en `project-intake/`.
- Worker/queues: ninguno nuevo; `price-refresh.job` sigue igual.
- ADR requerido: no, salvo que Q4 cambie el alcance a metro/ZIP.

## 4. Datos y migración

- Cambio Prisma: solo fase C. Modelo `LocationCostOverride` (spec §7).
- SQL y checksum: se generan con `prisma migrate dev` y se registran en la PR.
- Expand/contract: solo expand.
- Backfill/shadow read: ninguno.
- Compatibilidad durante deploy: con la tabla vacía el comportamiento es idéntico al de la fase A.
- Pre-deploy command: el que ya usa Railway para migrar; no se modifica CI/Railway (AGENTS.md).
- Rollback o forward-fix: apagar el flag; borrar filas; en último caso `DROP TABLE` en una migración nueva.
- Prueba de migración: aplicar sobre una base local limpia y sobre una copia con el esquema actual.

## 5. Seguridad y política

- Permisos: `ops:dashboard:read` (lectura) y `pricing:location:manage` (nuevo) en `OPS_ADMIN`; añadir al mapa de `packages/auth/src/rbac.ts` y probar según `semse-rbac-permissions`.
- Tenant/org/resource scope: datos globales de plataforma; el `AuditLog` usa el tenant del actor.
- Step-up/aprobación: motivo obligatorio (≥ 10 caracteres); rango [0.5, 2.0].
- Auditoría: `AuditLog` con `before`/`after`.
- Riesgos de pagos/evidencia: ninguno directo; el riesgo real es de **reputación** (estimados engañosos) y de
  **abuso**: un multiplicador malicioso movería todos los estimados de un estado, de ahí el clamp, el motivo y la auditoría.
- Abuse cases: endpoint público de intake que dispare consultas en vivo a BLS (prohibido: `getCachedMultipliers` no usa red);
  `city` con texto largo o inyección (se trata como texto, se normaliza y se acota a 120 caracteres).

## 6. Eventos, idempotencia y reconstrucción

- Productores/outbox/consumers/replay/DLQ: no aplica; no hay eventos de dominio nuevos.
- Correlation/traces: el `requestId` existente en los endpoints admin.
- PUT del override es idempotente (upsert por `stateCode`).

## 7. Estrategia de implementación

Cuatro PR pequeños y reversibles, en este orden:

### Fase A — Región y multiplicadores en el estimado (sin migración)

- Tests rojos de `resolveRegion` y de `generateEstimate(intake, regional)`; regresión con `regional = null`.
- `config/region.ts`, `getCachedMultipliers`, `regionalAdjustment` en el tipo y en el JSON del estimado.
- Servicio: resolver región y pasar `regional` solo si el flag está activo.
- Textos es/en de los supuestos y del tip "añade estado o ZIP".

### Fase B — Rango y confianza (sin migración)

- Tests rojos de la compresión de rango y de la etiqueta de confianza (P4).
- Implementar `spread_target_by_accuracy` tras aprobar Q2; cubrir también el estimador de pintura.

### Fase C — Anulaciones y API admin (migración)

- Migración aditiva y modelo `LocationCostOverride`.
- Permiso nuevo, endpoints, `AuditLog`, validaciones.
- Precedencia override > índice > estático > 1.0 en `getCachedMultipliers`.

### Fase D — Pantalla admin y estimado en la UI

- Página admin con los seis estados de UX y su BFF.
- Línea de región/fuente en la tarjeta del estimado.

### Verificación (cada fase)

- Tests dirigidos, regresión de `smart-intake-*` e `intake-*`, build, typecheck y lint.
- `pnpm spec:validate:strict`, `pnpm spec:coverage` y `pnpm spec:index`.
- PR, CI terminal, merge con SHA, despliegue terminal, canary con el flag, smoke en producción
  (incluido el comportamiento del wizard en Chrome) y registro de evidencia.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Tarifas base o multiplicadores no reflejan el mercado | Alta | Alto (estimados engañosos) | Validar con fuentes primarias antes de `APPROVED`; etiqueta de fuente visible | Quejas o desviación > 30 % frente a cotizaciones reales |
| Ciudad sin estado → mayoría de estimados en "national" | Media | Medio | Tip claro y métrica de `source = "national"` | > 50 % de estimados sin región |
| Compresión de rango da falsa precisión | Media | Alto | Objetivos aprobados por producto; nunca ampliar; etiqueta atada al ancho | Reclamos por estimados muy por debajo del precio final |
| `getCachedMultipliers` con datos vencidos | Media | Bajo | Usar último valor conocido y mostrar fuente | `validUntil` vencido por más de 30 días |
| Override mal puesto mueve todo un estado | Baja | Alto | Clamp, motivo, auditoría y reversión de un clic | Cambio brusco del estimado medio por estado |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| Vigencia de BLS OEWS por estado y ocupación de construcción | BLS (a consultar) | Pendiente |
| Índices de costo de construcción por estado | RSMeans / fuente equivalente (a consultar) | Pendiente |
| Tarifas por oficio y por categoría para validar `baseMin`/`baseMax` | Cotizaciones reales / fuentes primarias | Pendiente |

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (spec §10)
- [x] Migración y rollback definidos
- [ ] Tests ordenados antes del código
- [ ] Canary/feature flag definidos (mecanismo pendiente de verificar en T-002)
- [ ] Evidencia requerida para cada estado de entrega
- [x] Scope cabe en un PR reversible (cuatro PR por fase)
