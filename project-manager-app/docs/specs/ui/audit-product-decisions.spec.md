---
id: "ui.audit-product-decisions"
title: "Decisiones de producto bloqueantes de la auditoría 2026-07"
domain: "product"
version: "1.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
date: "2026-07-23"
author: "Codex; actualizada el 2026-10-03 con el estado real de cada decisión"
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
last_verified: "2026-10-03"
---

# Spec: Decisiones de producto bloqueantes

## 1. Propósito

Separar decisiones reales de producto/cumplimiento de los fixes correctivos que
sí pueden ejecutarse. Este documento no autoriza implementación mientras esté
en `DRAFT`.

## 2. Registro de decisiones

| ID | Ítems del plan | Decisión requerida | Opciones mínimas | Estado (2026-10-03) |
|---|---|---|---|---|
| PD-01 | `1.5` | Persona CLIENT | rol híbrido vs. separar dueño/contratista | **Resuelta 2026-07-27** (PR #457): un solo rol Cliente con agrupación explícita comprador/contratista en la navegación. |
| PD-02 | `1.21` | Marca canónica | SEMSE OS vs. SEMSE Project + migración | **Resuelta 2026-07-27** (PR #454): "SEMSE Project" en toda la app autenticada, PDFs y prompts de IA; "SEMSE OS" queda solo en `admin/consciousness`. |
| PD-03 | `1.11b` | Trust visible/explicable | fuente, escala, superficie y copy | **Abierta.** El plan no marca el ítem como corregido: falta averiguar de dónde sale el "nivel de confianza 26/100" que menciona el chat de Prometeo. |
| PD-04 | `2.1` | Tracker legacy | retirar, solo lectura o migrar históricos | **Resuelta 2026-07-27** (PR #452): se retiró la pestaña Tracker legada de `field-ops`; el Labor Engine gana. El backend y los datos históricos quedan intactos. |
| PD-05 | `2.28`, `0.9` | Identidad/verificación | KYC/DID, evidencia, retención y cola | **Parcial.** El flujo de solicitud y la cola de revisión existen (`2.28` corregido, ver `api.worker-verification-remediation`); siguen abiertos proveedor KYC/DID, evidencia mínima y retención. |
| PD-06 | `2.40` | Tarifas del profesional | qué estimados afecta y quién selecciona al PRO | **Resuelta 2026-07-27** (PR #455): la tarifa ajusta el estimado del detalle del trabajo del cliente una vez que hay un profesional asignado. |
| PD-07 | `2.44` | Riel de cobro | Connect/Elements/Financial Connections/Plaid | **Resuelta 2026-07-27** (PR #458): solo Stripe, sin Plaid (ver `api.payout-method-tokenization`). |

Cada decisión resuelta quedó registrada en la entrada correspondiente de
`docs/AUDIT_REMEDIATION_PLAN.md`; la fecha y el PR de esta tabla salen de ahí y
del historial de PRs. El detalle de opciones descartadas, rollback y criterio de
éxito de la sección 3 **no se reconstruyó** para las decisiones ya cerradas.

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
