---
id: "ui.audit-product-decisions"
title: "Decisiones de producto bloqueantes de la auditoría 2026-07"
domain: "product"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
date: "2026-07-23"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - docs/AUDIT_REMEDIATION_PLAN.md
  - docs/specs/ui/client-flows-remediation.spec.md
  - docs/specs/ui/pro-flows-remediation.spec.md
  - docs/specs/api/worker-verification-remediation.spec.md
  - docs/specs/api/payout-method-tokenization.spec.md
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-07-23"
---

# Spec: Decisiones de producto bloqueantes

## 1. Propósito

Separar decisiones reales de producto/cumplimiento de los fixes correctivos que
sí pueden ejecutarse. Este documento no autoriza implementación mientras esté
en `DRAFT`.

## 2. Registro de decisiones

| ID | Ítems del plan | Decisión requerida | Opciones mínimas |
|---|---|---|---|
| PD-01 | `1.5` | Persona CLIENT | rol híbrido vs. separar dueño/contratista |
| PD-02 | `1.21` | Marca canónica | SEMSE OS vs. SEMSE Project + migración |
| PD-03 | `1.11b` | Trust visible/explicable | fuente, escala, superficie y copy |
| PD-04 | `2.1` | Tracker legacy | retirar, solo lectura o migrar históricos |
| PD-05 | `2.28`, `0.9` | Identidad/verificación | KYC/DID, evidencia, retención y cola |
| PD-06 | `2.40` | Tarifas del profesional | qué estimados afecta y quién selecciona al PRO |
| PD-07 | `2.44` | Riel de cobro | Connect/Elements/Financial Connections/Plaid |

## 3. Plantilla de resolución

Cada decisión debe registrar:

- owner y fecha;
- opción elegida y alternativas descartadas;
- impacto en roles, datos, API, UI y migración;
- criterio de éxito;
- rollback;
- specs que pasan a `APPROVED`.

## 4. Reglas mientras están abiertas

- No inventar comportamiento de producto.
- Sí se permiten mitigaciones de seguridad deny-by-default y copy honesto.
- No exponer stubs como capacidades reales.
- No mantener formularios que recolecten datos financieros completos.
- Un ítem bloqueado se etiqueta `DECISION_REQUIRED`, no simplemente
  “pendiente”, en la matriz canónica.
