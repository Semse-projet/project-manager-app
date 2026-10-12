---
name: semse-railway-release-verification
description: "Preparar y verificar releases seguros de SEMSE en Railway mediante paridad de SHA, gates de CI, migraciones, canarios, observabilidad y rollback, sin saltarse autorizaciones de producción."
---

# SEMSE — Railway Release Verification
**Versión:** 1.0.0 | **Ámbito:** guía de lectura, preflight, propuesta y verificación de despliegues. Complementa `semse-ci-pr-workflow` y `semse-github-operations-cost-guard`.

## Activación
Usar ante staging, release, fallos de despliegue, diferencias GitHub/Railway, migraciones, flags, observabilidad y canarios de SEMSE.

## Autoridad y límites
- Antes de actuar, leer `project-manager-app/AGENTS.md`, la constitución, `docs/SPEC_INDEX.md`, `docs/SOURCE_OF_TRUTH.md`, `docs/foundation/DOMAIN_INVARIANTS.md` y la spec del dominio correspondiente.
- `semseproject` y `semse-spec-kit-flow` gobiernan permisos, aprobaciones, trazabilidad y secuencia SDD. Esta skill no concede permisos de merge, gastos, pagos, secretos, escrituras en producción ni bypass de CI.
- Comprobar GitHub HEAD, branch, PRs concurrentes, specs, contratos, rutas reales y Railway antes de cambiar archivos. Elegir REUSE → EXTEND → ADAPT → CONSOLIDATE → NEW.
- Trabajar en rama y PR borrador; no modificar producción ni datos de terceros por implicación. Registrar incertidumbres como UNVERIFIED, no como éxito.
- Diferenciar: diseño ≠ código ≠ tests ≠ CI ≠ merge ≠ deploy ≠ activation ≠ piloto real.

## 1. Descubrir infraestructura real (nunca inventar IDs)
- Reconsultar proyecto y entorno actual de Railway antes de operar. Históricamente el proyecto se llama `SEMSEproject` y tiene `semse-web`, `semse-API`, `semse-worker`, `semse-vision`, Postgres y Redis; nombres y despliegues son temporales.
- Inspeccionar source branch/SHA real por servicio, despliegue terminal, salud, volúmenes, dominios, regiones, variables por **nombre**, dependencias de DB y staged changes. Nunca exponer valores secretos.
- Leer `infra/railway/DEPLOY.md`, Dockerfiles, workflows de la raíz exterior `.github/workflows/`, specs y gates del slice.
- Revisar diferencias entre `origin/main`, SHA de CI, SHA de deploy, feature flags y migraciones. Un healthcheck 200 no es journey validado.

## 2. Preflight obligatorio antes de mutar
1. Revisar spec APPROVED, tests que demostraron el cambio, CI verdadero para el SHA y revisión humana aplicable.
2. Capturar `deploy_before`: servicio, replica, último commit, deployment ID, timestamps, región, estado de DB y snapshot/restauración verificada si hay datos críticos.
3. Evaluar migraciones aditivas y compatibilidad del esquema (expand/contract); no ejecutar DROP ni cambios irreversibles sin aprobación específica. Si aplica, validar en DB de staging restaurada, con datos anonimizados o sintéticos.
4. Obtener `get_staged_changes`, revisar cambios no solicitados y cancelarlos/aislarlos antes de aceptar. Ningún cambio a variables/secretos por iniciativa de la skill.
5. Identificar canario limitado, procedimiento de reversión y kill switch; calcular riesgo de pagos, contratos, workers y comunicación a clientes.
6. Confirmar autorización exacta de la operación productiva sensible; la autorización general de programa no supera el gate de AGENTS.md ni las políticas del backend.

## 3. Ciclo de release
- Preparar PR borrador, tests y CI. Si GitHub Actions tiene `startup_failure`/presupuesto agotado, marcar CI `BLOCKED`, no `SUCCESS`; no usar merges para eludir protección.
- Integrar solo mediante flujo revisado por owner; capturar SHA después de merge.
- Desplegar servicio a servicio o por coordinación establecida, y esperar estado terminal. No asumir el mismo commit en cuatro servicios sin confirmar.
- Comparar runtime SHA con commit probado y migración aplicada; revisar logs, métricas, errores 5xx y tareas de worker.
- Ejecutar smoke de health, luego canario autenticado con cliente/profesional/organización de prueba; comprobar persistencia y denegación de acceso cross-tenant.
- Observar tiempo suficiente por riesgo y registrar promoción, rollback preparado o rollback ejecutado con causa. No declarar despliegue sano si hay retrasos críticos en cola.
- No mover dinero, activar escrow ni enviar contratos reales mediante prueba de despliegue.

## 4. Evidencias y estados separados
Registrar `flowId | spec | codeSHA | CIrun/conclusion | PR | mergeSHA | migration | serviceId | deploymentId | deployedSHA | featureFlag | canaryActor | canaryResult | rollbackRef | findings`.
Usar `DEPLOYED` solo si Railway confirma deploy terminal del SHA; `ACTIVATED` requiere flags/ruta realmente disponible y `PRODUCTION_VERIFIED` exige el resultado de negocio observado.
Un despliegue `SUCCESS` más `online` no prueba contratos, aislamiento ni payment governance.

## 5. Gate de salida
El release pasa solo si CI, migración, health, canario, observabilidad y rollback cumplen el checklist aprobado. Si hay estado desconocido o un check faltante, registrar `BLOCKED` o `UNVERIFIED` y detener promoción.
