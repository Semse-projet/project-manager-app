# Reconciliación de dependencias directas — SEMSE Library Hub (2026-10-25)

**Estado:** auditoría declarativa reproducible basada en los snapshots JSON incluidos en este PR. **No** es un SBOM: no verifica la resolución del lockfile, transitivas, artefactos instalados, imports, licencias, vulnerabilidades ni Railway.

## Resultados computados

| Métrica | Valor |
|---|---:|
| Manifiestos JS/TS de primer nivel inspeccionados | 20 |
| Apps JS/TS | 7 |
| Paquetes internos workspace | 13 |
| `requirements.txt` de vision-service | 1 (8 requisitos declarados) |
| Declaraciones `dependencies` | 213 |
| Declaraciones `devDependencies` | 61 |
| Declaraciones `peerDependencies` | 2 |
| Nombres únicos entre estas secciones | 210 |
| Nombres repetidos en múltiples secciones/manifiestos | 29 |
| Paquetes repetidos con especificadores de versión diferentes | 7 |

**Importante:** los 213+61+2 registros no son paquetes únicos ni gastos mensuales; un paquete declarado varias veces no implica múltiples copias en producción. La comparación es textual sobre los *version specifiers*, no sobre las versiones resueltas.

## Paquetes con restricciones diferentes

| Paquete | Especificadores declarados (sin resolución) | Superficies implicadas | Acción requerida |
|---|---|---|---|
| `typescript` | `~5.9.2` · `^5.8.2` · `5.9.3` · `~6.0.3` · `^5.4.0` | `apps/angular`, `apps/api`, `apps/assistant-portal`, `apps/mobile`, `apps/web`, `packages/agents`, `packages/auth`, `packages/autonomy`, `packages/design-tokens`, `packages/forge`, `packages/knowledge`, `packages/product-events`, `packages/schemas`, `packages/sdk`, `packages/shared`, `packages/tools` | Comparar `pnpm-lock.yaml`, contratos y compatibilidad |
| `@types/express` | `^5.0.6` · `4.17.21` | `apps/api`, `apps/assistant-portal` | Comparar `pnpm-lock.yaml`, contratos y compatibilidad |
| `zod` | `^3.24.2` · `^4.1.12` | `apps/api`, `apps/assistant-portal`, `packages/schemas`, `packages/shared` | Comparar `pnpm-lock.yaml`, contratos y compatibilidad |
| `dotenv` | `^17.2.2` · `^16.6.1` | `apps/assistant-portal`, `packages/db` | Comparar `pnpm-lock.yaml`, contratos y compatibilidad |
| `react` | `19.3.0` · `^19.0.0` | `apps/assistant-portal`, `apps/mobile`, `apps/web`, `packages/ui` | Comparar `pnpm-lock.yaml`, contratos y compatibilidad |
| `react-dom` | `19.3.0` · `^19.0.0` | `apps/assistant-portal`, `apps/mobile`, `apps/web`, `packages/ui` | Comparar `pnpm-lock.yaml`, contratos y compatibilidad |
| `tailwind-merge` | `^3.3.1` · `^2.6.0` | `apps/assistant-portal`, `apps/web`, `packages/ui` | Comparar `pnpm-lock.yaml`, contratos y compatibilidad |

## Riesgos concretos sin extrapolación

- **Zod:** la API y `@semse/schemas` declaran 3.x; `assistant-portal` declara 4.x. No unificar sin contract tests bidireccionales; no pasar objetos Zod entre runtimes como si fueran idénticos.
- **Tailwind Merge:** Web y `packages/ui` usan la rama 2.x, portal declara 3.x. Verificar cadenas/precedencia de clases reales antes de extraer componentes compartidos.
- **TypeScript:** hay rangos 5.x y 6.x; comprobar opciones TSConfig/plugins, generación de declaraciones y build **antes** de homogeneizar.
- **React y react-dom:** aparecen `19.3.0` y peer `^19.0.0`; **no se deduce incompatibilidad**: son restricciones distintas que pueden resultar compatibles.
- **@types/express** y **dotenv:** las diferencias declaradas requieren comparar resolución real; no generar upgrade masivo sin caso de error.
- **Componentes de Python:** rangos mínimos `>=` permiten variación en build si no existe constraints/lock comprobado. Revisar reproducibilidad y dependencias binarias de NumPy/OpenCV.
- **Paquetes externos sin más:** la etiqueta «declarado» no prueba que una biblioteca tenga licencia comercial válida ni que su repo esté libre de CVEs.

