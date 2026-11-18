# 2026-11-18 — Integración del piloto FieldOps: #1162, #1166, staging, OPEN-18, #1054 y extracción

Sesión con las decisiones del propietario del 2026-11-18 (puntos 1–8). Solo resultados verificados; lo que no se
pudo verificar se marca como tal.

## 1. #1162 — alineación con Expo SDK 57 (FUSIONADO)

- Antes de fusionar se comprobó:
  - `mergeable_state: clean`;
  - `main` seguía en `7029da63`, la misma base sobre la que corrió CI, así que los checks correspondían a la
    integración vigente;
  - 9 checks en verde;
  - ningún hilo bloqueante. El hilo de Devin sobre Fabric/React 19.3 queda abierto como seguimiento del Gate 5.
- Squash merge → `main@2886cbcd`.
- **Verificación de la compilación desde `2886cbcd`** (worktree limpio):
  - `pnpm install --frozen-lockfile` y `build:packages`: OK;
  - `expo install --check`: «Dependencies are up to date»;
  - `tsc` del móvil: limpio;
  - jest: 50 suites, 232 tests en verde;
  - `expo export`: Android OK (1253 módulos), iOS OK (1256 módulos);
  - `pnpm build:web`: OK.
- **No verificado:** build nativo con EAS e instalación en dispositivos.

## 2. #1166 — workflow `mobile-checks`

- Se incorporó `main` a la rama (merge, sin force-push), se retargeteó a `main` y se añadió el propio archivo del
  workflow a `paths`, para que cada cambio al workflow se ejecute en su PR.
- **Ejecución real en GitHub Actions:** run `44308330731`, job `134815613342`, HEAD `4f017750`, base
  `main@2886cbc`. Conclusión: success, en 1 min 55 s. El log confirma cada paso: expo-doctor 21/21, `tsc`, jest
  50/232 y export de Android e iOS.
- Resto del CI en el mismo HEAD: `quality-gates`, `unit-coverage` y `e2e` en success.
- Marcado como listo para revisión; la fusión espera a la revisión automática.

## 3. Expo y Apple — #1167

Perfil `pilot` con doble barrera contra producción:
- hook `eas-build-pre-install`;
- guarda en tiempo de ejecución en `environment.ts`, con tests.

Runbook `docs/runbooks/MOBILE_PILOT_BUILD.md`, con los puntos de inicio de sesión del propietario (🔐):
- `eas login`;
- `eas env:set` en el entorno `preview`;
- `eas device:create`;
- sesión de Apple con 2FA durante `eas build --platform ios`.

No se pidió ni se usó ninguna credencial.

## 4. Staging — inventario de Railway (solo lectura)

- **Producción:** `SEMSEproject/production`. No se tocó.
- **Mejor candidato:** *SEMSE AgentRun 1149 Isolated QA* / `staging`.
  - Tiene API y worker desplegados desde `main` el 2026-11-14, y Postgres y Redis propios.
  - **No tiene dominio público.**
- **Descartado:** `project-manager-app/production`. Es un QA obsoleto: rama `fix/bo01-…`, SHA `7adb762`, y reporta
  `environment: production`.
- **No se creó ni modificó nada.** Los pasos propuestos están en el runbook, §5, y requieren autorización.

## 5. OPEN-18 — #1168 (DRAFT)

Spec `core.worksite-location-binding` con:
- el contrato;
- la migración SQL propuesta (no ejecutada);
- la compatibilidad y el flag;
- las pruebas requeridas;
- el rollback;
- las preguntas abiertas Q1–Q3.

Pendiente de la aprobación final del propietario.

## 6. #1054 — bloqueos reales

| Bloqueo | Estado verificado |
|---|---|
| Dependencias #1027 (SDD supervisores) y #1053 (`appendInTransaction`) | **Resuelto:** ambas fusionadas (2026-11-07 y 2026-11-10) |
| CI | Verde en `9d696d2` sobre `main@7029da6` (13 checks, incluido API Integration). `main` avanzó a `2886cbc` (#1162, archivos sin relación). En local, #1054 + `main@2886cbc` pasa la suite completa de la API (4095 tests, 0 fallos) dentro de la rama de extracción. **Falta CI formal sobre la integración nueva** |
| **SDD** | `core.task-allocations` y `core.crew-supervisor-delegations` siguen en **DRAFT** en `SPEC_INDEX`. AGENTS.md prohíbe código sin spec aprobada: **bloqueo del propietario** |
| Revisión independiente | Sin ninguna aprobación. Codex agotó su cuota (comentario del 2026-11-11) y sus dos hilos (P2034 y N+1) tienen respuesta técnica, pero siguen sin resolver por un revisor |
| Gobernanza | Aprobación del propietario según DEC-PLATFORM-001; ratificación de D-S0B-01…05 |
| Fuera de alcance de #1054 | OPEN-SUP-01: `createCrew` aún permite fijar al supervisor con `org:crews:manage`. Está documentado y no lo corrige este PR |

## 7. Extracción FieldOps — #1169 (DRAFT, apilado sobre #1054)

- Rama `claude/fieldops-crews-location`, a partir de `9d696d2` (#1054) con `main@2886cbc` incorporado.
- Incluye solo cuadrillas, ubicación BO-09 y Time Tracker. Liens, Forge y Satellites se retiraron de los archivos
  compartidos.
- **Resultados locales:**
  - API: 4095 tests, 0 fallos;
  - raíz: 1739 tests, 0 fallos;
  - lint: OK;
  - build web: OK;
  - `tsc` de API, web y móvil: limpio;
  - móvil: 235/235;
  - specs: 0/0.
- No se fusionará mientras haya gates pendientes.

## 8. #1163, #1164 y #1165

- Las tres ramas, fusionadas juntas en local sobre `main@2886cbc`, no tienen conflictos.
- Resultados:
  - regresión de passport: 2/2;
  - unitarias de la API: 4060 tests, 0 fallos;
  - `spec-validate --strict --base-ref origin/main`: 0/0.
- Marcados como listos para revisión. No se fusionaron: la instrucción era preparar su integración.

## Gate 5

**Abierto.** No hubo pruebas en el Motorola ni en los iPhone.
