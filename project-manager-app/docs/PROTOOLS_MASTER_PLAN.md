# PROTOOLS MASTER PLAN — SEMSEproject
**Versión:** 1.0
**Fecha:** 2026-05-20
**Estado:** ACTIVE
**Mantenido por:** Agentic Harness / Architecture Agent

> Este documento es la fuente de verdad del plan de desarrollo de ProTools.
> El agente lee este archivo al inicio de cada sesión para saber dónde está y qué sigue.
> Formato de estado: `PENDING` | `IN_PROGRESS` | `DONE` | `BLOCKED`

---

## Lectura Obligatoria Antes de Este Documento

1. `.specify/memory/constitution.md`
2. `docs/SPEC_INDEX.md`
3. `docs/AGENTIC_HARNESS.md` ← cómo operar en modo loop

---

## Resumen de Progreso

| Fase | Módulos | Bloques Total | Completados | % |
|---|---|---|---|---|
| Fase 1 — Fundación Financiera | 4 | 17 | 0 | 0% |
| Fase 2 — Protección Legal | 3 | 13 | 0 | 0% |
| Fase 3 — IA Proactiva | 3 | 16 | 0 | 0% |
| Fase 4 — Ecosistema | 3 | 9 | 0 | 0% |
| Fase 5 — ML y Escala | 3 | 9 | 0 | 0% |
| **TOTAL** | **16** | **64** | **0** | **0%** |

---

## FASE 1 — Fundación Financiera y Datos Vivos

**Objetivo:** Hacer que las estimaciones usen datos reales y que los pagos fluyan realmente.
**Spec folder:** `docs/specs/tools/fase-1/`

### Módulo 1.1 — Precios de Materiales en Tiempo Real

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 1.1.A | Integrar BLS PPI API (lumber WPU081, steel, copper, drywall, concrete) | PENDING | `specs/tools/fase-1/m1.1-material-pricing.spec.md` | API gratuita, no requiere key |
| 1.1.B | Integrar EstimationPro API `/costs` y `/trades` (385 ítems, 32 oficios) | PENDING | `specs/tools/fase-1/m1.1-material-pricing.spec.md` | Free, no signup |
| 1.1.C | Integrar FRED series WPU081 para escalación mensual de lumber | PENDING | `specs/tools/fase-1/m1.1-material-pricing.spec.md` | Complementa BLS |
| 1.1.D | Capa de caché en DB: tabla `MaterialPriceSnapshot`, refresh 24h via worker | PENDING | `specs/tools/fase-1/m1.1-material-pricing.spec.md` | Nuevo modelo Prisma |
| 1.1.E | Reemplazar costos hardcoded en los 25 motores con lookup dinámico | PENDING | `specs/tools/fase-1/m1.1-material-pricing.spec.md` | Bloquea 1.1.D |

### Módulo 1.2 — Ajuste de Costos Regional

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 1.2.A | Integrar BLS OEWS API (salarios reales por oficio y metro) | PENDING | `specs/tools/fase-1/m1.2-regional-costs.spec.md` | Free |
| 1.2.B | Integrar EstimationPro `/multipliers` (índices EPCI por ciudad) | PENDING | `specs/tools/fase-1/m1.2-regional-costs.spec.md` | Free |
| 1.2.C | Añadir campo `zipCode` al input de los 25 motores de trade | PENDING | `specs/tools/fase-1/m1.2-regional-costs.spec.md` | Cambio en types.ts |
| 1.2.D | Multiplicador regional en `cost-engine.ts` (material + labor por separado) | PENDING | `specs/tools/fase-1/m1.2-regional-costs.spec.md` | Bloquea 1.2.A y 1.2.B |
| 1.2.E | Override manual: contratista puede ingresar sus tarifas reales | PENDING | `specs/tools/fase-1/m1.2-regional-costs.spec.md` | UX en apps/web |

### Módulo 1.3 — Pagos y Escrow Real (Stripe Connect)

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 1.3.A | Configurar Stripe Connect (marketplace payments, custom accounts) | PENDING | `specs/tools/fase-1/m1.3-stripe-escrow.spec.md` | Requiere cuenta Stripe |
| 1.3.B | Manual Payouts: fondos en hold hasta aprobación de milestone en FSM | PENDING | `specs/tools/fase-1/m1.3-stripe-escrow.spec.md` | Bloquea 1.3.A |
| 1.3.C | Conectar `escrow-engine.ts` con Stripe (liberación automática en FSM) | PENDING | `specs/tools/fase-1/m1.3-stripe-escrow.spec.md` | Artículo IV constitución |
| 1.3.D | Fee de plataforma SEMSE: 0.75% deducido automáticamente en payout | PENDING | `specs/tools/fase-1/m1.3-stripe-escrow.spec.md` | Stripe Connect fee split |
| 1.3.E | Verificación de cuentas bancarias vía Plaid (ACH onboarding) | PENDING | `specs/tools/fase-1/m1.3-stripe-escrow.spec.md` | $0.30/verificación |

