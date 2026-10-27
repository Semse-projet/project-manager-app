---
type: tasks
feature: "localization-architecture"
domain: "ui"
plan: "docs/specs/ui/localization-architecture.plan.md"
version: "2.0"
status: "PENDING"
branch: "docs/i18n-architecture-audit-20261018"
date: "2026-10-26"
---
# Tareas: Internacionalización ES/EN

> Sólo hay documentación en este PR. Todas las tareas de código y pruebas runtime permanecen pendientes.

## Fase 0 — Decisiones previas
- [x] T-001 Consolidar SDD, plan, tareas y checklist como borradores.
- [ ] T-002 Aprobar D1–D7, ADR canónico para el runtime y decisión de D4.
- [ ] T-003 Inventariar catálogo y hardcodes en main actual, no usar paridad histórica como cobertura.
- [ ] T-004 Capturar estado de producción/flags/migraciones sin tocar producción.
- [ ] T-005 Resolver revisiones críticas y registrar aprobación del propietario según DEC-PLATFORM-001.

## Fase 1 — Tests primero
- [ ] T-010 Tests de detección real de duplicados AST/JSON, claves faltantes, placeholders, plurales, valores vacíos y digest (I18N-01..07).
- [ ] T-011 Tests de rechazo: traducción crítica stale/unreviewed, HTML inseguro, fallback técnico y errores de API (I18N-03/06/07/09).
- [ ] T-012 **Ampliar pruebas existentes**, no duplicarlas: `tests/unit/language-preference-cookie.test.ts` y SSR/cambio de cookie, concurrencia A/B, sesión/permisos, caché, modo privado, datos de usuario y `html.lang` (I18N-08/13).
- [ ] T-013 Playwright para adjuntos, drafts, validación, prefill, cambiar idioma y ausencia de POST duplicado (L01/L02/L05/L07).
- [ ] T-014 Snapshot payload exacto de importe minor units, currency, IDs, status, `canRelease` (L03/L04/L11).
- [ ] T-015 Pseudolocalización móvil, accesibilidad y rollback (L08/L12).

## Fase 2 — Arquitectura y catálogos
- [ ] T-020 Spike comparativo de runtime en rama separada tras APPROVED.
- [ ] T-021 Elevar [ADR-046](../../architecture/ADR-046-semse-ui-localization-runtime.md) de PROPOSED a ACCEPTED tras comparación D1/D3/D4; no agregar dos librerías simultáneas.
- [ ] T-022 Extraer módulos JSON y adaptador de claves, glosario/metadatos con aprobaciones reales.
- [ ] T-023 Respetar cookie SSR de navegador ya implementada en `main`; sólo si D4-B selecciona persistencia de cuenta, diseñar nuevo contrato autenticado y Prisma expand/contract con pruebas PostgreSQL reales.

## Fase 3 — Interfaz y API
- [ ] T-030 Localizar pasos del wizard, aria labels, placeholders, errores, formatos de tiempo/dinero y vacíos.
- [ ] T-031 Mantener continuidad del borrador, archivos y sesión y los mismos payloads económicos.
- [ ] T-032 Errores API con código semántico y parámetros filtrados; no traducir respuestas libres de terceros.
- [ ] T-033 No cambiar policy ni activar MT en Prometeo (#974/#987).

## Fase 4 — Verificación local y CI
- [ ] T-040 Pruebas unitarias y de integración; typecheck, lint, build; validación de cobertura y catálogo.
- [ ] T-041 `spec:validate:strict`, `spec:audit-plan-coverage`, `spec:index:check` sin errores.
- [ ] T-042 Smoke ES/EN autenticado CLIENT/PRO/WORKER/OPS_ADMIN, móvil y desktop, con evidencias.
- [ ] T-043 Revisión bilingüe y legal de pagos, disputas, ofertas, consentimientos y firmas.

## Fase 5 — Revisión y fusión por PR
- [ ] T-050 Asegurar pruebas sobre HEAD final y revisión automatizada independiente conforme al riesgo.
- [ ] T-051 Validar 24h si es nivel 2, y revisión humana externa si pasa a nivel 3.
- [ ] T-052 Merge sólo tras aprobación expresa, registrar SHA y no inferir desplegado.

## Fase 6 — Despliegue y activación
- [ ] T-060 Deploy/health/readiness reales, canary autorizado y rollback ensayado.
- [ ] T-061 Verificar invariantes económicos y aislamiento tras deploy.
- [ ] T-062 Actualizar metadata de entrega y evidencia; sólo entonces aspirar a VERIFIED.

## Criterio de terminado
- [ ] Contratos aprobados, todos los casos L01–L12 PASS y recursos high-risk revisados.
- [ ] CI PASS / Merge MERGED / Deploy DEPLOYED / Activación CANARY o ACTIVE documentados individualmente.
- [ ] Cero claves técnicas visibles, regresiones de autorización o datos perdidos.
