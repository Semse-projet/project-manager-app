# One Shot por Entorno

## Objetivo

Permitir que cualquier miembro del equipo ejecute la validacion completa del runtime con un solo comando.

## Script

Archivo:

- `/home/yoni/app semse/project-manager-app/packages/db/scripts/runtime-validate-environment.sh`

Alias npm:

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
ENV_NAME=staging npm run runtime:oneshot
```

## Variables

- `ENV_NAME`
- `APPLY_SCHEMA`
- `APPLY_CLEANUP`
- `REPORT_DIR`
- `REPORT_PATH`

## Ejemplos

### Validacion normal

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
ENV_NAME=staging npm run runtime:oneshot
```

### Sin aplicar esquema

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
ENV_NAME=staging APPLY_SCHEMA=false npm run runtime:oneshot
```

### Con cleanup real

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
ENV_NAME=staging APPLY_CLEANUP=true npm run runtime:oneshot
```

## Salida

El script genera un JSON final en:

- `/tmp/semse-runtime-validation/runtime-validation-<entorno>.json`

o en `REPORT_PATH` si se especifica.
