# Fase 3: Finanzas Avanzadas

**Visión:** Sistema de gestión de escrow multi-etapa con integraciones de lenders y draw requests automáticos.

**Módulos:**
- M3.1: Multi-stage Escrow Releases (draw requests, retainage)
- M3.2: Lender Integrations (dashboard, approvals)
- M3.3: Advanced Reporting (burn rates, forecasts)

**Bloques:** 8 (estimado)

---

## M3.1: Multi-stage Escrow Releases

**Objetivo:** Permitir releases en etapas (no lump-sum).

**FSM:**
```
PROJECT START
  ↓
DRAW 1 (20%): DRAFT → PENDING_LENDER → APPROVED → FUNDED
  ↓
DRAW 2 (25%): DRAFT → PENDING_LENDER → APPROVED → FUNDED
  ↓
DRAW 3 (30%): DRAFT → PENDING_LENDER → APPROVED → FUNDED
  ↓
DRAW 4 (25% - Retainage): HELD → CLAIM_CONDITIONS_MET → RELEASED
```

**Features:**
- Retainage: 5-10% held hasta project completion
- Waiver gate integration (liens waivers)
- Approval workflow (lender → PRO → Contractor)
- Draw request timing rules

**Bloques:**
- AC-1: DrawRequest FSM + Service
- AC-2: Lender approval endpoints
- AC-3: Retainage tracking
- AC-4: Waiver gate integration

---

## M3.2: Lender Integrations

**Objetivo:** Conectar con plataformas de lenders (Meridian, ConstructionLoan, etc).

**Features:**
- OAuth2 sync
- Real-time approval status
- Webhook notifications
- Dashboard sync (bidireccional)

**Bloques:**
- AD-1: Lender API client
- AD-2: Webhook handler
- AD-3: Dashboard sync

---

## M3.3: Advanced Reporting

**Objetivo:** Análisis financiero del proyecto.

**Features:**
- Burn rate (gasto/día vs. budget)
- ETC (estimate to complete)
- Draw schedule forecast
- Retainage release dates

**Bloques:**
- AE-1: Burn rate calculator
- AE-2: Forecast engine

---

## Total: 8 bloques (estimado 10-12 horas)

Prioridad: M3.1 primero (core financial flow)