## Contrato mínimo del escáner F1 (a aprobar antes de implementar)

El escáner será **estático, offline, read-only y determinista** sobre snapshot de repositorio. No correr `npm install`, `pnpm install`, `pip install`, scripts lifecycle ni cargar/importar módulos como forma de enumerarlos. No consultar producción.

| Campo | Origen | Semántica |
|---|---|---|
| `manifestPath` | filesystem dentro del root validado | ruta canónica, no escape/symlink fuera de repo |
| `manifestSha256` | contenido de manifest | integridad del **manifiesto**, no del paquete publicado |
| `ecosystem` | pnpm/npm/PyPI | normalizado |
| `name` | manifiesto | nombre canónico |
| `dependencyType` | prod/dev/optional/peer | etiquetas distintas |
| `declaredRange` | manifiesto | preserva `workspace:*`, rangos, alias |
| `resolvedVersion` | `pnpm-lock.yaml` si se puede comprobar | `null` cuando no verificable |
| `artifactIntegrity` | lockfile/metadata confiable | `null` salvo evidencia; no equiparar al hash del manifest |
| `licenseVerified` | verificador de licencia posterior | `false`/desconocido inicialmente |
| `vulnerabilityStatus` | advisory audit posterior | `UNKNOWN` sin consulta verificable |
| `sources` | manifiesto, lockfile, SHA | referencia rastreable |
| `runtimeEvidence` | pruebas/build/deploy posteriores | `UNVERIFIED` inicialmente |

### Acceptance tests F1 (sin código ejecutado aún)

1. **Cobertura**: se descubren automáticamente todas las apps/paquetes del workspace, no se codifica la cifra 20; carpetas nuevas alteran el snapshot.
2. **Duplicados/versiones**: mismo nombre+specifier se agrupa por consumidores; rangos distintos quedan diferenciados; los peers no se contabilizan como runtime instalado.
3. **Formato**: output ordenado y JSON estable con mismo árbol/versiones, salvo timestamps opcionales fuera del hash.
4. **Python**: permite sintaxis real de requirements y constraints con comentarios/extras/markers, y rechaza/declara `UNRESOLVED` lo que no pueda determinar.
5. **Seguridad**: no ejecuta contenido del repo ni scripts declarados por terceros; rutas fuera de root, symlinks, nombres inválidos y archivos malformados fallan de forma controlada.
6. **SBOM futuro**: sólo afirmar formato CycloneDX/SPDX después de implementar y validar el esquema completo; no presentar JSON directo como SBOM terminado.
7. **Comparación**: reporta dependencia agregada/eliminada/renombrada/version drift; sin modificar los package.json existentes.
8. **Estado**: todo campo sin evidencia explícita queda `UNKNOWN/UNVERIFIED` y no produce aprobación automática.

## Selección económica del piloto posterior

**Opción prioritaria:** usar una calculadora existente en `@semse/tools` para una simulación de cantidades u horas sin mutar Job, TimeEntry, Evidence ni Payment. Baseline: tiempo de integración, latencia, CPU/RAM promedio/pico, defectos, ahorro de trabajo en el flujo de construcción. Comparar contra solución sin biblioteca adicional; si no hay beneficio o el Worker se degrada, no habilitar. No asumir precios Railway ni retorno positivo hasta medirlos.

## Fuentes de datos

- `docs/specs/platform/semse-library-hub.apps.snapshot.json`
- `docs/specs/platform/semse-library-hub.packages.snapshot.json`
- `pnpm-workspace.yaml`, `pnpm-lock.yaml` y `apps/vision-service/requirements.txt`

Este documento debe revisarse/regenerarse después de cada cambio de manifiestos; no representa el estado desplegado de Railway.
