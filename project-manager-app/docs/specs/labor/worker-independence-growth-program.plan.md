---
type: plan
feature: "worker-independence-growth-program"
domain: "labor"
spec: "docs/specs/labor/worker-independence-growth-program.spec.md"
version: "2.0"
status: "DRAFT"
branch: "docs/worker-independence-growth-20261024"
date: "2026-10-24"
---

# Plan — Independencia del trabajador, acuerdos y crecimiento profesional

> **Sólo documental.** Requiere spec de programa y specs de slice `APPROVED` antes de cualquier implementación. No ejecutar un programa F0–F5 como un solo PR.

## 1. Snapshot AS-IS (documentos de main, 2026-10-24)

- `labor.engine-remediation`: `TimeEntry purpose=personal` es visible solo al autor `createdBy`, y queda fuera del agregado administrativo.
- `labor.free-project-mutation-guard`: FreeProject personal por autor, conversión segura al Job autorizado.
- `ADR-029`: Labor Engine único dueño de escrituras de horas, Field Ops adaptador.
- `core.universal-identity-multi-role`: cuenta `User` única y capacidades según contexto.
- `core.business-offers` BO-05: DRAFT/INACTIVE, oferta distinta del contrato jurídico, W-2/1099 fuera del payload.
- `core.labor-policy` BO-08: DRAFT/INACTIVE; horario versionado/correcciones; no nómina.
- `core.skills` BO-12: DRAFT/INACTIVE; hechos de experiencia y tokens redactados; sin insignias o licencias.
- **NO comprobado para release en este plan:** SHA desplegado en API/Web/Worker, migraciones, flags efectivamente activos, datos de producción, pruebas funcionales autenticadas. Un status del documento no prueba runtime.

## 2. Constitution / gobierno

- [ ] Aprobación del programa y ADR por owner/Architecture/Security/Privacy.
- [ ] Cada slice `APPROVED`, indexado, con plan/tareas/checklist y contrato exacto.
- [ ] Revisión de Legal/Payroll de clasificación y overtime **fuera** de la automatización.
- [ ] Ninguna nueva autoridad por el rol PRO/WORKER/CLIENT; ResourceScope y permisos por recurso obligatorios.
- [ ] No reintroducir categorías legales eliminadas de BO-05 ni niveles prohibidos por BO-12.
- [ ] No exponer secretos, PII, fotografías o datos personales en PR/test/logs.

## 3. Arquitectura / fuentes canónicas

| Recurso | Escritura canónica | Expansión futura |
|---|---|---|
| Tiempo personal y organizacional | Labor Engine `TimeEntry` | Exportación autorizada, no segundo contador |
| Proyectos personales | FreeProject `createdBy` | Enlaces autorizados a Job, sin transferencia implícita |
| Acuerdo empresa/persona | BO-05 y futuro contrato jurídico separado | No confundir oferta con firma |
| Política/corrección | BO-08 | Fuente original + propuesta + revisor |
| Portabilidad de habilidades | BO-12 | Resumen redactado; no badges sin decisión |
| Portafolio y evidencia | Evidence + permisos por recurso | Revisión de derechos de terceros |
| Cotizaciones | ProTools/Marketplace/BuildOps existentes | Integración comercial independiente |

ADR propuesto: `docs/architecture/ADR-WPI-001-personal-records-and-org-boundary.md`.

## 4. Slices de entrega (PRs separados)

### F0 — Contrato de propiedad y privacidad
1. Censo AS-IS de endpoints y datos personales/corporativos/compartidos.
2. Matriz actor × propósito × campo × recurso; procedimiento de exportación/retención y grants existentes.
3. Resolver D-01..D-08 del spec; aprobación humana de Privacy/Legal/Security.

