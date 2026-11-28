# Release con procedencia verificable: T4 y T5 (28-nov-2026)

Incidente de procedencia `9e2f87f1` (26-nov-2026). Spec: `platform.release-provenance` (APPROVED 27-nov).

## T4: despliegue solo desde Actions (#1199, `e1429a3f`)

- Fusionado el 28-nov a las 00:42 UTC con autorización del dueño.
- La vía nativa de Railway desplegó `e1429a3f` en los 4 servicios entre las 00:42 y las 00:45 UTC. El CI de main terminó en verde a las 00:58 UTC. La alarma `served-before-ci` lo detectó (run 46089304620).
- `Railway Deploy` (run 46090692965):
  - Intentos 1 y 2: BLOCKED, porque `RAILWAY_TOKEN` no autenticaba (fail-closed, como estaba previsto).
  - Intento 3, con un token de cuenta nuevo: PASS. Los 4 servicios ya servían el candidato (`already_served`) y el preflight C6 dio `ok`. El Worker quedó VERIFIED por su log de arranque, y API y Web reportan `e1429a3f`.

## T5: corte del auto-deploy nativo

- 28-nov 03:00 UTC: el dueño desconectó la rama `main` de los 4 servicios de producción desde el panel. El repositorio sigue conectado.
- Comprobado: `autoDeploy=false` en semse-API, semse-web, semse-worker y semse-vision, y `source` sin `branch`. Es la misma configuración que en QA. No se creó ningún deployment.

## Commit sonda

Este archivo es el commit sonda de T5. Toca `project-manager-app/` y no cambia código de ejecución. Al fusionarse:

1. No debe aparecer ningún deployment nativo antes de que el CI de main termine en verde.
2. `Railway Deploy` debe desplegar este SHA con `serviceInstanceDeployV2(commitSha)` en los 4 servicios y dejarlos en VERIFIED.
3. `served-before-ci` no debe dispararse.