### Módulo 1.4 — Contratos y Firmas Digitales

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 1.4.A | Integrar HelloSign (Dropbox Sign) API para contratos y change orders | PENDING | `specs/tools/fase-1/m1.4-contracts.spec.md` | $15/mes flat SMB |
| 1.4.B | Templates de contrato por oficio, pre-llenados desde `SemseToolResult` | PENDING | `specs/tools/fase-1/m1.4-contracts.spec.md` | 25 templates |
| 1.4.C | Flujo: quote aprobado → contrato generado → firma → escrow activo | PENDING | `specs/tools/fase-1/m1.4-contracts.spec.md` | FSM gate |

---

## FASE 2 — Protección Legal y Cumplimiento

**Objetivo:** Proteger al contratista automáticamente de demandas y disputas.
**Spec folder:** `docs/specs/tools/fase-2/`

### Módulo 2.1 — Gestión de Lien Rights (50 estados)

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 2.1.A | Integrar LienGrid API (deadlines automáticos, 50 estados) | PENDING | `specs/tools/fase-2/m2.1-lien-rights.spec.md` | Pay-per-notice |
| 2.1.B | Al crear proyecto: capturar datos → generar calendario de deadlines | PENDING | `specs/tools/fase-2/m2.1-lien-rights.spec.md` | Nuevo modelo `LienCalendar` |
| 2.1.C | Alertas automáticas: 30 días, 7 días, 3 días antes de deadline | PENDING | `specs/tools/fase-2/m2.1-lien-rights.spec.md` | BullMQ job scheduler |
| 2.1.D | Generación de preliminary notices pre-poblados desde datos del proyecto | PENDING | `specs/tools/fase-2/m2.1-lien-rights.spec.md` | Template por estado |
| 2.1.E | Envío de correo certificado digital vía Lob.com API (~$5/carta) | PENDING | `specs/tools/fase-2/m2.1-lien-rights.spec.md` | Integración externa |
| 2.1.F | Lien waivers condicionales/incondicionales en flujo de pagos | PENDING | `specs/tools/fase-2/m2.1-lien-rights.spec.md` | Artículo III constitución |

### Módulo 2.2 — Documentación Anti-Disputas

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 2.2.A | Foto timestamping + GPS obligatorio en upload de evidencia | PENDING | `specs/tools/fase-2/m2.2-dispute-docs.spec.md` | EXIF + geolocation API |
| 2.2.B | Daily logs automáticos: registro diario de trabajo, clima, crew | PENDING | `specs/tools/fase-2/m2.2-dispute-docs.spec.md` | Nuevo módulo `DailyLog` |
| 2.2.C | Change order trail: firma digital obligatoria antes de proceder | PENDING | `specs/tools/fase-2/m2.2-dispute-docs.spec.md` | FSM gate en change-orders |
| 2.2.D | Extended metrics completas en los 20 trades que las tienen mínimas | PENDING | `specs/tools/fase-2/m2.2-dispute-docs.spec.md` | Ver lista en 3.2 |
| 2.2.E | Export bundle PDF con toda la evidencia del proyecto | PENDING | `specs/tools/fase-2/m2.2-dispute-docs.spec.md` | `export-engine.ts` |

### Módulo 2.3 — Integración de Clima (Tomorrow.io)

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 2.3.A | Integrar Tomorrow.io API: alertas por proyecto (viento, lluvia, helada) | PENDING | `specs/tools/fase-2/m2.3-weather.spec.md` | $0–$300/año SMB |
| 2.3.B | Tarea afectada por clima → log automático → base para change order | PENDING | `specs/tools/fase-2/m2.3-weather.spec.md` | BullMQ + FSM |
| 2.3.C | Alertas específicas: granizo/helada para concreto y roofing | PENDING | `specs/tools/fase-2/m2.3-weather.spec.md` | Trade-aware alerts |

---

## FASE 3 — Inteligencia Artificial Proactiva

**Objetivo:** SEMSE avisa antes de que los problemas ocurran.
**Spec folder:** `docs/specs/tools/fase-3/`

