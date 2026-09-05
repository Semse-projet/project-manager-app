# Reporte de implementación — SEMSE OS Control Plane F1–F3

**Fecha:** 2026-07-19  
**Spec:** `platform.semse-os-control-plane`  
**Resultado:** COMPLETE_WITH_F4_PLUS_BLOCKED  
**Entorno:** workspace local; waiver Git aprobado; sin deploy ni producción

## Cadena de autoridad

| Artefacto | Digest |
| --- | --- |
| Tasks aprobado para ejecutar F1–F3 | `sha256:3944e09d5ee55c84f2172847b61979e54cae0b62988e8c573e55e0094bcfd2ae` |
| Plan resultante de F0 | `sha256:0061f87bd22fc6f0d29b8c5827b8a31c2e55a277af5cb04a8dd110308405d489` |
| Tasks después de registrar resultados | `sha256:20a60e08d6d6d5aadf5aa9652405536307f461f522b0baa7c22f4a9ae56a0aaa` |
| Bundle de 24 artefactos source/test F1–F3 | `sha256:fbea305b3e884783f9f6bded1d4cd9e34939716f7d4a23318336c042a9e966b0` |
| Lockfile final | `sha256:2289dcd4082502f4ef1e0549f59067276fdcb0da479e5620febc939e679e3643` |

El bundle se calculó sobre líneas `relativePath:sha256`, ordenadas por path.
Incluye los schemas, source/config del paquete puro, fixtures y nueve archivos de
test autorizados; excluye `dist` generado y documentación.

## Resultado por fase

### F1 — tests antes del código

- Se crearon cinco fixtures: válido, dependencia incompatible, secreto literal,
  tag mutable y command injection.
- El baseline rojo produjo cuatro fallos `ERR_MODULE_NOT_FOUND` exclusivamente
  por F2/F3 ausentes. Quince contratos F4+ estaban `skip`; no falló el runner ni
  la lectura de fixtures.
- Los tests finales cubren FSM, manifest/provenance, semver/dependencias,
  planner/digests, policy/approvals y el protocolo cerrado del executor.
- Los contratos API, PostgreSQL, worker, adapter real y runtime local siguen
  explícitamente omitidos con la tarea futura que los desbloquea.

### F2 — schemas compartidos

Se añadió `capability-control-plane.schema.ts` y su export canónico. Los objetos
Zod son estrictos para manifest, installation, operation, plan, approval, grant,
executor request y receipt. Los contratos aplican:

- semver/rangos y digests SHA-256;
- imagen por digest inmutable y rechazo de `latest`;
- `SecretReference` por handle, sin secretos literales;
- acciones cerradas, timeout máximo, grant máximo de dos minutos;
- executor request sin command/cwd/Compose;
- output limitado a 32 KiB y rechazo de secretos sin redacción.

### F3 — `@semse/control-plane`

Se creó un paquete ESM sin dependencias runtime con:

- parser estricto, compatibilidad semver y trust policy explícita de
  publisher/attestation;
- FSM canónica con guards y exigencia de AuditLog/evento por transición;
- resolución estable de dependencias, plan canónico y digest determinista;
- policy default-deny, separation of duties, modo single/dual, expiración y
  binding a operation/digest/revision/target;
- interface `RuntimeAdapter` y cinco operaciones Compose cerradas, sin
  implementación de Docker.

La búsqueda negativa no encontró NestJS, Prisma, BullMQ, `child_process`,
Docker, filesystem, network, environment ni packages de agentes en el core.

## Verificación final

| Verificación | Resultado |
| --- | --- |
| Build `@semse/schemas` | PASS |
| Build `@semse/control-plane` | PASS |
| Selección F1–F3 | 17 pass, 0 fail, 17 skip futuros |
| `pnpm spec:validate:strict` | 78 specs, 0 errors, 0 warnings |
| Regresiones `spec-lib` + `local-container-contract` | 5 pass, 0 fail |
| 19 manifests preexistentes | 0 cambios de digest |
| `pnpm-lock.yaml` | digest original restaurado/verificado |

El warning existente de `apps/assistant-portal` sobre `pnpm.overrides` no fue
corregido porque ese manifest está fuera del scope aprobado.

## Incidente resuelto durante la instalación

La primera instalación autorizada con Corepack y `--frozen-lockfile` terminó
correctamente desde cache. Tras crear el manifest nuevo de T-030, una segunda
comprobación de instalación reconoció el lockfile como actualizado, pero intentó
restaurar paquetes opcionales de esbuild, quedó colgada y añadió el importer
vacío `packages/control-plane: {}` al lockfile. Se detuvo únicamente el proceso
pnpm afectado, se retiró ese importer y se comprobó el SHA-256 original exacto.
Los dos builds y todos los tests volvieron a pasar después de la restauración.

Consecuencia documentada: un futuro install limpio puede querer registrar el
importer vacío del paquete nuevo. Como el owner prohibió modificar el lockfile,
esa actualización no forma parte de F1–F3 y requiere autorización separada.

## Límites preservados y trabajo pendiente

- T-006 continúa bloqueada: Docker Desktop/WSL 2 no están disponibles.
- F4+ (T-040..T-099) continúa sin autorización.
- No se tocó Prisma, migrations, `apps/api/src`, worker product code, executor,
  Docker, Railway, deploy, CI/CD ni producción.
- No se creó rama, commit ni push conforme al waiver Git.
- La evidencia es verificación local del builder; los reviewers independientes
  de Security/Governance y QA siguen reservados para F9.

Estado del grafo al cierre: **34 completas, 1 bloqueada y 55 pendientes**.

