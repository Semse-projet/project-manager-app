---
name: semse-github-operations-cost-guard
description: Auditar facturación y presupuestos de GitHub, diagnosticar startup_failure y CI bloqueado, optimizar consumo de GitHub Actions y verificar la protección del despliegue Railway en SEMSE. Usar para gastos, pago rechazado, presupuesto agotado, checks que no arrancan, Code Quality y optimización de workflows.
routing:
  version: 1
  category: domain
  scope:
    - github_billing
    - actions_costs
    - ci_budget_diagnostics
    - cost_optimization
  triggers:
    - github actions
    - presupuesto de actions
    - presupuesto de github
    - facturación de github
    - factura de github
    - github billing
    - costo de CI
    - costos de github
    - gasto de github
    - code quality
    - startup_failure
    - pago rechazado
    - workflow duplicado
  excludes:
    - cobros de clientes de SEMSE
    - calculo de escrow de trabajos
  # Apply only when a GitHub cost/billing trigger matches; phase alone must not hijack generic CI tasks.
  phases: []
  precedence:
    subordinate_to:
      - semseproject
      - semse-ci-pr-workflow
    may_constrain: []
  specificity: 90
  status: active
---

# SEMSE GitHub Operations & Cost Guard

**Versión:** 1.0 · **Origen:** incidente y optimización del 10 de octubre de 2026.  
**Ámbito:** operaciones de GitHub del repositorio Semse-projet/project-manager-app, reutilizable en otros repositorios previa inspección.  
**No sustituye:** semseproject (gobernanza y autorización), semse-ci-pr-workflow (CI y PR específicos), semse-skill-router (enrutamiento consultivo).

## Objetivo y alcance

Reducir el gasto de CI/CD sin degradar seguridad, cobertura, integración, E2E, procedencia ni trazabilidad; distinguir problemas de facturación de errores de código; enseñar a los agentes a informar un diagnóstico verificable en lugar de adivinar o aumentar presupuestos por defecto.

## Orden de autoridad y modos de acción

1. Leer AGENTS.md, constitución SEMSE, semseproject y semse-ci-pr-workflow cuando correspondan. Ninguna recomendación aquí otorga derechos de escritura o excepciones a sus prohibiciones.
2. Modo inicial siempre **READ_ONLY**: inspeccionar facturación, presupuestos, workflows, jobs, PR, commits, checks, logs y límites. Ocultar números de tarjeta, tokens, cuentas, correos y datos privados.
3. Modo **PROPOSE**: entregar hipótesis, diagnóstico, cambios sugeridos, impacto, riesgos, pruebas de aceptación y estimación de ahorro explícitamente no validada.
4. Modo **MUTATE**: sólo tras autorización explícita y cumplimiento de los contratos del repositorio. Abrir ramas y PR en borrador, nunca fusionar/desplegar por iniciativa propia ni eludir gates. Respetar conflictos de trabajo con Claude/Codex y otras sesiones.
5. **Prohibiciones sin autorización puntual**: pagar facturas, reintentar cargos, editar método de pago, aumentar o desactivar presupuestos, activar gasto sin límite, cambiar suscripciones, elevar permisos, forzar merge, saltar checks, modificar secretos o producción. No solicitar contraseñas ni datos completos de tarjetas.
6. Si los workflows no pueden iniciar, etiquetar el resultado como **UNVERIFIED**; una revisión estática o un merge no es evidencia de CI verde. No presentar un workflow iniciado como exitoso.

## Mapa real de SEMSE

