# Mensaje Operativo para el Equipo

Usar este mensaje tal cual para pedir la validacion en `staging`, `preprod` o `production`.

---

Necesito validar la migracion de `Agent Runtime` en el entorno correspondiente antes de declararla cerrada globalmente.

Por favor ejecutar este comando en el entorno objetivo:

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
ENV_NAME=<entorno> npm run runtime:oneshot
```

Ejemplos:

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
ENV_NAME=staging npm run runtime:oneshot
```

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
ENV_NAME=production npm run runtime:oneshot
```

El comando va a:

- aplicar esquema si corresponde
- correr inventario inicial
- correr backfill
- correr inventario final
- correr cleanup `dry-run`
- generar un reporte JSON

Archivo esperado de salida:

```bash
/tmp/semse-runtime-validation/runtime-validation-<entorno>.json
```

Lo que necesito que me compartan de vuelta:

1. El contenido completo del JSON generado.
2. Confirmación de si el resultado final fue `GO` o `NO_GO`.
3. Si fue `NO_GO`, las razones exactas que aparezcan en `reasons`.

Criterio de aprobacion:

- `decision = GO`
- `legacyCount = 0`
- `migrationHealthy = true`
- `skipped = 0`
- `recommendation = safe_to_disable_legacy_and_cleanup`

Si el resultado no cumple eso, no avanzar a cierre global.

Si el entorno queda sano y se autoriza limpieza real, entonces ejecutar:

```bash
cd "/home/yoni/app semse/project-manager-app/packages/db"
ENV_NAME=<entorno> APPLY_CLEANUP=true npm run runtime:oneshot
```

No ejecutar cleanup real sin revisar primero el JSON del `dry-run`.

---

## Respuesta esperada minima

```text
Entorno: staging
Resultado: GO
Archivo: /tmp/semse-runtime-validation/runtime-validation-staging.json
```

o

```text
Entorno: staging
Resultado: NO_GO
Razones: [...]
Archivo: /tmp/semse-runtime-validation/runtime-validation-staging.json
```
