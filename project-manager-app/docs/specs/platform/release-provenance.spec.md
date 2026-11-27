---
id: "platform.release-provenance"
title: "Release controlado con procedencia verificable"
domain: "platform"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "../.github/workflows/ci.yml"
  - "../.github/workflows/railway-deploy.yml"
  - "../.github/workflows/production-unvalidated-deploy-alarm.yml"
  - "../.github/workflows/deploy.yml"
  - "scripts/verify-deploy-provenance.mjs"
  - "scripts/pre-migrate.mjs"
  - "scripts/unvalidated-deploy-watch.mjs"
related_tests:
  - "tests/unit/c02-verify-deploy-provenance.test.mjs"
  - "tests/unit/unvalidated-deploy-watch.test.mjs"
related_endpoints:
  - "GET /v1/health"
  - "GET /api/semse/healthz"
related_events: []
related_agents: []
last_verified: "2026-11-27"
privacyCritical: false
auditLog: "No se crean eventos de dominio. La evidencia vive en los resúmenes de GitHub Actions; no se inventan nombres en EVENT_CATALOG."
sse: false
fsmTransicion: "Máquina de estados del release (§5); es operativa, no una FSM de dominio."
paymentGovernance: "Sin impacto directo. Un rollback que cruce migraciones de Payments exige la revisión de §9.4."
---

# Spec: release controlado con procedencia verificable

> **APPROVED** por el dueño de SEMSEproject el 27-nov-2026 a las 18:01 UTC. Lo eligió en el hilo del proyecto, después de ejecutar en el QA aislado G-R01 a G-R05 (PASS) y G-R06 (parcial).
> La aprobación autoriza la **implementación** por fases. No autoriza ninguna fusión ni despliegue: cada fase del checklist de ejecución sigue necesitando la autorización expresa del dueño y la revisión humana independiente de su PR. La revisión por IA no la sustituye. El incidente `9e2f87f1` sigue ABIERTO y la puerta global del Plan 13 sigue CERRADA.
> Opción elegida en ADR-PROV-001: **B** (desplegar solo desde Actions).

## 1. Problema y resultado

**Para quién:** el dueño de SEMSEproject y los responsables de los Planes 10 a 13.

**Problema:** producción ejecuta, y migra, código que todavía no ha pasado CI. Un CI de `main` puede cancelarse sin ejecutar ningún job. La evidencia de Worker y Vision no existe mientras el token falle.

**Resultado esperado:**
- Todo SHA servido por los cuatro servicios tiene CI de `main` en success para ese SHA exacto, verificado antes del despliegue.
- Ningún release retrocede sin autorización.
- Ningún fallo de credencial o de evidencia acaba en PASS.

## 2. Alcance

**Dentro:**
- Concurrencia del CI de `main` (C2).
- Gate de release `railway-deploy.yml` (C1-B, C3, forward-only).
- Alarmas (C4).
- Transición desde el auto-deploy nativo.
- Rollback.
- Pruebas G-R01 a G-R07.

**Fuera:**
- Vulnerabilidades de Dependabot (paquete aparte, `06_Paquete_Dependabot.md`).
- El aviso `warningCount=1` de Postgres (Plan 11).
- Reglas de protección de `main`: dependen de un administrador (C5).
- Inyección de un `imageDigest` verificable: queda como excepción formal documentada.

## 3. Arquitectura objetivo (opción B)

```
 merge a main ──► CI (grupo por SHA, nunca se cancela en main)
                     │ conclusion == success  (cancelled / failure → nada se despliega)
                     ▼
            Railway Deploy  [lock: railway-deploy, cancel-in-progress: false]
              1. Resolver el SHA exacto (workflow_run.head_sha)
              2. Exigir credencial: ausente o no autentica → BLOCKED
              3. Guardia forward-only contra el SHA que sirve la API (runtime)
                   deploy | already_served | superseded | blocked
              4. (solo deploy) preflight de migraciones [fase 2, §9.2]
              5. (solo deploy) serviceInstanceDeploy(commitSha) × 4 servicios
                     ▼
            health-check
              6. Railway: deployment del SHA exacto en SUCCESS × 4 (metadata)
              7. Runtime: API y Web con gitSha == SHA (bloqueante)
              8. Resumen: alcance, digest tolerado como excepción formal
                     ▼
            Production Health Gate (deploy.yml): smoke público
 Alarmas (defensa secundaria, sin secretos):
   ci-not-green      CI rojo o cancelado y API/Web sirven ese SHA → rojo (todos los servicios)
   served-before-ci  API/Web sirven el SHA antes de CI success → rojo
```

