# Remediación de seguridad en jobs y labor — 2.8, 2.9 y 2.27

**Fecha:** 2026-07-23

**Rama:** `fix/audit-money-security-batch-v2`

**Items del `AUDIT_REMEDIATION_PLAN.md`:** 2.8 (CRÍTICO), 2.9 (ALTO) y 2.27 (ALTO)

## Resumen

Se cerraron tres riesgos de integridad y exposición:

- **2.8 — descansos negativos:** frontend y backend normalizan `breakMinutes` a cero antes de calcular o persistir duración pagable.
- **2.9 — referencias ajenas en labor:** iniciar un timer o crear una entrada manual exige que el job esté asignado al worker o que el proyecto libre le pertenezca.
- **2.27 — jobs cross-org:** listado y detalle aplican visibilidad por rol; un CLIENT no recibe jobs de otra organización y un PRO/WORKER no recibe borradores privados ajenos.

## Cambios

### Integridad de tiempo pagable

- `worker/tracker/page.tsx` deriva un único `manualBreakMinutes` no negativo para preview y payload.
- `LaborEngineRepository.createTimeEntry()` clampa el descanso antes de calcular `durationMinutes` y antes de persistirlo.
- El test de repositorio reproduce el exploit original: una sesión de cuatro horas con `breakMinutes: -30` queda en 240 minutos y descanso cero.

### Ownership de jobs y proyectos libres

- `LaborEngineService` valida `jobId` y `freeProjectId` antes de crear cualquier `TimeEntry`.
- Un job es válido solo dentro del tenant y cuando existe una relación por bid aceptado, reserva activa/aceptada, contrato o proyecto asignado.
- Un proyecto libre exige coincidencia de tenant y `createdBy`.
- Las referencias ajenas se rechazan sin escribir una entrada.

### Visibilidad de jobs

- Controller y servicio propagan `actor.roles`.
- `JobsRepository` centraliza una política común para listado y detalle:
  - `OPS_ADMIN`: visibilidad tenant-wide.
  - `CLIENT`: solo `clientOrgId === actor.orgId`.
  - `PRO/WORKER`: marketplace `POSTED`/`PUBLISHED` y jobs donde participa por bid, reserva, contrato o proyecto.
  - rol desconocido: fallback seguro a la organización propia.
- Para actores con roles `CLIENT+PRO`, prevalece la vista PRO, consistente con la selección de rol de la aplicación.
- `GET /v1/jobs/:jobId` devuelve 403 cuando el job existe en el tenant pero no es visible para el actor, y 404 cuando no existe.

## Regresiones añadidas

- `apps/api/test/labor-engine.repository.test.ts`: clamp server-side y cálculo de duración.
- `apps/api/test/labor-engine.service.test.ts`: rechazo de `jobId` y `freeProjectId` ajenos.
- `apps/api/test/jobs.repository.test.ts`: política por rol, precedencia dual-role y rechazo del detalle cross-org.
- `apps/api/test/jobs.controller.test.ts`: propagación de roles en listado y detalle.

## Validación local

- Build de `@semse/api`: pasa.
- Typecheck de `@semse/web`: pasa.
- Lint de fuentes API modificadas: 0 errores.
- Lint de `worker/tracker/page.tsx`: pasa.
- Pruebas enfocadas finales: **19/19 pasan**.
- Suite unitaria raíz: **944 pasan, 5 omitidas, 0 fallos**.
- Suite unitaria API: **1964 pasan, 1 fallo**.
- Validador de specs en modo estricto: **94 specs, 0 errores, 0 advertencias**.

El único fallo de API es preexistente y específico de Windows: `graphify.service.test.ts` compara el sufijo `graphify-out/graph.json` con separadores POSIX, mientras el runtime devuelve `graphify-out\graph.json`. No toca los módulos remediados.

## Alcance diferido por gobernanza

- **1.1–1.3 (confirmaciones UI de dinero/disputa):** `docs/specs/ui/client-flows-remediation.spec.md` permanece en `DRAFT`; no se incorporaron cambios de producto sin aprobación.
- **2.35 (creación de viajes):** no existe aún una spec de dominio de viajes en `docs/SPEC_INDEX.md`; se difirió hasta definir el contrato.
- El trabajo previo de esos puntos se preservó localmente en el snapshot `909e4b4b` de la rama `fix/audit-money-security-batch`; no forma parte de esta rama activa.

## Riesgos residuales y pendiente

- Falta verificación en vivo con cuentas CLIENT, PRO y OPS_ADMIN para confirmar los payloads y respuestas 403/404.
- No existe logging histórico suficiente para descartar explotación previa. Conviene auditar jobs privados consultados antes del fix y `TimeEntry` `job_linked` sin una asignación válida al `createdBy`.
- No se consultó ni modificó una base de datos productiva en esta sesión.
- Los agregadores del workspace mantienen deuda de portabilidad en Windows; se usaron comandos equivalentes explícitos.

## Rollback

Revertir el commit final de remediación restaura el comportamiento anterior. No hay migraciones de base de datos ni cambios de datos que deshacer.