### Módulo 3.1 — Agentes de Alertas Proactivas (Regla-Basados)

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 3.1.A | **Agente Budget Burn**: gasto real vs. estimado → alerta si margen cae >5% | PENDING | `specs/tools/fase-3/m3.1-proactive-agents.spec.md` | Determinista |
| 3.1.B | **Agente Lien Deadline**: calendario → notificación push/email automático | PENDING | `specs/tools/fase-3/m3.1-proactive-agents.spec.md` | Determinista, bloquea 2.1 |
| 3.1.C | **Agente Scope Creep**: compara scope aprobado vs. field notes con NLP | PENDING | `specs/tools/fase-3/m3.1-proactive-agents.spec.md` | LLM ligero |
| 3.1.D | **Agente Clima-Schedule**: clima adverso → flagea tareas automáticamente | PENDING | `specs/tools/fase-3/m3.1-proactive-agents.spec.md` | API-driven, bloquea 2.3 |
| 3.1.E | **Agente Milestone Overdue**: milestone atrasado → alerta + reordenamiento | PENDING | `specs/tools/fase-3/m3.1-proactive-agents.spec.md` | Determinista |
| 3.1.F | **Agente Cash Flow Risk**: burn rate vs. próximos pagos → alerta liquidez | PENDING | `specs/tools/fase-3/m3.1-proactive-agents.spec.md` | Determinista |

### Módulo 3.2 — Extended Metrics Completas en Todos los Trades

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 3.2.A | Confidence score en los 20 trades sin él (carpentry, hvac, plumbing, etc.) | PENDING | `specs/tools/fase-3/m3.2-extended-metrics.spec.md` | 20 archivos |
| 3.2.B | Dispute risk score en todos los 25 trades | PENDING | `specs/tools/fase-3/m3.2-extended-metrics.spec.md` | dispute-risk-engine |
| 3.2.C | Production schedule en trades estructurales (concrete, roofing, framing) | PENDING | `specs/tools/fase-3/m3.2-extended-metrics.spec.md` | 8 trades |
| 3.2.D | Hidden damage assessment en plumbing, HVAC, siding, electrical | PENDING | `specs/tools/fase-3/m3.2-extended-metrics.spec.md` | 4 trades |
| 3.2.E | Algorithm trace estandarizado en los 25 trades | PENDING | `specs/tools/fase-3/m3.2-extended-metrics.spec.md` | Auditoría |

### Módulo 3.3 — Calibración de Labor (NECA / PHCC / RSMeans)

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 3.3.A | Evaluar y seleccionar fuente: RSMeans Complete vs. NECA/PHCC directo | PENDING | `specs/tools/fase-3/m3.3-labor-calibration.spec.md` | Decisión de licencia |
| 3.3.B | Calibrar `labor-engine.ts` eléctrico con unidades NECA | PENDING | `specs/tools/fase-3/m3.3-labor-calibration.spec.md` | Bloquea 3.3.A |
| 3.3.C | Calibrar plomería y HVAC con unidades PHCC/SMACNA | PENDING | `specs/tools/fase-3/m3.3-labor-calibration.spec.md` | Bloquea 3.3.A |
| 3.3.D | Factores de desperdicio estándar por material en `material-engine.ts` | PENDING | `specs/tools/fase-3/m3.3-labor-calibration.spec.md` | Tablas waste factor |
| 3.3.E | Validar estimaciones contra proyectos reales completados | PENDING | `specs/tools/fase-3/m3.3-labor-calibration.spec.md` | Requiere datos reales |

---

## FASE 4 — Ecosistema e Integraciones

**Objetivo:** SEMSE como hub central del flujo de trabajo del contratista.
**Spec folder:** `docs/specs/tools/fase-4/`

### Módulo 4.1 — Contabilidad

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 4.1.A | QuickBooks Online API: sync invoices, pagos, clientes, cuentas | PENDING | `specs/tools/fase-4/m4.1-accounting.spec.md` | OAuth 2.0, crítico para adopción |
| 4.1.B | QuickBooks Desktop: bridge para contratistas tradicionales | PENDING | `specs/tools/fase-4/m4.1-accounting.spec.md` | IIF/QBW file exchange |
| 4.1.C | Xero: integración para segmento alternativo | PENDING | `specs/tools/fase-4/m4.1-accounting.spec.md` | Fase tardía |

### Módulo 4.2 — Geolocalización y Permisos

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 4.2.A | Google Maps API: ubicación del proyecto, direcciones field crews | PENDING | `specs/tools/fase-4/m4.2-geo-permits.spec.md` | $200/mes free tier |
| 4.2.B | OpenGov API: tracking de permisos e inspecciones por dirección | PENDING | `specs/tools/fase-4/m4.2-geo-permits.spec.md` | REST API disponible |
| 4.2.C | Google Aerial View: imagen aérea para estimación visual | PENDING | `specs/tools/fase-4/m4.2-geo-permits.spec.md` | Diferenciador visual |