**Railway (tras la transición):** la fuente nativa queda desconectada de `main` en los cuatro servicios. Solo `serviceInstanceDeploy` con `commitSha` crea deployments. `preDeployCommand` de la API se mantiene, pero solo corre en builds que lanzó el gate.

## 4. Separación entre concurrencia de CI y serialización de releases (T4)

| Aspecto | CI (`ci.yml`) | Release (`railway-deploy.yml`) |
|---|---|---|
| Grupo | `ci-CI-sha-<sha>` en push a main; `ci-CI-pr-<n>` en PR | `railway-deploy` (global) |
| Cancelación | Nunca en `main`. En PR, se cancela el run anterior. | `cancel-in-progress: false`. GitHub puede sustituir un run **pendiente** por otro más nuevo. |
| Paralelismo | Varios SHAs de `main` en paralelo, cada uno con su CI completo. | Un único release activo. |
| Orden de terminación | Puede ser desordenado. | Lo neutraliza la guardia forward-only. |

**Por qué se acepta la sustitución de un release pendiente:** solo se encolan releases de SHAs con CI verde. Un release pendiente de A sustituido por uno de C (con C posterior a A en `main`, historia lineal por squash) despliega C, que contiene A. Si el CI de A termina **después** de desplegar C, la guardia devuelve `superseded` y no despliega.

## 5. Máquina de estados del release

```
QUEUED ─► CREDENTIAL_CHECK ─┬─► BLOCKED (sin token / no autentica)
                            ▼
                      FORWARD_GUARD ─┬─► BLOCKED (servido desconocido, divergente)
                                     ├─► SUPERSEDED (fin, verde con aviso; lo acredita el SHA posterior)
                                     ├─► ALREADY_SERVED ─► VERIFYING
                                     ▼
                                 DEPLOYING ─► VERIFYING ─┬─► VERIFIED (PASS)
                                                         └─► FAILED (SHA no coincide, FAILED/CRASHED, timeout)
```

**Reglas:**
- PASS solo desde VERIFIED.
- SUPERSEDED **no** acredita el SHA candidato.
- `imageDigest` desconocido es un aviso con excepción formal, nunca una prueba.

## 6. Guardia forward-only (T5)

Está implementada como función pura `decideRelease` en `scripts/release-forward-guard.mjs` (diff C3). Su entrada es el SHA servido por la API según `/v1/health`, una observación en runtime, no metadata de Railway.

| SHA servido | Relación | Acción |
|---|---|---|
| desconocido o no hex de 40 | — | blocked |
| == candidato | — | already_served (se verifica, no se construye) |
| posterior al candidato | candidato es ancestro del servido | superseded |
| anterior al candidato | servido es ancestro del candidato | deploy |
| otro | divergente | blocked (decisión humana) |

**Limitación conocida:** la referencia es la API. Si Web, Worker o Vision quedaran en otro SHA, la verificación del paso 6/7 falla y el release queda en FAILED. Es fail closed.

## 7. Transición del auto-deploy nativo al despliegue controlado (T6)

Cada fase requiere autorización expresa del dueño. No se pasa de fase sin la evidencia indicada.

