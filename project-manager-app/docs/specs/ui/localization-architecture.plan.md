---
type: plan
feature: "localization-architecture"
domain: "ui"
spec: "docs/specs/ui/localization-architecture.spec.md"
version: "2.0"
status: "DRAFT"
branch: "docs/i18n-architecture-audit-20261018"
date: "2026-10-26"
---
# Plan técnico: Internacionalización ES/EN

> Documento preparatorio, SDD todavía REVIEW. No autoriza ejecutar ningún spike de código ni publicar traducciones.

## 1. Snapshot de verdad
- Base del análisis reconciliada: `main` commit `c6d4d323` (2026-10-26); verificar nueva base si cambia antes de implementar.
- PR #968, #969, #970 están fusionados; #973 permanece abierto sujeto a #974/#987.
- Proveedor actual Web: `useLanguage`, diccionario plano ES/EN, `localStorage`; wizard de cuatro pasos en texto español fijo, moneda USD con `en-US` fijo (evidencia histórica auditada).
- Auditoría estática de fuente en `main` (2026-10-26): 1,182 claves ES / 1,182 EN, paridad en extracción textual sin duplicadas detectadas; `User` y `UserProfile` Prisma sin campos de locale por los nombres inspeccionados. Método, límites y D4-A/B en [analyze](localization-architecture.analyze.md).
- SHA de Railway Web/API, estado de flags y migraciones: **NO VERIFICADOS EN ESTE PR**. No inferir de CI.
- Gobernanza: DEC-PLATFORM-001 por niveles y revisión bilingüe/legal para texto crítico.

## 2. Constitution check
- [ ] Especificación APPROVED antes de código (bloqueante).
- [x] Propuesta de roles/tenant/org/RBAC, invariantes económicos y privacidad documentada.
- [ ] D1 runtime único decidido y ADR aceptado.
- [ ] D4 fuente de preferencia y migración decidida.
- [x] API, CI, merge, deploy y activación separadas; sin proveedor externo de MT.
- [ ] Tests rojos escritos ANTES de implementación; smoke autenticado separado de E2E legacy.

## 3. Arquitectura y autoridad
- Fuente de textos: catálogos Git JSON por dominio, editorial metadata separada.
- Autoridad de datos/acciones: API y Prisma actuales, **no la traducción**.
- UI: `language-context.tsx` compatibilidad de claves; sólo un runtime tras ADR D1.
- Sesión: middleware Node.js existente conserva rutas y controles. Cookie/account SSR sólo según D4.
- Adjunto/draft: `job-wizard-draft` y `sessionStorage`; preservar archivos y datos en cambio de idioma.
- Proveedores de traducción y Prometeo privado: fuera de alcance hasta aprobaciones y P0 #974/#987.

## 4. Datos y migración
- Variante D4-A: no tocar Prisma, cookie validada para SSR y preferencia cliente; probar persistencia/limitaciones.
- Variante D4-B: nuevo campo de preferencia en cuenta y endpoint auth; requiere migration_status=PENDING, SQL/checksum, expand/contract, backfill explícito, rollback y pruebas de PostgreSQL. **No elegido**.
- Catálogos: despliegue con versión/digest inmutable; rollback de mensajes sin reescribir documentos firmados ni cambios de negocio.
- Drift y feature flags: inventariar antes de código; no ejecutar `db push`.

## 5. Seguridad
- Cero lectura cross-tenant/cross-org; una cookie no reemplaza autorización.
- Tratar originales privados y texto derivado como datos sujetos a ACL por objeto en cada lectura.
- Prohibir información sensible y traducciones privadas en logs/cachés compartidos.
- Cambios en auth/DB/privacidad se clasifican según DEC-PLATFORM-001; nivel 3 requiere revisión externa real.

## 6. Eventos, idempotencia y reconstrucción
- No producir eventos de negocio por cambiar idioma.
- Editar catálogos no cambia FSM de hito, evidencia, Jobs ni pagos.
- Formulario y `POST` sólo una vez; pruebas de reintento y rollback.
- Registro editorial: hashes Git, versión, reviewer/approvedAt y provenance sin PII.

## 7. Estrategia de implementación
### A — Pruebas y contratos
- Inventariar string sources reales y claves tras PRs fusionados.
- Diseñar AST parser de catálogos que detecte duplicados, valores vacíos, parámetros, ICU, digests.
- Tests negativos y casos L01–L12 definidos en checklist antes de código.
### B — Runtime y datos
- Spike controlado `useLanguage` vs `next-intl` bajo ADR D1; no crear segunda fuente de traducción.
- D4 puede implicar PR separado de Prisma/migración sólo si se aprueba.
### C — API/BFF/UI
- Localizar wizard, accesibilidad, validación, errores, mensajes de API y datos formateados.
- Conservar payloads, archivo adjunto, IDs, moneda, timeZone, estado y RBAC.
### D — Verificación local
- Tests dirigidos → build/typecheck/lint → spec tooling; auditoría de brechas y reporte de evidencia.
### E — Integración
- Revisiones según nivel real y CI sobre head final; retarget/reconciliar sin mezclar cambios ajenos.
### F — Producción
- Sólo tras permisos: canary con usuarios autorizados, smoke ES/EN por rol, métricas y rollback verificado.

## 8. Riesgos
| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Hydration locale distinto del servidor | media | alta | Tests concurrentes y fuente SSR consistente | Texto alterna o marca HTML lang incorrecta |
| Cambio idioma pierde draft/adjuntos | media | alta | E2E cambio mitad de wizard/archivo | Pérdida de valores o POST duplicado |
| Texto jurídico desactualizado | media | crítico | digest y revisión legal | Conteo claves high-risk stale > 0 |
| ACL cruzada en contenido futuro | baja | crítico | #974/#987, negativas org A/B | Una sola lectura indebida |
| Migración de cuenta innecesaria | media | media | ADR D4 y expand/contract | Error de sesión o upgrade |

## 9. Investigación externa
| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| Next 15 App Router internationalization | https://nextjs.org/docs/15/app/guides/internationalization | Mantener SSR y locale explícitos |
| next-intl auth / middleware | https://next-intl.dev/docs/routing/middleware | Spike aislado, no sustituir autenticación |
| Microsoft internationalization testing | https://learn.microsoft.com/en-us/globalization/testing/how-to-perform-internationalization-testing | Pseudolocale y smoke funcional real |

## 10. Gates antes de tareas
- [x] Archivos e invariantes en SDD; scope documental pequeño.
- [ ] D1–D7 y ADR aceptados.
- [ ] D4 datos/migración confirmados.
- [ ] Test rojo demuestra el gap en entorno de staging.
- [ ] Política de rollback, canary, reviewer y pruebas de cada PR ratificadas.
