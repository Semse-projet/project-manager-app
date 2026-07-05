# 00 — SEMSEproject Ecosystem Architecture

## Tesis

SEMSEproject debe evolucionar de una colección de páginas administrativas a un **sistema operativo modular** para operaciones reales: contratistas, construcción, servicios, propiedades, agro, pagos, evidencia, confianza e inteligencia artificial.

La arquitectura de producto se organiza alrededor del ciclo monetizable:

```txt
Lead → Intake → Estimate → Proposal → Contract → WorkOps → Evidence → Approval → Escrow → Payout → Reputation → Learning
```

## Módulos principales

| Módulo | Responsabilidad |
|---|---|
| Mission Control | Vista central, salud del sistema, métricas, alertas y navegación global. |
| WorkOps | Trabajos, crews, field operations, milestones, tareas, evidencia y tracker. |
| Marketplace | Leads, oportunidades, clientes, contratistas, propuestas, matching y reputación. |
| Finance | Estimates, invoices, escrow, payments, payouts, refunds, disputes y Stripe Connect. |
| Trust | Identidad, licencias, seguros, credenciales, compliance, reviews y risk engine. |
| Intelligence | Prometeo, RAG, agentes, memoria, simulaciones, recomendaciones y autonomía. |
| Tool Hub | ChatGPT, Claude, Codex, Gemini, Notion, Figma, GitHub, Railway, n8n y Context Bridge. |
| Verticals | Construction, Property Turnovers, Cleaning, Agro/FarmOps, Maintenance. |
| Settings | Configuración, usuarios, roles, integraciones, notificaciones, seguridad y sistema. |

## Regla de arquitectura

- `app/` define rutas.
- `features/` contiene lógica de dominio.
- `components/` contiene UI reusable.
- `lib/` contiene clientes, helpers y configuración.
- `packages/ui` contiene componentes compartidos.
- `packages/schemas` contiene contratos compartidos.
- `apps/api` contiene módulos NestJS por dominio.

## Patrón de navegación

Cada módulo debe abrir como **hub**:

```txt
Mission Control
  ↓ click módulo
Module Hub
  ↓ click submódulo
List / Dashboard
  ↓ click entidad
Detail View
  ↓ click tab
Tasks / Evidence / Finance / Documents / Activity
```

