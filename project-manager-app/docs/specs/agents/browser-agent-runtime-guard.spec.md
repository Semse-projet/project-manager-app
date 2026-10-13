---
id: "agents.browser-agent-runtime-guard"
title: "Guardas de runtime del browser-agent (Chromium en el worker)"
domain: "agents"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence:
  - "2026-10-12: semse-worker (producción) tiene /root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome; chromium.executablePath() de playwright 1.63.0 apunta a ese archivo y existe (lectura vía railway ssh)."
  - "2026-10-12: el AgentRun cmqb7s6nh… ('browser-agent run requires recovery', Executable doesn't exist) se creó el 2026-06-12, antes del arreglo #524 (2026-08-02)."
related_files:
  - Dockerfile.worker
  - Dockerfile.api
  - apps/worker/src/browser-agent/browser-agent.service.mjs
  - apps/worker/src/browser-agent/browser-agent.runner.mjs
  - apps/worker/src/agent-run-handlers.mjs
  - apps/api/src/modules/browser-agent/browser-agent.service.ts
  - packages/autonomy/src/browser/playwright-adapter.ts
  - packages/autonomy/src/browser/session-pool.ts
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["browser-agent"]
last_verified: "2026-10-12"
---

# Spec: Guardas de runtime del browser-agent (Chromium en el worker)

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado. **Este spec corrige un diagnóstico previo** (ver §1).

## 1. Problema y resultado

**Para quién:** operadores `OPS_ADMIN` y el equipo que mantiene el worker.

**Corrección del diagnóstico inicial.** Se sospechó que `Dockerfile.api` carecía de
Chromium. La evidencia lo refuta: el módulo `apps/api/src/modules/browser-agent`
solo crea el `AgentRun`; el navegador se lanza en el **worker**
(`handleBrowserAgent` → `chromium.launch`), y `apps/api/package.json` no depende de
Playwright. **No se instala Chromium en `Dockerfile.api`** salvo que un cambio futuro
mueva la ejecución a la API (entonces este spec se reabre).

**Problema real.** El error `browserType.launch: Executable doesn't exist` volvió a
ser posible sin ninguna señal automática: depende de que el `npx playwright install`
de `Dockerfile.worker` instale la revisión de Chromium que exige la versión de
Playwright que resuelve `apps/worker`. Hoy coinciden (`chromium-1243`, Playwright
1.63.0), pero nada en CI ni en el arranque lo comprueba, y el `AgentRun` fallido de
junio sigue como excepción abierta en Mission Control.

**Resultado esperado:** una regresión de versión o de imagen falla en CI o en el
arranque del worker, no en la primera ejecución de un usuario; y la excepción
histórica se cierra por un runbook auditado.

## 2. Alcance

### Incluido

- Comprobación estática en CI de que `Dockerfile.worker` instala Chromium y de que la
  versión de Playwright usada para instalar es la misma que resuelve `apps/worker`.
- Comprobación en el arranque del worker: `chromium.executablePath()` existe; si no,
  log de error estructurado y campo de readiness (sin tumbar el worker).
- Verificación documentada en el contenedor desplegado (solo lectura).
- Recuperación del `AgentRun` de junio mediante el runbook de Mission Control.

### Fuera de alcance

- Instalar Chromium en `Dockerfile.api` (no se ejecuta navegador en la API).
- Cambiar el motor de navegación o el alcance de URLs permitidas (`isUrlSafe`).
- Tocar variables o servicios de Railway sin aprobación.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| OPS_ADMIN | `ops:dashboard:write` (Mission Control) | tenant del canary | recuperar el AgentRun vía runbook | saltarse la allowlist de runbooks |
| Worker | — | proceso interno | lanzar Chromium headless | navegar a URLs no seguras |

