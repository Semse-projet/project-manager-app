---
type: checklist
feature: "personal-continuity"
spec: "docs/specs/labor/personal-continuity.spec.md"
version: "2.0"
date: "2026-10-24"
---

# Checklist F1B — Independencia de cuenta, acceso y conservación

## Decisiones y alcance

- [x] F1B está marcado `DRAFT/NOT_STARTED/NOT_RUN/UNMERGED/INACTIVE`.
- [x] Una cuenta `User` no equivale a permiso cross-tenant, y Org no equivale a cuenta personal.
- [x] ADR-WPI-002 está `Proposed` y presenta alternativas, riesgos y solución candidata.
- [x] Se mantiene una sola autoridad de tiempos, Labor Engine, y no se fusionan `Workspace` ni roles.
- [x] Login sin Membership y `onDelete: Cascade` documentados desde main.
- [ ] Owner + Identity/Auth + Security + Privacy/Legal aprueban arquitectura y clasificación.
- [ ] Autoridad de copia personal de datos creados durante ejecución de un Job definida legalmente.

## Seguridad

- [ ] Principal PERSONAL nunca es aceptado como principal empresarial en API/BFF/móvil/Worker/SSE/Prometeo.
- [ ] Sesión PERSONAL revalidada, refresh/logout/step-up y User suspendido son fail-closed.
- [ ] A/B mismo tenant y C externo no pueden acceder a archivos de otra persona.
- [ ] Suspensión Org X no otorga acceso empresarial a X ni a otro tenant.
- [ ] OPS_ADMIN o supervisor no tiene override implícito de archivo personal.
- [ ] Logs, métricas y download URLs no exponen PII, secretos, GPS ni evidencia ajena.

## Custodia y derechos

- [ ] Categorías elegibles y exclusiones de archivos de terceros aprobadas.
- [ ] Proyección derivada no crea segundo sistema TimeEntry ni cambia fuente original.
- [ ] Captura/eventos con idempotencia, procedencia, hash, revisión y outbox consistentes.
- [ ] Tenant borrado sintéticamente: copia confirmada sigue recuperable solo cuando política lo permite.
- [ ] Tenant borrado antes de captura: no se promete existencia de copia.
- [ ] Retención, borrado, versiones, correcciones, legal hold y restauración revisados.
- [ ] Datos de Job, salarios empresariales, medios/GPS excluidos por defecto.
- [ ] Protección de claves/cifrado, descarga temporal y backup/restore demostradas.

## Calidad y entrega

- [ ] Integración con F1A/#1036 y programa F0/#1035 sin doble exportador.
- [ ] Pruebas negativas autenticadas A/B/C, sin Org, User suspendido y descargas.
- [ ] ES/EN y mobile/offline con estados correctos.
- [ ] Revisión Security/Auth/Privacy/DB independiente y rollback.
- [ ] Index generado y validador SDD ejecutados **al final**.
- [ ] CI terminal y merge/deploy/activación separados y con evidencia.

**Estado:** pendiente de decisiones formales y ejecución.

## G0 adicional — bloqueo del código Auth

- [ ] `@AuthenticatedAccess` en API existente es ORG-only por defecto al introducir PERSONAL; ningún controlador antiguo hereda self.
- [ ] `appRoleFromRoles([])` no puede redirigir cookie PERSONAL al dashboard `client` ni habilitar rutas organizacionales.
- [ ] `RequestContext` de Org no se rellena con `tenantId/orgId` sintéticos; principal personal distinto/validado por servidor.
- [ ] Cookie web, BFF y `sanitizeSemseIdentityHeaders` no producen identidad organizacional desde PERSONAL.
- [ ] Token HMAC propio de SEMSE (no JWT), cookie web HMAC y sesión durable poseen clase/audience estrictos, tokens viejos son ORG exclusivamente y tokens desconocidos se deniegan.
- [ ] `@RequirePermissions`, `@AuthenticatedAccess`, SSE, WebSocket y herramientas de agentes rechazan PERSONAL sin política explícita.
- [ ] Revisar `docs/reportes/2026-10-24_f1b-auth-compatibility-threat-review.md` por Security/Auth independiente antes de code GO.

## G0 — Paquete de decisiones y tests

- [x] Contrato corregido: bearer API no es JWT; formato HMAC propio de dos partes, cookie web HMAC separada.
- [x] Matriz T01–T22 propuesta, con rutas a pruebas legacy; `docs/reportes/2026-10-24_f1b-g0-session-compatibility-and-test-plan.md`.
- [ ] D-AUTH-01/02 y D-WEB-03 aprobadas por Identity/Auth/Security/Web.
- [ ] D-RECORD-04 y D-DB-05 aprobadas por Legal/Privacy/DB/Architecture.
- [ ] Nuevas rutas PERSONALES no habilitadas antes de rechazo de token PERSONAL en todos los guards ORG.
- [ ] Test real `AuthSession` y token legacy HMAC de dos segmentos + expiración/refresco/step-up.
- [ ] Test cookie web HMAC y middleware `roles=[]` no desvían a `client`.
- [ ] Resultados de T01–T22 verificables, no confundidos con el inventario documental.
- [ ] Revisión independiente y rollback, CI al final; no merge/deploy sin GO posterior.

## G0-R — Datos mínimos y versión real

- [x] Schema permite `TimeEntry` con horas y datos de nómina, ubicación, GPS, notas y referencias de obra mezclados: inventariado.
- [x] Reglas **candidatas** de campos/clases en informe G0 §8; T23–T27 agregadas como plan.
- [ ] `createdBy` y `purpose=personal` no se usan como permiso universal de retención/lectura cross-tenant.
- [ ] Legal/Privacy aprueba clases elegibles y matriz de retención; `job_linked`/`payable` no se copian implícitamente.
- [ ] `TimeEvidence`, fotos, GPS, tarifas, notas y referencias empresariales no entran a archivo personal por defecto.
- [ ] Fuente de `sourceRevision` real verificada: `updatedAt` no se presenta como historial inmutable.
- [ ] Pruebas T23–T27 escritas/ejecutadas en fase implementable, sin afirmar resultado antes de CI.
