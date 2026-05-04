# Type Migration Map: src/types/index.ts → @semse/schemas

**Fecha:** 2026-04-27

## Estado general

`src/types/index.ts` ya marcaba explícitamente: **"MIGRACIÓN EN CURSO — NO AÑADIR TIPOS NUEVOS AQUÍ"**.
La migración está **completada** en `packages/schemas/src/client.types.ts`.

---

## Mapa de tipos

| Tipo legacy | Archivo origen | Schema canónico | Acción | Estado |
|---|---|---|---|---|
| `User` | `src/types/index.ts` | `client.types.ts` → `User` | Migrado + extendido (campo `orgId`) | ✅ |
| `UserRole` | `src/types/index.ts` | `client.types.ts` → `UserRole` | Migrado + `"worker"` añadido | ✅ |
| `Job` | `src/types/index.ts` | `client.types.ts` → `Job` | Migrado + `scope`, `clientOrgId`, `tenantId` | ✅ |
| `JobStatus` | `src/types/index.ts` | `job.schema.ts` → `JobRecordStatus` / `client.types.ts` → `JobStatusUI` | Separado: DB enum vs UI enum | ✅ |
| `JobBudget` | `src/types/index.ts` | `client.types.ts` → `JobBudget` | Migrado. `budget_min`/`budget_max` flat → `budget.min`/`budget.max` nested | ✅ |
| `ServiceCategory` | `src/types/index.ts` | `client.types.ts` → `ServiceCategory` | Migrado | ✅ |
| `Proposal` | `src/types/index.ts` | `client.types.ts` → `Proposal` | Migrado | ✅ |
| `Escrow` / `EscrowAccount` | `src/types/index.ts` | `escrow-view.types.ts` → `EscrowView` | Migrado + `UPPERCASE` status codes | ✅ |
| `EscrowMilestone` | `src/types/index.ts` | `escrow-view.types.ts` → `EscrowMilestoneView` | Migrado + campos adicionales de evidencia | ✅ |
| `Booking` | `src/types/index.ts` | `packages/ui` → `BookingCard.Booking` | Migrado como tipo inline del componente | ✅ |
| `AgentRole` | `src/lib/ai.ts` | `packages/agents` → `NamedAgentRole` + `SpecializedAgentRole` | Migrado + separado en 2 categorías | ✅ |
| `AgentDefinition` | `src/lib/ai.ts` | `packages/agents` → `AgentDefinition` | Migrado + `contextTriggers` añadido | ✅ |
| `Message` | `src/lib/ai.ts` | `packages/agents` → `AgentMessage` | Renombrado + tipado limpiado | ✅ |
| `ProfessionalDashboard` | `src/types/index.ts` | `client.types.ts` (partial) | Parcialmente cubierto | ⚠️ Pendiente completar |
| `SkillMatrix` / `PortfolioItem` | `src/types/index.ts` | `client.types.ts` | Pendiente | ⚠️ Pendiente |

## Tipos en src/ sin equivalente canónico aún

Estos tipos legacy existen en `src/types/index.ts` pero no tienen schema canónico completo todavía:

- `ProfessionalTool`, `ProfessionalFilter`, `ProfessionalSearchResult`
- `EnhancedProposal`, `ProposalMilestone`
- `EarningsSummary`, `PerformanceMetrics`, `UpcomingDeadline`, `ActivityItem`
- `SkillMatrix`, `PortfolioItem`, `Certification`, `WorkExperience`, `Education`, `Language`, `Badge`

**Acción recomendada:** Cuando se implemente el módulo de perfil profesional completo, añadir estos tipos en `packages/schemas/src/professional.schema.ts`.

## Regla de oro

> Todo tipo nuevo relacionado con el dominio SEMSE debe ir en `packages/schemas/src/`.
> Nunca en `apps/web`, nunca en `src/types/index.ts`.
