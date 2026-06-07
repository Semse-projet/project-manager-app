---
type: spec
feature: "[FEATURE_NAME]"
domain: "[DOMAIN: jobs | milestones | evidence | payments | disputes | intake | buildops | prometeo | communications | consciousness]"
version: "1.0"
status: "[DRAFT | APPROVED | DEPRECATED]"
branch: "feat/[feature-slug]"
date: "[YYYY-MM-DD]"
author: "[nombre o agente]"
spec_index: "docs/SPEC_INDEX.md"
---

# Spec: [FEATURE_NAME]

> **Instrucción para agente:** Este template es el contrato ejecutable de SEMSE.
> Completar TODAS las secciones antes de pasar a /speckit.plan.
> No generar código sin spec en estado APPROVED.

---

## 1. Qué resuelve

<!-- Una o dos oraciones. Problema real de negocio, no descripción técnica. -->

**Para quién:** [cliente | contratista | ops_admin | plataforma]
**Problema:** [descripción del dolor]
**Solución:** [qué hace este feature]

---

## 2. Actores y Permisos

| Actor | Rol SEMSE | Puede hacer | No puede hacer |
|-------|-----------|-------------|----------------|
| | `CLIENT` | | |
| | `PRO` | | |
| | `OPS_ADMIN` | | |
| | `PLATFORM` | | |

Referencia de roles: `docs/program/architecture/SEMSE_ROLE_MODEL.md`
Referencia de permisos: `docs/program/governance/SEMSE_PERMISSION_MATRIX.md`

---

## 3. Escenarios de Usuario (P1/P2/P3)

### P1 — [Escenario crítico de negocio]

**Journey:** [descripción en lenguaje natural del flujo completo]

**Criterio de aceptación:**
```
DADO   [estado inicial del sistema]
CUANDO [acción del actor]
ENTONCES [resultado esperado]
  Y    [efecto secundario esperado: evento, notificación, audit]
```

**Casos borde:**
- [ ] [caso borde 1]
- [ ] [caso borde 2]

**Errores esperados:**
- `400` si [validación falla]
- `403` si [permiso insuficiente]
- `404` si [recurso no existe]
- `409` si [conflicto de estado]

---

### P2 — [Escenario secundario]

<!-- Repetir estructura P1 -->

---

## 4. FSM — Máquina de Estados

> Obligatorio para cualquier feature con ciclo de vida (milestones, jobs, pagos, evidencia).

**Entidad afectada:** `[Job | Milestone | Escrow | Contract | Evidence | BuildOpsProject]`

```
[ESTADO_INICIAL] → [ESTADO_SIGUIENTE]
  guard: [condición para la transición]
  effect: [evento emitido, qué pasa]

[ESTADO_SIGUIENTE] → [ESTADO_FINAL]
  guard: [condición]
  effect: [evento]

[ESTADOS_TERMINALES]: [ESTADO_A], [ESTADO_B]
  regla: los estados terminales no se reabren sin policy explícita
```

Referencia base: `docs/foundation/STATE_MACHINES.md`
Verificar que las transiciones no violen: `docs/foundation/DOMAIN_INVARIANTS.md`

---

## 5. Contratos de API

> Por cada endpoint. Formato obligatorio en SEMSE.

### `[MÉTODO] /v1/[ruta]`

```yaml
método: [GET | POST | PATCH | DELETE]
ruta: /v1/[path]
descripción: [una línea]

auth: [requerida | pública]
roles: [CLIENT | PRO | OPS_ADMIN | PLATFORM]
privacyCritical: [true | false]  # true → routing a Ollama local

input:
  schema: [NombreDelSchema]  # en packages/schemas/src/
  campos:
    - nombre: [campo]
      tipo: [string | number | uuid | enum]
      requerido: [true | false]
      validación: [min/max/regex/enum values]

output:
  schema: [NombreDelSchema]
  campos:
    - nombre: [campo]
      tipo: [tipo]

errores:
  400: [descripción — validación fallida]
  403: [descripción — permiso insuficiente]
  404: [descripción — recurso no existe]
  409: [descripción — conflicto de estado]

efectos:
  auditLog: [true | false]
  evento: [aggregate.action]  # del EVENT_CATALOG
  sse: [true | false]  # emite SSE real-time
  notificacion: [descripción de notificación si aplica]
  fsmTransicion: [ESTADO_ORIGEN → ESTADO_DESTINO]
  paymentGovernance: [true | false]  # si toca escrow o pagos
```

---

## 6. Criterios de Éxito

| Métrica | Valor objetivo |
|---------|---------------|
| Latencia P95 | < [X]ms |
| Tasa de error | < [X]% |
| Cobertura de tests | ≥ 80% branches |
| Escenarios P1 cubiertos | 100% |

---

## 7. Tests Requeridos (antes de implementar)

> El test es el spec ejecutable. Se escribe ANTES del código.

```typescript
describe("[MÉTODO] /v1/[ruta]") {
  it("[actor] puede [acción] en [estado válido]")
  it("rechaza con 403 si el rol no es [rol_requerido]")
  it("rechaza con 400 si [campo_requerido] está vacío")
  it("rechaza con 409 si [entidad] está en estado [estado_inválido]")
  it("emite evento [aggregate.action] en audit log")
  it("emite SSE cuando [condición]")  // si aplica
  it("libera escrow solo cuando [condición de pago]")  // si aplica
}
```

---

## 8. Impacto en otros dominios

| Dominio | Impacto | Acción requerida |
|---------|---------|-----------------|
| Escrow/Payments | [sí/no] | [qué hay que verificar] |
| Evidence | [sí/no] | [qué hay que verificar] |
| Prometeo RAG | [sí/no] | [actualizar knowledge base si aplica] |
| SSE/Real-time | [sí/no] | [qué evento SSE emitir] |
| WhatsApp/Comms | [sí/no] | [notificación si aplica] |
| Consciousness | [sí/no] | [observación si aplica] |
| BuildOps | [sí/no] | [estado BuildOps si aplica] |

---

## 9. Supuestos y Dependencias

- [ ] [Supuesto 1: qué debe ser verdad para que este spec sea válido]
- [ ] [Dependencia: qué otro spec o feature debe existir primero]

---

## Checklist de aprobación

- [ ] Todos los escenarios P1 tienen criterio de aceptación Given/When/Then
- [ ] Todos los endpoints tienen input/output/errores/efectos completos
- [ ] FSM declarada y verificada contra `STATE_MACHINES.md`
- [ ] Tests requeridos listados
- [ ] Ninguna invariante de `DOMAIN_INVARIANTS.md` violada
- [ ] Spec agregado a `docs/SPEC_INDEX.md`
- [ ] Status cambiado a `APPROVED` antes de pasar a /speckit.plan