- GitHub: Semse-projet/project-manager-app. El monorepo ejecutable está dentro de project-manager-app/.
- Workflows: **.github/workflows/** en la raíz EXTERNA del repositorio. Comandos pnpm normalmente corren en project-manager-app/.
- CI principal: .github/workflows/ci.yml, jobs quality-gates, unit-coverage y e2e.
- API Integration: .github/workflows/api-integration.yml. Verifica build, arranque y migraciones con Postgres real.
- Cadena de seguridad: CI exitoso en main → Railway Deploy sobre SHA validado → Production Health Gate. Mantener igualdad del SHA probado/desplegado y comprobaciones de procedencia.
- La configuración concreta se puede modificar; **leer siempre los archivos actuales** y no tratar este mapa como prueba del estado actual.

## Diagnóstico en orden obligatorio

1. Identificar repo/organización, rama, PR, commit SHA, fecha, workflows esperados y contexto de ejecución.
2. Leer la ejecución: event, status, conclusion, jobs, steps, logs, checks, annotations, URL y momento. Distinguir:
   - startup_failure + **cero jobs**: falla antes de ejecutar tests; investigar gasto autorizado, suspensión de Actions, facturación, permisos, runner o configuración. **No concluir que el código está roto.**
   - job failure con steps/logs: localizar etapa, primer error reproducible y regresión real.
   - cancelled/skipped/neutral: revisar reglas de concurrencia, condiciones de activación, dependencias y filtros.
   - CI success: verificar cobertura de jobs y SHA; no inferir éxito de API Integration, Code Quality ni Railway.
3. Revisar facturación de la organización por separado de la cuenta personal; no mezclar Copilot personal con el presupuesto de la organización.
4. Clasificar el bloqueo como PAYMENT_AUTHORIZATION, ACTIONS_BUDGET_EXHAUSTED, WORKFLOW_CONFIGURATION, REAL_TEST_FAILURE, GITHUB_SERVICE o UNKNOWN. Puede haber varios a la vez.
5. Reunir evidencia antes de proponer un aumento: ventana de fechas, presupuesto vigente, consumo, descuento, monto facturable, historial de pagos, facturas vencidas y límite Stop usage.

## Regla contable: seis cifras diferentes

Distinguir por fecha y producto:
- **Gross usage** = consumo bruto medido, NO deuda.
- **Included usage / discounts** = créditos/descuentos.
- **Billable usage** = gross menos descuentos, NO necesariamente factura emitida.
- **Budget** = tope de gasto autorizado con su acción de bloqueo, NO importe pagado.
- **Invoiced / outstanding** = saldo documentado en facturas, fecha y estado.
- **Paid / declined** = transacciones efectivamente confirmadas o intentos fallidos; no sumar rechazos como pagos.

Ejemplo histórico **10-oct-2026, Semse-projet** (NO utilizar como cifras actuales):
- Consumo bruto organizacional: USD 117.31; descuentos: USD 47.79; consumo facturable acumulado: USD 69.52.
- Actions: USD 97.79 brutos, USD 47.79 descontados, USD 50.00 facturables; presupuesto Actions USD 50/50 agotado, Stop usage activado.
- Code Quality: USD 19.52 facturables; se audita por separado de Actions.
- Consumo bruto atribuido a project-manager-app: USD 115.37; no fue una factura pendiente de USD 115.37.
- La autorización de pago falló inicialmente; luego desapareció el aviso tras la actualización manual del usuario. **La desaparición no prueba un cargo exitoso.**
- El usuario elevó manualmente el presupuesto de Actions a USD 60; verificar en vivo antes de afirmarlo en otra sesión.
- PR #850 se fusionó antes de verificarse con checks verdes. Los nuevos jobs empezaron después del cambio de presupuesto: inicio != aprobación.

Enlaces de orientación (requieren autorización del usuario para mutar):
- Organización: https://github.com/organizations/Semse-projet/settings/billing/summary
- Presupuestos: https://github.com/organizations/Semse-projet/settings/billing/budgets
- Uso: https://github.com/organizations/Semse-projet/settings/billing/usage
- Historial: https://github.com/organizations/Semse-projet/billing/history

## Política compartida de ejecución con presupuesto — 18-oct-2026

**Decisión trazable:** `DEC-CI-001` en `docs/adr/DEC-CI-001-agent-ci-spend-discipline.md` (**PROPOSED/SHOULD**, no MUST mientras no exista aprobación humana documentada y revisión formal; no implica fusión ni implementación en `main`).

**Alcance:** Claude, Codex, Prometeo, agentes delegados y cualquier agente que opere en este checkout. La constitución y AGENTS.md prevalecen. Agentes externos o de otros repositorios solo quedan cubiertos si importan explícitamente esta política; la presencia del archivo no demuestra que una sesión remota lo haya leído.

### Ciclo propuesto para ahorrar sin perder calidad (SHOULD hasta aprobación humana)

1. **Preflight READ_ONLY:** verificar PR/branch/HEAD, cambios de otros agentes, checks activos y presupuesto vigente con fecha; distinguir el presupuesto de Actions del gasto en Code Quality y de facturas emitidas. Si el presupuesto no es visible, declarar `UNKNOWN` y no inventar saldo.
2. **Desarrollo incremental local:** reunir cambios compatibles en bloques verificables. Ejecutar tests de archivos/contratos afectados, lint o typecheck cuando aplique y revisiones de seguridad/tenant desde temprano; no posponer todos los tests al final ni reemplazar la prueba de integración por una prueba local. Preparar un único delta revisable antes del primer PR.
3. **Publicación consciente del disparador:** antes de abrir un PR o actualizar una rama con PR, inspeccionar qué workflows de `pull_request`, `push`, Code Quality o terceros se dispararán. Un PR `draft` también puede iniciar CI; por eso agrupar cambios y evitar commits remotos de tanteo. No crear PR paralelo para la misma tarea si existe uno activo.
4. **Una validación útil por revisión coherente:** dejar finalizar los checks del HEAD que se pretende revisar; cancelar solo ejecuciones obsoletas del mismo PR conforme a la configuración existente, nunca el gate de `main` ni un check requerido del HEAD final. No reintentar a ciegas ni forzar nuevas ejecuciones mientras sigue un run válido.
5. **Bloqueo financiero/infrastructura:** si hay `startup_failure`/jobs sin `steps`, investigar primero facturación, YAML/configuración, permisos, runners e infraestructura: el hecho de no iniciar **no demuestra ni descarta** defecto de código. Si se confirma `Usage blocked` o presupuesto agotado, clasificar el CI como `UNVERIFIED`, registrar URL/fecha/SHA/estado de facturación y detener reintentos hasta resolver la causa. No usar `[skip ci]`, condiciones `if:` engañosas ni status manuales para aparentar verde. Nunca subir presupuesto, desactivar `Stop usage` o modificar pagos sin aprobación puntual.
6. **Fusión y despliegue:** **antes de fusionar**, exigir en el HEAD exacto del PR los checks requeridos (`quality-gates`, `unit-coverage`, `e2e`, `API Integration` si aplica, SDD, Prisma, controles de seguridad/tenancy y review pertinente). **Después de fusionar**, verificar el nuevo SHA de `main` —que puede diferir por squash merge— con su CI completo, Railway Deploy y control de procedencia/health sobre el SHA efectivamente desplegado. No pedir un check post-merge de Railway sobre el HEAD del PR como precondición imposible. Docs-only tampoco implica permiso de eludir checks requeridos. No fusionar/desplegar ni activar producción por iniciativa del agente.
7. **Optimización técnica por separado:** proponer un PR acotado si se detectan builds e instalaciones duplicados entre CI, API Integration, Autonomy y Operación Asistida; medir antes/después en minutos de jobs, número de runs, fallos y monto facturable. No desactivar pruebas esenciales ni modificar workflows/Railway como parte de una actualización documental. El ahorro es estimación hasta ser medido.
8. **Handoff entre agentes:** dejar en el PR/issue el SHA, comprobaciones locales efectuadas, checks pendientes, causa de fallos, estado del presupuesto con timestamp y siguiente acción. No afirmar que la política ya rige en `main`, en Claude, Codex o en otros repositorios antes de fusionar y acreditar su lectura.

### Evidencia histórica (no presupuesto actual)

Auditoría de solo lectura del **18-oct-2026**: `Semse-projet/project-manager-app` registraba ~29,971 minutos de Actions Linux y USD 126.77 facturables Linux, USD 3.18 de storage y USD 26.57 separados de Code Quality AI Credits; presupuesto Actions de USD 130/130 bloqueado en ese corte. El usuario comunicó después que lo aumentó a USD 140, **sin que esta skill certifique ese valor como estado vigente**. No usar estos números como configuración, límite o autorización futura.

---

## Heurísticas de optimización seguras

1. Para ramas de trabajo, comparar push a todas las ramas con pull_request: pueden disparar dos ejecuciones por cambio. Preferir push a main + pull_request + workflow_dispatch si no hay requisitos de CI en ramas sin PR.
2. En concurrency cancelar ejecuciones obsoletas del mismo PR; **no cancelar automáticamente validaciones de main** que actúan como puerta de despliegue.
3. Leer scripts reales del package.json antes de eliminar pasos. Si test:coverage ya ejecuta build:api, evitar compilación anterior duplicada; hacer lo mismo con test:integration sólo si se conserva el orden build → migraciones → tests.
4. Conservar todos los gates esenciales: spec:validate:strict, contratos Prisma, unitarios, cobertura, E2E, integración DB real, análisis de seguridad, checks de autorización/tenancy, y procedencia de Railway.
5. Aprovechar caché existente; no asumir que falta. Ajustar retención sólo en artefactos **diagnósticos** (ej. 7 días), no en evidencias de negocio, auditoría, escrow, firmas o retención legal.
6. Estimar ahorros antes de cambiar y **medirlos después** por producto y periodo comparable: minutos, costo bruto, costo billable, número de runs, duración, fallos/reintentos. No garantizar porcentajes sin datos.
7. Revisar Code Quality por separado. No desactivar CodeQL/código de seguridad para ahorrar sin evaluar equivalencias y autorizar el riesgo.

## Condiciones de entrega / gate

- PR con diff limitado y sin modificar `main` directamente. Si la decisión sigue `PROPOSED`, no elevarla a obligación `MUST` ni fusionarla sin revisión humana. No fusionar ni desplegar mientras falte evidencia de pruebas requeridas.
- Verificar por SHA: quality-gates = success; unit-coverage = success; e2e = success; API Integration = success cuando aplique. Comprobar política de branch protection; ausencia de protección no es permiso para fusionar inseguramente.
- Validar que Railway Deploy se dispara sólo sobre CI success del SHA correcto y que health/provenance verifican el artefacto ejecutado. No disparar producción manualmente por este documento.
- Publicar tabla de evidencia: cambio, estado VERIFIED/PARTIAL/BLOCKED, link de run, SHA, costo antes/después, incidentes, próximo paso y responsable.
- Diferenciar claramente: **diagnosticado**, **implementado en rama**, **PR abierto**, **fusionado**, **CI verde**, **desplegado**, **verificado en producción**.
- No trabajar simultáneamente sobre los mismos archivos que otro agente o Claude Code local; coordinar por rama/diff y verificar HEAD antes de escribir.

## Aprendizajes permanentes

- Un botón Retry authorization que desaparece no implica necesariamente factura pagada; leer historial.
- El presupuesto agotado y la tarjeta rechazada son dos bloqueos distintos.
- CI startup_failure con cero jobs no demuestra fallo de tests; revisar estado de facturación y runner.
- Un workflow_run puede generar checks de despliegue omitidos aunque no se haya desplegado nada; mirar jobs y condiciones.
- No asumir que un merge es seguro si ocurrió mientras CI estaba bloqueado.
- El enrutador semse-skill-router es consultivo y no otorga permisos.

## Protocolo corto de reporte

**Objetivo:** repositorio, periodo, gasto y bloqueo.  
**Evidencia:** URL, SHA, jobs, presupuesto, descuento, factura, pago.  
**Diagnóstico:** causa confirmada vs hipótesis, alcance y severidad.  
**Propuesta:** cambios mínimos, costo/riesgo, permisos requeridos.  
**Validación:** gates del PR y despliegue, links, métricas antes/después.  
**Estado final:** hecho/no hecho, bloqueos y siguiente acción.