| Fase | Acción | Dónde | Evidencia para avanzar |
|---|---|---|---|
| T0 | Medida temporal: un merge cada vez y esperar CI y procedencia antes del siguiente. | Proceso | — |
| T1 | Renovar la credencial de Railway con alcance mínimo. Verificar con una consulta de solo lectura. | Secret de GitHub | Ejecución de prueba en QA con el paso «Require Railway credential» en verde |
| T2 | Fusionar C2 (CI por SHA) y C4 (alarmas) en un PR técnico independiente con gates completos. | GitHub | CI de main por SHA sin cancelaciones (G-R02 en QA). Con la vía nativa activa, `served-before-ci` debe dispararse; eso **confirma** el hueco. |
| T3 | Probar C3 y la opción B completas en QA aislado: fuente nativa desconectada, merges rápidos, CI desordenado, credencial rota. Evaluar también la opción A. | Proyecto QA aislado | G-R01 a G-R06 en PASS, con evidencia por SHA |
| T4 | Fusionar C3 con la fuente nativa **todavía conectada** en producción. El gate pasa a fallar si falta la credencial y verifica los cuatro servicios. | GitHub | Dos releases normales en VERIFIED |
| T5 | Ventana autorizada: desconectar la fuente nativa de `main` en los cuatro servicios. Registrar la configuración antes y después. | Railway producción | Un merge de prueba desplegado **solo** por el gate. `served-before-ci` sin disparos. |
| T6 | Observación durante 7 días o 5 releases. Revisar el impacto del incidente y cerrar el incidente si G-R07 pasa. | Planes 11 y 13 | G-R07 |

**Vuelta atrás de la transición (si T5 falla):** se reconecta la fuente nativa de `main` con la configuración registrada en T5. Queda documentado que se vuelve al riesgo anterior y la alarma `served-before-ci` sigue activa.

## 8. Vía de emergencia (R8)

Si GitHub Actions no está disponible (presupuesto agotado, `startup_failure` o caída) y hay que corregir producción:

1. El dueño autoriza por escrito el SHA concreto.
2. Ese SHA tiene que tener CI verde. Si no lo tiene, hace falta una excepción firmada con el riesgo aceptado.
3. Se despliega desde el panel o la CLI de Railway con `commitSha` explícito, uno a uno por servicio.
4. Se verifica a mano con `node scripts/verify-deploy-provenance.mjs` para API y Web, y con `list-deployments` para Worker y Vision.
5. Se registra en el Plan 13: SHA, hora, quién autorizó, evidencia.

## 9. Rollback (T8)

### 9.1 Principio

Revertir código **no** revierte la base de datos. pre-migrate solo avanza: aplica migraciones pendientes y nunca deshace.

### 9.2 Antes de cada release con migraciones (fase 2 del gate, propuesta)

- Detectar si el SHA candidato añade carpetas en `packages/db/prisma/migrations/` respecto al SHA servido.
- Clasificar cada migración: **aditiva y compatible** (columnas nulas, tablas nuevas, índices concurrentes) o **destructiva o incompatible** (DROP, RENAME, NOT NULL sin default, cambios de tipo).
- Si es destructiva: release BLOCKED salvo autorización específica, con copia de seguridad verificada antes.
- Regla de compatibilidad: el código N-1 tiene que funcionar con el esquema N. Así, un rollback de código no rompe la base.

### 9.3 Rollback de código

1. **Vía preferida:** `git revert` del SHA defectuoso en `main`. Pasa por CI y por el gate. Avanza linealmente, así que la guardia lo acepta.
2. **Vía urgente:** redeploy de un SHA anterior. La guardia lo bloquea a propósito (sería un retroceso). Requiere un `workflow_dispatch` de rollback **separado** (no incluido en los diffs) con estas condiciones:
   - un input `rollback_sha`;
   - un environment `production-rollback` con revisores obligatorios (lo configura un administrador);
   - la comprobación de que el esquema actual es compatible con `rollback_sha` (§9.2);
   - una justificación registrada.

### 9.4 Recuperación de datos

| Caso | Acción |
|---|---|
| Migración aditiva aplicada y código revertido | Se deja el esquema. El código N-1 lo tolera. Se limpia con una migración posterior y planificada. |
| Migración destructiva aplicada por error | Se para. Se restaura desde la copia de seguridad o un PITR de Postgres de Railway, primero en una base aislada. Se comparan conteos y checksums de las tablas afectadas. Hace falta autorización del dueño para restaurar en producción. Si toca tablas de Payments o escrow, se suma la revisión de Payments. |
| Datos escritos por el SHA defectuoso | Se identifican con los logs HTTP de la ventana y con `deploymentId`. Se corrigen con un script de mantenimiento revisado (C57: nada de borrado automático). |

**Prerrequisito que hay que verificar:** existencia, frecuencia y prueba de restauración de las copias de seguridad de Postgres en Railway. No consta que se hayan verificado.

## 10. Criterios de aceptación