### Módulo 4.3 — Comunicaciones de Campo

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 4.3.A | WhatsApp Business API: notificaciones a subcontratistas | PENDING | `specs/tools/fase-4/m4.3-field-comms.spec.md` | Spec existente en api/communications |
| 4.3.B | SMS via Twilio: alertas críticas de deadline y milestone | PENDING | `specs/tools/fase-4/m4.3-field-comms.spec.md` | $0.0075/SMS |
| 4.3.C | Field ops mobile: check-in de crew, fotos, worklogs desde campo | PENDING | `specs/tools/fase-4/m4.3-field-comms.spec.md` | PWA o React Native |

---

## FASE 5 — Inteligencia ML y Escala

**Objetivo:** Scoring predictivo basado en datos históricos + ecosistema abierto.
**Spec folder:** `docs/specs/tools/fase-5/`

### Módulo 5.1 — Risk Scoring basado en Datos Históricos

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 5.1.A | Pipeline de datos: proyectos completados → tabla `ProjectOutcome` | PENDING | `specs/tools/fase-5/m5.1-ml-risk.spec.md` | Data foundation |
| 5.1.B | Modelo de scoring: presupuesto vs. real por trade, región, tamaño | PENDING | `specs/tools/fase-5/m5.1-ml-risk.spec.md` | Bloquea 5.1.A |
| 5.1.C | Benchmarking: "tu estimado está 12% sobre el promedio en roofing Miami" | PENDING | `specs/tools/fase-5/m5.1-ml-risk.spec.md` | UX insight |
| 5.1.D | Predicción de delay basada en patterns históricos | PENDING | `specs/tools/fase-5/m5.1-ml-risk.spec.md` | ML model |

### Módulo 5.2 — API Pública y Ecosistema

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 5.2.A | API pública de los 25 motores de estimación (para partners) | PENDING | `specs/tools/fase-5/m5.2-public-api.spec.md` | Rate limiting, API keys |
| 5.2.B | Webhooks para integraciones de terceros | PENDING | `specs/tools/fase-5/m5.2-public-api.spec.md` | HMAC-256 validation |
| 5.2.C | White-label: contratistas grandes usan SEMSE como su propio sistema | PENDING | `specs/tools/fase-5/m5.2-public-api.spec.md` | Multi-tenant theming |

### Módulo 5.3 — Monetización

| ID | Bloque | Estado | Spec | Notas |
|---|---|---|---|---|
| 5.3.A | **Starter $99/mes**: 5 trades, 3 usuarios, estimación básica | PENDING | `specs/tools/fase-5/m5.3-monetization.spec.md` | Tier 1 |
| 5.3.B | **Professional $249/mes**: 25 trades, 10 usuarios, change orders, lien | PENDING | `specs/tools/fase-5/m5.3-monetization.spec.md` | Tier 2 |
| 5.3.C | **Business $499/mes**: ilimitado, AI agents, live pricing, API access | PENDING | `specs/tools/fase-5/m5.3-monetization.spec.md` | Tier 3 |
| 5.3.D | **Transaction fee 0.75%** en pagos gestionados por escrow | PENDING | `specs/tools/fase-5/m5.3-monetization.spec.md` | Revenue escalable |

---

## Cómo Actualizar Este Documento

Cuando un agente completa un bloque:
1. Cambiar `PENDING` → `DONE` en la tabla del bloque
2. Actualizar el contador de "Completados" en el Resumen de Progreso
3. Actualizar `%` de la fase correspondiente
4. Añadir link al reporte de implementación en `docs/reportes/`

Cuando un agente inicia un bloque:
1. Cambiar `PENDING` → `IN_PROGRESS`
2. Registrar fecha de inicio en Notas

Cuando hay un bloqueo:
1. Cambiar a `BLOCKED`
2. Documentar motivo en Notas
3. Escalar en el siguiente ciclo de sesión

---

## Dependencias Críticas Entre Bloques

```
1.1.D → 1.1.E  (caché antes de reemplazar costos hardcoded)
1.2.A → 1.2.D  (datos OEWS antes del multiplicador en cost-engine)
1.3.A → 1.3.B  (Stripe Connect antes de manual payouts)
1.3.B → 1.3.C  (payouts antes de conectar con escrow-engine)
2.1.A → 2.1.B  (LienGrid antes del calendario de deadlines)
2.1.B → 2.1.C  (calendario antes de alertas automáticas)
2.3.A → 2.3.B  (Tomorrow.io antes de logs automáticos de clima)
3.1.B → 2.1    (agente lien deadline requiere módulo 2.1 completo)
3.1.D → 2.3    (agente clima requiere módulo 2.3 completo)
3.3.A → 3.3.B,C (decisión de licencia antes de calibrar motores)
5.1.A → 5.1.B,C,D (datos históricos antes de cualquier ML)
```