### F1 — Exportación y continuidad personal (primera entrega funcional)
1. Pruebas de lectura negativa: dos usuarios mismo tenant, otro tenant, cambio/suspensión de Org, OPS_ADMIN y User sin Org.
2. Identificar si `TimeEntry` y FreeProject ya permiten exportación completa; si sí, integrar en vez de duplicar.
3. Si falta, spec `labor.personal-record-export` con API/schema, rango+timezone, paginación y medios permitidos; flag OFF, migración aditiva solo si imprescindible.
4. Pruebas de idempotencia offline, archivos y integridad; no mutar propiedad de `createdBy`.

### F2 — Acuerdo bilateral
Spec propia: términos versionados y discrepancias; reutilizar BO-05 según su estado real; preservar clasificación fuera de oferta, firma Documenso OFF y compensación privada.

### F3 — Conciliación
Integrar BO-08 y fuentes de pago declaradas: separar registrado, aprobado, reportado y confirmado. Revisión humana, nunca liquidación/escrow automática.

### F4 — Trayectoria profesional
Reutilizar BO-12; investigar estándares/licencias por oficio antes de diseñar niveles o insignias, consentimiento para cualquier portafolio.

### F5 — Crecimiento empresarial
Cotización por alcance, seguros/licencias, costos y margen mediante módulos existentes; no elevar permisos por tener empresa propia.

## 5. Estrategia técnica del primer slice

- **Tests primero:** acceso sin Org, mismo tenant A/B, cross-tenant, firma/compartición inexistentes, retries y revocación.
- **Schema/Zod:** solo DTO explícito y seguro; filtrar campos confidenciales por contrato backend.
- **Persistencia:** NO nueva tabla de horas; no `prisma db push`; migraciones SQL revisables y reversibles si fueran necesarias.
- **API/BFF:** permisos fail-closed y estados 401/403/404 consistentes, SSRF/URL/custodia de medios; web y móvil ES/EN.
- **Observabilidad:** auditoría de exportaciones, acceso denegado y cambios sin registrar PII/GPS.
- **Integración:** prueba A/B real autenticada en staging sintético, para evitar reportes engañosos de simulación.

## 6. Riesgos y rollback

| Riesgo | Impacto | Mitigación | Señal |
|---|---|---|---|
| BOLA/IDOR cross-tenant | Crítico | pruebas negativas, guard por `createdBy` + tenant | un usuario accede a otro |
| Fuga de compensación | Crítico | campos por audiencia y BO-05 existente | supervisor ve tarifas sin grant |
| Media/portafolio sensible | Crítico | custodia, consentimiento, URLs limitadas | archivo ajeno expuesto |
| Duplicación de horas | Alto | Labor Engine canónico, eventos idempotentes | entry doble tras sync |
| Clasificación o credencial falsa | Alto | avisos y revisión humana, no badges | UI afirma estado legal |
| Firma/pago no autorizado | Crítico | Documenso y pagos sin cambios/flag OFF | operación irreversible |

**Rollback F1:** flag OFF; no borrar históricos, retención intacta, revocación de tokens de exportación y forward-fix auditado si fuese necesario.

## 7. Gates en orden

1. Documento F0 y ADR revisados; decisiones pendientes registradas.
2. Contrato específico de F1 aprobado, todos los archivos exactos identificados.
3. Tests negativos y validación de integridad.
4. Implementación mínima reversible.
5. Revisión independiente de seguridad y gobernanza.
6. Smoke ES/EN, A/B y offline; rollback en staging.
7. **CI al final**: `pnpm spec:index`, `pnpm spec:validate:strict`, pruebas dirigidas, regresión, typecheck/build y checks terminales.
8. Registro de SHA y resultados; merge/deploy/activación solo tras autorización separada.

## 8. Investigación pendiente

- Retención legal y consentimiento por jurisdicción, permisos de obra/fotos.
- Exportaciones equivalentes ya existentes y control de signed URLs.
- Verificación profesional por autoridad/estado; interoperabilidad de BO-12.
- Reglas exactas de uso de evidencia personal en disputa sin violar secretos comerciales.

**El programa no activa ni modifica otros productos.**