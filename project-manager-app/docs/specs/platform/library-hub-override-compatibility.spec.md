---
id: "platform.library-hub-override-compatibility"
title: "SEMSE Library Hub — verificación aislada de overrides del portal"
domain: "platform"
sdd_version: "2.0"
version: "1.0"
status: "REVIEW"
owner: "semse-core"
risk: "medium"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "../.github/workflows/assistant-portal-compat.yml"
  - "package.json"
  - "pnpm-lock.yaml"
  - "apps/assistant-portal/package.json"
  - "apps/api/package.json"
  - "docs/reportes/2026-10-25_library-hub-override-compatibility.md"
related_tests:
  - "../.github/workflows/assistant-portal-compat.yml"
related_endpoints: []
related_events: []
related_agents: []
last_verified: "NOT_VERIFIED"
---

# Contrato SDD 2.0 — compatibilidad de overrides del portal (corte aislado)

**Estado REVIEW.** Se propone un único workflow efímero en GitHub Actions, sólo bajo solicitud manual o cuando cambien archivos de dependencias, esta spec o el propio workflow. No se añaden servicios persistentes, no se cambia Railway, no se modifican dependencias ni se habilita carga de librerías. Esta propuesta es **independiente** de PR #1048 (arquitectura F0) y PR #1050 (escáner F1).

## 1. Objetivo y usuarios
Operadores de SEMSE necesitan determinar si los pins intencionales del workspace continúan siendo compatibles con `assistant-portal` antes de cambiarlos o certificar un avance. Un CI global verde **no certifica este portal**: `check:assistant-portal` queda fuera de `railway:preflight` intencionalmente para no bloquear despliegues API/Web/Worker por fallos de una aplicación no desplegada allí.

## 2. Alcance y límites
- **Entradas:** `package.json` raíz (pnpm.overrides), `pnpm-lock.yaml` v9 y los manifests de `apps/assistant-portal` y `apps/api`.
- **Trabajo:** `pnpm install --frozen-lockfile`, `pnpm check:assistant-portal`, `pnpm build:assistant-portal`, con Node 22 y pnpm 10.33.0 existentes en la rama.
- **Salida:** éxito/fallo propio del workflow; nunca interpretar compilación verde como verificación de licencias/CVE/compatibilidad de producción.
- **Regla de autorización:** workflow de lectura/build/test en runner efímero; permisos `contents: read`; no tokens de Railway, no deploy, no bases de datos, no endpoints/servicios, ninguna acción humana de pagos.
- **Disparo:** `pull_request` sólo en rutas explícitas de overrides, API/portal manifests, la spec/informe o el workflow; `workflow_dispatch` opcional bajo decisión humana. Sin horario recurrente.
- No hacer `pnpm update`, `pnpm audit --fix`, modificar lock ni borrar pins automáticamente.

## 3. Evidencia y decisión de cada override
- `@types/express: 4.17.21`: documentación de julio confirma que al unificar Express v4 se resolvieron errores de tipo de `assistant-portal`; `apps/api` sigue declarando `^5.0.6`. Mantener provisionalmente v4 y validar el build API en el CI existente; retirar sólo tras un contrato específico que demuestre que Express 5 no rompe el portal.
- `esbuild: 0.28.1`: portal pide `^0.28.2` y la sustitución queda por debajo del rango. Requiere `check`+tests+build y revisión posterior de motivos de seguridad.
- `postcss: 8.5.23`: portal pide `^8.5.28`, pin inferior al mínimo requerido; misma verificación y revisión de riesgo antes de cambio.
- `vite: 7.3.6`: el pin es compatible con `^7.3.6`; igualmente queda cubierto por build. No usar pin de Vite como pretexto para alterar los otros tres.

## 4. Escenarios y aceptación
1. PR que toque sólo `apps/assistant-portal/package.json` ejecuta workflow aislado y bloquea **su propio** resultado si falla `check`, `test` o `build`; no ejecuta `railway-deploy`.
2. PR que cambie el `pnpm.overrides` de raíz ejecuta el workflow aislado.
3. PR que no toque rutas filtradas no incurre en esta ejecución adicional.
4. El checkout usa `--frozen-lockfile` y no actualiza manifests/lockfile.
5. Si no se pueden resolver paquetes o falla Node/pnpm/build, la verificación falla cerrada con log; no reintentos infinitos.
6. No afirmar resolución de vulnerabilidades basándose en un build. Un pin fuera de rango no se aprueba automáticamente ni se cambia sin análisis de CVE y revisión humana.
7. No acoplar el workflow al gate de Railway. Documentar costos como minutos reales de runner una vez ejecutado; sin estimaciones presentadas como facturas.

## 5. Arquitectura, datos, seguridad y reversión
El workflow es un paso de CI sin servidor, DB, migraciones ni estado de aplicación. Sin acceso a secretos, con permisos mínimos y acciones previamente utilizadas por CI. No genera datos de clientes ni consume registros de proyectos. El runner desaparece al terminar. Rollback reversible: revertir workflow y documentación. Sin impacto al inventario F1 ni al SDD general DRAFT.

## 6. Gates
- [ ] Validar sintaxis/eventos y verificar diff de workflow y rutas filtradas.
- [ ] Ejecutar `pnpm check:assistant-portal` con workspace de CI actual.
- [ ] Ejecutar `pnpm build:assistant-portal` y preservar logs.
- [ ] Revisar compatibilidad `apps/api` en CI general, sin modificar tipos.
- [ ] Revisión humana de los tres pins fuera de rango, motivación, CVE y plan reversible de upgrade en PR específico.
- [ ] Validar SDD estricto, índice y resultados de CI al final.
- [ ] Mantener PR en draft; revisión independiente antes de merge. No Railway.

## 7. Dependencias y fuentes
- `docs/reportes/2026-07-26_mantenimiento_assistant_portal.md` (precedente de `@types/express` y aislamiento del portal).
- `docs/reportes/P0_STABILIZATION_AUDIT_2026-07-13.md` (riesgo de overrides que anulan bumps).
- `docs/reportes/2026-10-25_library-hub-f1-lockfile-reconciliation.md` en PR #1050.
- pnpm workspace/overrides: https://pnpm.io/settings#overrides.