- Tenant boundary: la recuperación usa el runbook `agent-run-recovery-v1` con `tenantId` en el `where`.
- Step-up o aprobación humana: cualquier retry real de un AgentRun de junio requiere confirmación explícita del owner (puede re-ejecutar una inspección de URL).
- Datos `privacyCritical`: no aplica a esta guarda; las URLs inspeccionadas siguen la política vigente.
- Requisitos de auditoría: el receipt de Mission Control y el `AuditLog` existentes.

## 4. Escenarios y criterios de aceptación

### P1 — Regresión de imagen detectada antes de desplegar

```gherkin
DADO un cambio que fija Playwright en apps/worker a una versión distinta de la que instala Dockerfile.worker
CUANDO corre la prueba de contrato de imagen en CI
ENTONCES la prueba falla con la versión esperada y la instalada
```

### P2 — Worker sin ejecutable lo anuncia al arrancar

```gherkin
DADO un worker cuyo chromium.executablePath() no existe
CUANDO el worker arranca
ENTONCES registra un error estructurado con la ruta esperada
Y el readiness del worker marca browser.executableExists=false
Y el worker sigue sirviendo las demás colas
```

Casos borde:

- [ ] Playwright sin navegadores descargados en desarrollo local: la comprobación no rompe `pnpm dev:worker`.
- [ ] El AgentRun histórico no se reintenta automáticamente.
- [ ] Aislamiento cross-tenant del runbook ya cubierto por `mission-control-2.test.ts`.

## 5. Contratos

Sin endpoints nuevos. El readiness del worker añade un campo informativo
`browser.executableExists` (booleano) sin afectar al estado general del servicio.

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: `AgentRun` (sin cambios de FSM).
- Eventos declarados: ninguno nuevo.
- Replay/rebuild: no aplica.
- DLQ/compensación: el AgentRun histórico se resuelve por runbook, no por reintento ciego.

## 7. Datos y migración

Sin cambios de modelo ni migración.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: 0 AgentRuns `browser-agent` con `Executable doesn't exist` tras el despliegue.
- Logs: línea de arranque del worker con `executablePath` y `exists`.
- Health/readiness: campo informativo `browser.executableExists`.
- Feature flags/allowlists: ninguno.
- Plan de canary: despliegue normal del worker; verificar en el contenedor (abajo).
- Evidencia de producción requerida (solo lectura):
  `railway ssh --service semse-worker -- 'cd /app/apps/worker && node -e "const {chromium}=require(\"playwright\"); const p=chromium.executablePath(); console.log(p, require(\"fs\").existsSync(p))"'`
- Señal de rollback: el worker no arranca o el readiness general degrada por esta comprobación.
- Owner operativo: semse-core.

## 9. Tests requeridos

- [ ] Prueba de contrato de imagen: `Dockerfile.worker` instala Chromium y la versión coincide con `apps/worker`.
- [ ] Prueba de que `apps/api` no depende de Playwright (evita falsa expectativa de navegador en la API).
- [ ] Unitaria de la comprobación de arranque (ejecutable presente / ausente).
- [ ] Verificación de solo lectura en el contenedor desplegado tras el deploy.

## 10. Mapa de implementación

### Worker/Packages

- `apps/worker/src/browser-agent/` — comprobación de arranque.
- `Dockerfile.worker` — fijar la versión de Playwright usada en `install` si la prueba lo exige.

### Tests

- `tests/unit/` — prueba de contrato de imagen y de dependencias.
- `apps/worker/test/` — comprobación de arranque.

## 11. Investigación externa

- Reporte con tres búsquedas primarias: no realizado (el hallazgo se verificó con el contenedor desplegado).
- Aplicado ahora: nada.
- Backlog: revisar si conviene la imagen oficial de Playwright como base del worker.
- Descartado: instalar Chromium en la API.

## 12. Gates de cierre

- [ ] Spec aprobado por el owner
- [ ] Pruebas del §9 en CI
- [ ] Verificación de solo lectura en el contenedor desplegado registrada en `production_evidence`
- [ ] AgentRun de junio resuelto por runbook, con receipt