| AC | Criterio | Prueba |
|---|---|---|
| AC-01 | Cada push a main tiene un CI propio con jobs > 0. | G-R02, unit `ci-main-concurrency` |
| AC-02 | Un SHA con CI cancelado o fallido no se despliega. | G-R02 |
| AC-03 | Un CI antiguo que termina tarde no despliega. | G-R03, unit `release-forward-guard` |
| AC-04 | Credencial ausente o rota → release BLOCKED. | G-R04, unit `railway-deploy-gate` |
| AC-05 | Migración destructiva → BLOCKED sin autorización. | G-R05 |
| AC-06 | Evidencia por servicio: runtime (API y Web) más metadata (Worker y Vision). El digest es una excepción formal. | G-R06, unit `unvalidated-deploy-watch` |
| AC-07 | El incidente solo se cierra con la prevención demostrada. | G-R07 |

## 11. Trazabilidad con el incidente

| Causa o factor | Corrección |
|---|---|
| CR-1 (auto-deploy sin CI) | C1-B, transición §7 |
| CR-2 (cancelación de pendientes) | C2 |
| F1 (la alarma sale en el primer servicio) | C4 `ci-not-green` |
| F2 (servido antes de CI) | C4 `served-before-ci` |
| F3 (token roto y job en verde) | C3 |
| F4 (protección de `main`) | C5, que necesita un administrador |
| F5 (Vision sin `watchPatterns`) | C6. La alarma ya no asume que Vision se salta los commits fuera de su ruta. |


## Adenda 27-nov-2026: hallazgos del QA aislado que modifican la implementación

1. **Llamada de deploy:** `serviceInstanceDeploy(latestCommit: true, commitSha)` construyó otro commit en QA (el de la cabeza de la rama por defecto). La implementación debe usar `serviceInstanceDeployV2(serviceId, environmentId, commitSha)` sin `latestCommit` (C3-v2). El campo `branch` de la metadata de Railway no sirve como evidencia de procedencia; solo `commitHash`.
2. **Orden de fases:** la concurrencia de CI por SHA (C2) **solo** puede fusionarse junto con la guardia forward-only (C3-v2), nunca antes. Sin la guardia, un CI antiguo que termine tarde podría desplegar un commit anterior. Lo señaló la revisión del PR #1196. La alarma (C4-v2) puede ir sola.
3. **Migraciones (§9):** volver al código N-1 no revierte la base, y `pre-migrate` no avisa si falta en disco una migración aplicada (G-R05 paso 2). Antes del deploy, un preflight (C6) bloquea las migraciones destructivas y la modificación o el borrado de migraciones ya aplicadas, salvo que `packages/db/prisma/destructive-migrations.approved.json` registre `approvedBy` y `backupRef`. Restaurar un backup en Railway tiene dos pasos: Restore deja el cambio preparado y Deploy lo aplica (G-R05 paso 4).
4. **Worker en runtime (§6):** el Worker se verifica por su log `label: startup` del deployment exacto (C7); deja de ser solo metadata. Vision sigue verificándose por metadata.
5. **`imageDigest`:** la excepción EXC-PROV-001 está firmada y vence el 27-dic-2026. Antes de esa fecha, el digest debe informarse en runtime y el gate debe dejar de aceptar `--allow-unknown-digest`.
6. **Auto-deploy nativo:** que el panel lo muestre apagado no basta. En la transición (T5), un commit sonda que toque `project-manager-app/` debe demostrar que no se crea ningún deployment nativo. En QA hubo uno, sin causa aclarada, el 27-nov a las 13:14 UTC.

**Archivos y tests que añadirán las fases siguientes** (no existen aún en `main`): `scripts/release-forward-guard.mjs`, `scripts/migration-destructive-preflight.mjs`, `scripts/verify-worker-startup-log.mjs`, `tests/unit/ci-main-concurrency.test.mjs`, `tests/unit/release-forward-guard.test.mjs`, `tests/unit/railway-deploy-gate.test.mjs`, `tests/unit/migration-destructive-preflight.test.mjs` y `tests/unit/verify-worker-startup-log.test.mjs`. Cada PR que los incorpore debe añadirlos a `related_files` y `related_tests`.

Evidencia: paquete del Plan 12, `correccion-procedencia/evidencia/` (G-R01 a G-R06).
