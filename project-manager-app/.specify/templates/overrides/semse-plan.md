---
type: plan
feature: "[FEATURE_NAME]"
domain: "[DOMAIN]"
spec: "docs/specs/[dominio]/[feature].spec.md"
version: "1.0"
status: "[DRAFT | APPROVED]"
branch: "feat/[feature-slug]"
date: "[YYYY-MM-DD]"
---

# Plan Técnico: [FEATURE_NAME]

> **Prerequisito:** El spec `[feature].spec.md` debe estar en estado `APPROVED`.
> Este plan no se aprueba si el spec tiene secciones incompletas.

---

## 1. Resumen Técnico

**Spec referenciado:** [path al spec]
**Estrategia de implementación:** [una o dos oraciones]
**Estimación de complejidad:** [Baja | Media | Alta]
**Riesgo principal:** [descripción]

---

## 2. Constitution Check

> Verificar que el plan no viola ningún principio de `.specify/memory/constitution.md`

- [ ] **P1 — Spec primero:** El spec está APPROVED antes de este plan
- [ ] **P2 — Evidencia primero:** Si hay pagos, ¿pasan por evidencia antes?
- [ ] **P3 — Audit Log:** ¿Todos los cambios de estado generan evento?
- [ ] **P4 — Privacidad local:** ¿Los datos sensibles van a Ollama?
- [ ] **P5 — Tests antes del código:** ¿Los tests se escriben antes de implementar?

---

## 3. Stack Técnico Afectado

```yaml
backend:
  framework: NestJS
  módulos_afectados: []      # apps/api/src/modules/
  schemas_afectados: []      # packages/schemas/src/
  prisma_cambios: [sí | no]  # si requiere migración

frontend:
  framework: Next.js
  páginas_afectadas: []      # apps/web/app/
  componentes_nuevos: []     # apps/web/components/ o packages/ui/

workers:
  bullmq_jobs: [sí | no]
  jobs_nuevos: []

infraestructura:
  railway: [no cambios | requiere nueva variable de entorno]
  variables_nuevas: []
  ollama: [sí | no]          # si hay routing privacyCritical
```

---

## 4. Cambios en Base de Datos

```prisma
// Modelos nuevos o modificados
// Copiar o bosquejar los cambios de schema.prisma aquí

model [NombreModelo] {
  // campos
}
```

**Tipo de migración:**
- [ ] Migración aditiva (additive) — sin riesgo de datos
- [ ] Migración modificativa — revisar datos existentes
- [ ] Sin cambio de schema

---

## 5. Módulos NestJS

### Módulo existente modificado: `[NombreModulo]`

```
apps/api/src/modules/[nombre]/
├── [nombre].controller.ts    → agregar endpoint [MÉTODO] /v1/[ruta]
├── [nombre].service.ts       → agregar método [nombreMetodo]
└── [nombre].module.ts        → sin cambios | agregar import
```

### Módulo nuevo: `[NombreModulo]` (si aplica)

```
apps/api/src/modules/[nombre]/
├── [nombre].controller.ts
├── [nombre].service.ts
├── [nombre].module.ts
└── [nombre].spec.ts          ← test obligatorio
```

---

## 6. Schemas (packages/schemas)

```typescript
// Schemas Zod nuevos o modificados
// packages/schemas/src/[dominio].ts

export const [NombreInputSchema] = z.object({
  // campos del input del spec
});

export const [NombreOutputSchema] = z.object({
  // campos del output del spec
});
```

---

## 7. Frontend (si aplica)

```
apps/web/app/
└── [ruta]/
    ├── page.tsx        → nueva página o modificación
    └── components/     → componentes específicos

apps/web/lib/
└── bff/[dominio].ts    → BFF route si necesita server-side call
```

---

## 8. Eventos y SSE

```typescript
// Eventos a emitir (del EVENT_CATALOG)
// [aggregate.action]: [payload]

// Canal SSE:
// apps/api/src/modules/[dominio]/[dominio]-sse.service.ts
```

---

## 9. Fases de Implementación

### Fase 1 — Setup
- [ ] Migración de Prisma (si aplica)
- [ ] Schema Zod en `packages/schemas`
- [ ] Módulo NestJS esqueleto

### Fase 2 — Foundational ⚠️ CRÍTICA
- [ ] Service con lógica de dominio
- [ ] Tests unitarios del service
- [ ] Verificación de invariantes

### Fase 3 — API Contract
- [ ] Controller con endpoints
- [ ] Guards RBAC
- [ ] Tests de integración del endpoint

### Fase 4 — Efectos
- [ ] Emisión de eventos audit
- [ ] SSE si aplica
- [ ] Notificaciones si aplica

### Fase 5 — Frontend + Polish
- [ ] UI si aplica
- [ ] BFF routes si aplica
- [ ] Documentación en `SEMSE_API_SURFACE_V1.md`
- [ ] Reporte de sesión en `docs/reportes/`

---

## 10. Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| | | | |

---

## Checklist antes de /speckit.tasks

- [ ] Constitution check completado sin violaciones
- [ ] Cambios de schema identificados
- [ ] Módulos afectados listados con precisión de archivo
- [ ] Fases de implementación ordenadas por dependencia
- [ ] Tests incluidos en Fase 2 (antes del código de negocio)
