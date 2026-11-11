# SEMSE Library Hub — F1 — reporte de validación local aislada

**Fecha:** 2026-10-25  
**PR:** [#1050](https://github.com/Semse-projet/project-manager-app/pull/1050) (draft), apilado sobre [#1048](https://github.com/Semse-projet/project-manager-app/pull/1048).  
**Tipo:** prueba local dirigida de **copias idénticas por Git blob SHA**, no ejecución de GitHub Actions ni checkout integral del monorepo.

## Artefactos verificados con SHA de Git

| Artefacto del PR | SHA Git blob verificado |
|---|---|
| `scripts/library-hub-inventory-lib.mjs` | `9a9551017548ebbfa29bd0cb4264a6eba26123a4` |
| `tests/unit/library-hub-inventory.test.mjs` | `e4ceaa25cebd3de1ad4f895179352560f922a456` |
| `scripts/library-hub-inventory.mjs` | `b332fc44b63b175d1d50363dec4e863e4c9f4527` |

Los tres blobs del repositorio coinciden exactamente (Git blob SHA) con los archivos utilizados localmente. Esto demuestra equivalencia de contenido, **no** que todo el checkout remoto haya sido probado.

## Pruebas realizadas

**Entorno:** Node.js `v22.16.0`, Linux, workspace de pruebas sintético local. No se descargaron paquetes, no se instalaron dependencias y no se consultó producción Railway.

Comandos dirigidos:
```shell
node --test --experimental-test-coverage tests/unit/library-hub-inventory.test.mjs
node scripts/library-hub-inventory.mjs --root ./demo
# ejecutar por segunda vez con idéntico contenido y comparar salida JSON byte a byte
```

Resultados:
- **15/15 tests PASS, 0 fallos** en la copia idéntica de las fuentes del PR.
- Cobertura informada por Node: **98.90% líneas, 85.54% ramas, 100% funciones** para `scripts/library-hub-inventory-lib.mjs`. No convertir esto en afirmación de cobertura de todo el monorepo.
- CLI con `--root` sobre repositorio sintético: JSON válido y determinista (dos archivos idénticos), 3 manifiestos JS + 1 Python, y resoluciones `RESOLVED`/`LOCAL_LINK` diferenciadas.
- CLI sobre directorio sin workspace: error controlado y exit no-cero.
- Reglas cubiertas: descubrimiento, rangos vs lock, versiones con sufijos peer, duplicados, faltantes/stale, optional/peer, Python no resuelto, manifests malformados, scripts lifecycle no ejecutados, symlinks válidos/rotos y URL de credenciales en package.json, requirements y pnpm-lock.
- No se modificó `apps/`, `packages/`, `package.json`, `pnpm-lock.yaml`, Prisma ni Railway.

## Limitaciones y gates pendientes

1. **CI del PR #1050: todavía sin corrida comprobada.** No declarar PASS, success, verified ni deploy.
2. **No se ejecutó el checkout completo SEMSE** con todas sus dependencias y scripts; `pnpm test:unit`, `pnpm spec:validate:strict`, `pnpm spec:index:check` y otras comprobaciones del workspace permanecen pendientes.
3. **Node local 22** no representa automáticamente la imagen/runtime Node 24 de SEMSE; validar en CI con la versión del repositorio.
4. **No hay todavía un SBOM de transitivas**, verificación de integridad de tarballs, licencias, CVE, runtime de Railway, ni medición de rentabilidad. Los nombres `RESOLVED` sólo indican coincidencia declarativa con el importer del lockfile; **no** avalan artefacto descargado seguro.
5. **Estructura del parser:** sólo se admite la porción `importers` de pnpm lock v9 con indentación esperada; formatos/manifestos Python adicionales se clasifican como no soportados. Antes de certificar F1 en repositorio completo, comprobar falsos negativos y salidas.
6. El **SDD global** sigue en DRAFT; sólo este F1 de lectura está autorizado. Ni F2 ni ejecución dinámica están aprobados por esta prueba.

## Próxima acción

Revisar el diff de #1050, ejecutar la suite dirigida **en checkout completo**, reconciliar lockfile y snapshots del repo, regenerar/comprobar SPEC_INDEX y correr CI como gate terminal. Conservar PR draft, sin fusionar o desplegar.
