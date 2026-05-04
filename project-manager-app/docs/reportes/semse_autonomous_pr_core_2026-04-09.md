# SEMSE Autonomous PR Core — 2026-04-09

## Alcance

Se creó un núcleo nuevo en `/home/yoni/labsemse/semse` para automatizar:

`task -> branch -> change -> commit -> push -> PR`

con dos implementaciones paralelas:

- Node.js
- Python

## Componentes

- CLI Node `semse`
- CLI Python `semse-py`
- runtime autónomo con validación por pasos
- integración GitHub REST
- integración AI real vía `OPENAI_API_KEY` con fallback local
- UI local tipo tablero para ejecutar tareas y revisar runs

## Validación esperada

La validación local usa:

- repositorio temporal
- remoto bare temporal
- mock de GitHub API

Eso permite comprobar end-to-end:

- branch creada
- commit creado
- push exitoso
- PR abierta válida

## Validación ejecutada

Se validó de forma real:

- `npm test` en `semse/node` → OK
- `python3 -m unittest .../test_integration.py` en `semse/python` → OK
- ejecución real del CLI Node sobre repo demo local → OK
- ejecución real del CLI Python sobre repo demo local → OK
- UI local operativa en `http://127.0.0.1:4310` → OK
- POST real a `/api/run` desde la UI → OK

Run visual validado:

- task: `add status badge`
- branch: `feat/add-status-badge`
- commit: `07bcdcea5ef0aad9a82b792aeb2e50a67fefeac8`
- PR local mode: `semse://local-pr/feat/add-status-badge`

## Notas

- El cableado real a GitHub depende de `GITHUB_TOKEN` y `REPO_NAME`.
- La integración AI real depende de `OPENAI_API_KEY`.
- En ausencia de credenciales, el sistema no se bloquea: cae a modo deterministic fallback para mantener la ejecución local completa.
- Se añadió `SEMSE_LOCAL_PR_MODE=1` para dejar la UI y las demos operables sin red externa ni token, sin quitar el soporte real a GitHub REST.
