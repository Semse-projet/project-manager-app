# SEMSE Library Hub F1 — reconciliación pnpm e inventario real

**Revisión:** 2026-10-25. **PR:** #1050 (apilado sobre #1048). **Estado:** la ejecución CI previa del SHA `961c7036` fue SUCCESS con checkout real; esta revisión introduce clasificación de overrides pendiente de una nueva corrida del HEAD. No fusionado/desplegado/activado.

## 1. Evidencia previa de checkout real

GitHub Actions [#40262055473](https://github.com/Semse-projet/project-manager-app/actions/runs/40262055473) (`quality-gates`, `unit-coverage`, `e2e` = SUCCESS) ejecutó realmente `tests/unit/library-hub-inventory.test.mjs` en la raíz SEMSE. Log del paso `Unit tests (monorepo root — auth, shared, logic)`:

```json
{"jsManifests":21,"pythonManifests":2,"declarations":285,"uniquePackageNames":214,"repeatedNames":29,"versionConstraintDifferences":7,"verifiedResolvedReferences":242,"staleLockfileEntries":4,"unresolvedDependencies":2}
```

Cifra histórica, **anterior al soporte de overrides**; no confundir con métricas post-corrección. Hay 20 `package.json` de apps/packages y 1 de raíz. Los dos manifests Python son `apps/vision-service/requirements.txt` y `apps/vision-service/requirements-test.txt` (no ejecutados/instalados por este escáner).

## 2. Investigación de las 6 observaciones

Se cotejaron `package.json` de los 21 importers contra `pnpm-lock.yaml` v9 de la misma rama y su bloque superior `overrides`. La comparación inicial `declaredRange !== lockSpecifier` etiquetaba **cuatro overrides legítimamente declarados** como `STALE_LOCKFILE`: una falsa alarma. Las otras dos entradas son `peerDependencies` que no tienen resolución directa en el importer.

| Paquete | Manifest / tipo | Declarado | `pnpm-lock.yaml` / override | Clasificación |
|---|---|---|---|---|
| `@types/express` | `apps/api` prod | `^5.0.6` | override exacto `4.17.21` | `OVERRIDE_APPLIED` |
| `esbuild` | `apps/assistant-portal` dev | `^0.28.2` | override exacto `0.28.1` | `OVERRIDE_APPLIED` |
| `postcss` | `apps/assistant-portal` dev | `^8.5.28` | override exacto `8.5.23` | `OVERRIDE_APPLIED` |
| `vite` | `apps/assistant-portal` dev | `^7.3.6` | override exacto `7.3.6` | `OVERRIDE_APPLIED` |
| `react` | `packages/ui` peer | `^19.0.0` | sin resolución directa en importer | `UNVERIFIED` |
| `react-dom` | `packages/ui` peer | `^19.0.0` | sin resolución directa en importer | `UNVERIFIED` |

Las `peerDependencies` describen una exigencia al consumidor; su presencia en el manifiesto no significa instalación ni resolución directa, por eso permanecen `UNVERIFIED` (no `STALE`).

### Riesgo pendiente independiente de la clasificación

**Un override intencional no implica compatibilidad.** De las cuatro sustituciones, tres parecen caer fuera del rango declarado: `@types/express` pide versión mayor 5 pero fija 4, `esbuild` fija `0.28.1` por debajo del `^0.28.2` declarado, y `postcss` fija `8.5.23` por debajo de `^8.5.28`. Se requiere evaluación del motivo del pin de seguridad, de contratos y versiones transitivas **antes de modificarlo**. `vite` sí coincide con un valor permitido por `^7.3.6`. No hacer upgrades masivos ni borrar overrides desde F1. El `--frozen-lockfile` en CI pasó, pero **no garantiza compatibilidad funcional de todos los overrides**.

## 3. Corrección de F1

- Extraer sólo overrides **globales de nombre exacto** en la sección superior del lock v9, sin ejecutar código. Selectores condicionados (p. ej. `body-parser@^1.20.0`) se mantienen fuera de este parser conservador; jamás se les da aprobación supuesta.
- Si hay `specifier` diferente, clasificar como `OVERRIDE_APPLIED` **sólo** cuando coincide exactamente con un override global para ese nombre. En caso contrario, mantener `STALE_LOCKFILE` y `resolvedVersion:null`.
- Mantener `declaredRange`, `lockSpecifier` y `resolvedVersion` distintos; redacción de URL credenciales vigente.
- Añadir tres regresiones: override aplicado, selector condicional ignorado y override scoped `@types/`.
- `overrideAppliedDependencies` diferencia explícitamente una resolución gobernada por override de una `RESOLVED` sin override.
- Preservar `licenseStatus: UNKNOWN`, `vulnerabilityStatus: UNKNOWN`, `runtimeStatus: UNVERIFIED` — no es un SBOM certificado ni una evaluación legal.

**Observación en el smoke real de CI #40264029541** (HEAD anterior a corrección puntual de redacción): `staleLockfileEntries=0`, `overrideAppliedDependencies=4`, `unresolvedDependencies=2`, `verifiedResolvedReferences=246`; el smoke individual pasó en checkout real. **CI global no pasó** porque una regresión exigía `STALE_LOCKFILE` en una referencia de lockfile redactada, mientras el lector devolvía `UNVERIFIED`. Se corrigió el estado sin filtrar la URL en el commit `564e77aa` y se exige nueva corrida completa antes de certificar F1.

## 4. Gate final F1

- [x] CI del commit anterior y smoke real confirmados: ejecución #40262055473.
- [x] Analizados seis registros y corregida lógica de overrides por contrato.
- [x] Smoke real con 4 overrides y 0 falsas alarmas acreditado en CI #40264029541; CI total FALLÓ en una prueba de redacción, fallo corregido.
- [ ] Revalidar la regresión de redacción y todos los trabajos del CI sobre HEAD posterior a `564e77aa`, registrar nuevo SHA y resultado.
- [ ] Revisión del PR por responsable técnico; sin merge/deploy ni habilitación runtime.
- [ ] Planificar F2 como corte separado, sin automatizar instalación ni activar código pesado.

**Conclusión:** F1 es un inventario declarativo offline; `OVERRIDE_APPLIED` requiere una revisión de compatibilidad y gobernanza, no significa vulnerabilidad corregida. Ningún cambio de dependencias se hizo en este PR.
