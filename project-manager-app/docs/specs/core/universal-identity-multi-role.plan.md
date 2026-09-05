---
type: plan
feature: "F10 — Identidad universal con múltiples capacidades por cuenta"
domain: "core"
spec: "docs/specs/core/universal-identity-multi-role.spec.md"
version: "1.0"
status: "APPROVED"
branch: "TBD — crear en Fase 0 tras confirmar alcance con el owner"
date: "2026-08-04"
---

# Plan técnico: Identidad universal con múltiples capacidades por cuenta

> **Spec `APPROVED` 2026-08-04.** Fase 0 ya está resuelta (ver decisiones
> abajo, confirmadas por el owner el mismo día) — el plan pasa directo a
> Fase 1.

## 1. Resumen técnico

**Spec:** [`universal-identity-multi-role.spec.md`](universal-identity-multi-role.spec.md)

**Estrategia:** no tocar el schema de `Membership` (ya soporta múltiples
filas por usuario vía PK compuesta `userId+orgId+roleId`). El trabajo es de
producto/UX y de un endpoint de lectura nuevo — exponer las capacidades ya
existentes de un usuario y dejar que la UI/Prometeo Operativo elijan la
correcta según contexto, en vez de asumir un rol fijo de sesión.

**Complejidad:** media — el gap es de superficie (selector de capacidad,
endpoint de lectura), no de modelo de datos.

**Riesgo principal:** que "capacidad activa por contexto" se implemente de
forma que permita a un usuario ejercer permisos de una capacidad en el
contexto de otra (p. ej. actuar como profesional dentro de un proyecto
donde solo tiene `Membership` de cliente). El aislamiento por
`orgId`/proyecto existente debe seguir siendo la fuente de verdad, no una
preferencia de UI.

## 2. Constitution check

- [x] Spec `APPROVED` antes de iniciar cualquier fase (2026-08-04).
- [ ] Confirmar con el owner que esto no afecta permisos financieros
      existentes (spec §2, "fuera de alcance" ya lo declara; falta
      confirmación explícita antes de codificar).
- [ ] Tests antes del código (sección 5 de este plan, igual que el resto
      del repo).
- [ ] Multi-tenant: cada capacidad sigue acotada a su `orgId` vía
      `Membership`, sin excepción.
- [ ] Confirmar si conmutar de capacidad amerita un evento de auditoría
      nuevo o si con el log de request/correlation existente basta.

## 3. Stack afectado (propuesto)

```yaml
backend:
  framework: NestJS + Fastify
  modules:
    - apps/api/src/modules/auth (existente, se extiende con endpoint de lectura)
  schemas:
    - packages/schemas/src/ (nuevo schema de respuesta para /v1/users/me/capabilities)
  prisma_changes: false  # a confirmar en Fase 0; hoy no se anticipa ninguno

frontend:
  changes:
    - selector de capacidad activa (header/dashboard)
    - badge de capacidad por proyecto
  modules:
    - apps/web/app/(app)/*/account/
    - apps/web/app/components/account/AccountCenter.tsx

infrastructure:
  new_service: false
  new_provider: false
  new_env: []
```

## 4. Cambios de base de datos

Ninguno. `Membership` ya modela múltiples capacidades por usuario
(`CLIENT`/`PRO`/`WORKER`). Confirmado con el owner (2026-08-04): la
capacidad activa se deriva 100% del proyecto/org abierto, nunca de una
preferencia guardada — no hace falta ningún campo nuevo tipo "última
capacidad usada".

## 5. Fases propuestas

### Fase 0 — Preflight (RESUELTA 2026-08-04)

- [x] Alcance de "capacidad activa por contexto": se deriva 100% del
      proyecto/org abierto, nunca de una preferencia guardada.
- [x] El hallazgo `PRO`/"Profesional" (URL/label) queda fuera de este
      incremento — `CLIENT`/`PRO`/`WORKER` son roles reales distintos,
      no se tocan ni se fusionan.

### Fase 1 — Tests antes del código

- Test: endpoint de lectura devuelve todas las `Membership` activas del
  usuario autenticado, sin exponer las de otros usuarios.
- Test: UI deriva la capacidad activa del proyecto abierto, no de una
  preferencia global cacheada.
- Test de aislamiento: un usuario con capacidad "profesional" en la org B
  no puede ejercer permisos de esa capacidad dentro de la org A.

### Fase 2 — Endpoint de lectura

- `GET /v1/users/me/capabilities` (contrato ya definido en spec §5).
- Audit log de conmutación de capacidad, si Fase 0 lo confirma necesario.

### Fase 3 — UI

- Selector de capacidad activa.
- Badge de capacidad por proyecto.
- Resolución de la etiqueta de rol unificada (`PRO` → "Profesional"
  consistente en todas las superficies).

### Fase 4 — Validación y cierre

- `pnpm spec:validate:strict`.
- Actualizar `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md` (fila
  "Identidad universal multi-capacidad F10").
- Actualizar `ROADMAP.md` §F10 con el estado real alcanzado.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Capacidad de UI mal derivada permite cruzar permisos entre orgs | baja | crítico | aislamiento sigue viviendo en `Membership`/RBAC existente, la UI solo lee, nunca decide autorización |
| Confusión de UX si el selector no refleja el contexto real | media | medio | derivar de proyecto abierto por defecto, no de preferencia guardada (spec §5) |
| Se re-abre sin querer la etiqueta de rol (`PRO`/"Profesional") como refactor mayor | media | medio | acotar a las superficies que ya toca este plan, no perseguir cada ocurrencia del repo en este incremento |

## 7. Gate antes de tasks/implementación

- [x] Spec `APPROVED` (2026-08-04).
- [ ] Confirmación explícita del owner sobre alcance de Fase 0.
- [ ] Ningún cambio de schema identificado como necesario (o, si lo es,
      documentado aquí antes de tasks.md).
