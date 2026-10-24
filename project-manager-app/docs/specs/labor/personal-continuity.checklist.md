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