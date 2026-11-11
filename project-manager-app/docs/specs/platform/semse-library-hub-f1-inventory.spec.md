---
id: "platform.semse-library-hub-f1-inventory"
title: "F1 — inventario estático y auditoría declarativa de dependencias"
domain: "platform"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "medium"
code_status: "COMPLETE"
ci_status: "PASS"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "scripts/library-hub-inventory.mjs"
  - "scripts/library-hub-inventory-lib.mjs"
  - "pnpm-workspace.yaml"
  - "pnpm-lock.yaml"
  - "docs/specs/platform/semse-library-hub.spec.md"
  - "docs/reportes/2026-10-25_library-hub-f1-local-test-evidence.md"
  - "docs/reportes/2026-10-25_library-hub-f1-lockfile-reconciliation.md"
related_tests:
  - "tests/unit/library-hub-inventory.test.mjs"
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-10-26"
---

# F1 — SEMSE Library Hub, corte estático

> Contrato de corte **APPROVED** por el propietario en conversación (2026-10-25), limitado expresamente al escáner offline de sólo lectura y tests. El SDD del programa `platform.semse-library-hub` sigue DRAFT; esta aprobación NO autoriza ejecución dinámica, una UI, adaptadores, instalación de dependencias, nuevos servicios ni producción. El código y la evidencia de entrega se registran por separado.

## 1. Problema y resultado

**Actores:** desarrolladores/administrador del repositorio y revisores autorizados. **Necesidad:** detectar dependencias JS/TS y Python declaradas, versiones resueltas verificables, duplicaciones textuales, deriva de lockfile y ausencias, antes de introducir motores nuevos o tomar decisiones de seguridad/licencia. **Salida:** JSON determinista a stdout, etiquetando todo lo no comprobado `UNKNOWN`/`UNVERIFIED`, sin generar SBOM oficial.

## 2. Alcance

- Inspeccionar `package.json` root y `apps/*` / `packages/*` según patrones `pnpm-workspace.yaml`.
- Leer `dependencies`, `devDependencies`, `optionalDependencies`, `peerDependencies` sin ejecutarlas.
- Conciliar contra entradas `importers` y `overrides` **globales por nombre exacto** del `pnpm-lock.yaml` v9; distinguir `RESOLVED`, `OVERRIDE_APPLIED`, `STALE_LOCKFILE`, `LOCAL_LINK` y `UNVERIFIED` sin inferir integridad ni una instalación efectiva. Los overrides condicionados por selector quedan fuera del parser F1, sin aprobación automática.
- Descubrir archivos `requirements*.txt` de apps del workspace y capturar sus líneas sin fingir resolver versiones ni interpretar completamente sintaxis pip; reportar `UNRESOLVED` cuando haya líneas no soportadas.
- Calcular SHA-256 del contenido de cada manifiesto, no del paquete externo.
- Producir salida ordenada y estable, warnings explícitos ante falta de lock o Python complejo.
- Cero dependencias adicionales, cero escrituras, cero ejecución de scripts de paquetes.

### Fuera de alcance

- SBOM SPDX/CycloneDX certificado; grafo transitorio, hash/integridad de tarball, CVE, licencias verificadas, despliegues Railway, código importado o rentabilidad real.
- Descargar, instalar, importar dependencias inspeccionadas, ejecutar npm/pnpm/pip o invocar scripts lifecycle.
- Exponer API o entregar un comando ejecutable a agentes. No hay invocación runtime.
- Migraciones, nuevos servicios, cambios de producto.

## 3. Actores, permisos y límites

CLI local para operadores con acceso al checkout; no HTTP, auth ni datos tenant/org. Sin acceso a secretos deliberado. No sigue symlinks hacia fuera; si un manifest es symlink o path no canónico, falla cerrada. Código auditado no ofrece capacidad como tool de Prometeo. No se permiten rutas suministradas libremente por clientes remotos.

## 4. Escenarios de aceptación

P1: escanear fixtures de varios apps/packages + root y asociar importers a rangos/deps; misma entrada => mismo JSON y orden. P1: detectar duplicados, diferencias textuales y versiones resueltas con sufijos de peers. P0: lockfile desactualizado sin override global coincidente ⇒ `STALE_LOCKFILE` con versión nula; override global exacto ⇒ `OVERRIDE_APPLIED`, conservando rango declarado y versión resuelta; ausencia de entrada ⇒ `UNVERIFIED`; no false PASS. Las declaraciones `peerDependencies` que carecen de importer permanecen `UNVERIFIED`. P0: symlink malicioso, JSON inválido, patrones inesperados o YAML incompatible ⇒ error controlado sin ejecución. P1: requirements Python fijo o complejo ⇒ conservar texto y `UNRESOLVED`, no instalar. P0: package.json con `preinstall` malicioso ⇒ tratar como dato, jamás ejecutar.

## 5. Contrato CLI y salida

`node scripts/library-hub-inventory.mjs` produce un JSON determinista a stdout. `--root /ruta/fixture` sólo para ejecución local de pruebas/checkout autorizado; valida raíz real y rutas. La CLI sale con código distinto de cero ante error estructural, sin imprimir variables de entorno o secretos.

JSON: `schemaVersion, sources, manifests, dependencies, pythonRequirements, diagnostics, summary`. Dependencia: `ecosystem,name,manifest,dependencyType,declaredRange,lockSpecifier,resolvedReference,resolvedVersion,resolutionStatus,licenseStatus:"UNKNOWN",vulnerabilityStatus:"UNKNOWN",runtimeStatus:"UNVERIFIED"`. `integrity` no se afirma por no analizar el grafo de tarballs. `manifestSha256` prueba únicamente integridad de archivo local.

No endpoints/UI/agentes/eventos en este corte; no se modifica ningún dominio ni FSM. Se conserva el SDD del programa y `pnpm-lock.yaml`.

## 6. FSM, eventos y reconstrucción

Sin FSM ni eventos: CLI sin persistencia. La salida se regenera leyendo archivos originales. Se compara por commit sin alterar código. No Payment Governance, Evidence, ni herramientas Prometeo.

## 7. Datos y migración

Ninguna tabla Prisma; `migration_status: NOT_APPLICABLE`. Sin writes, sin backfill. Rollback: revertir el script/test y la spec; no hay datos que recuperar.

## 8. Observabilidad/despliegue

Ejecución local/CI cuando se autorice. No servicios, bandera ni deploy; `deploy_status: NOT_DEPLOYED`, `activation_status: INACTIVE`. Sin telemetría externa ni requests HTTP. Ningún estado se marca VERIFIED solo por tests locales. Publicar métricas de cobertura/diagnósticos JSON al correr sin enviarlas a terceros.

## 9. Tests requeridos

- [ ] Descubrimiento dinámico de root/apps/packages, tipos prod/dev/optional/peer.
- [ ] Fixture lock v9 con peer suffix, workspace link, dependencia ausente, stale spec **y tres regresiones de override global/scoped/selector condicionado**.
- [ ] Output estable, ordenado y SHA-256 con cambio real.
- [ ] Rechazo de symlink y JSON malformado; `scripts.preinstall` no ejecutado.
- [ ] Python requirements básicos y líneas complejas como UNRESOLVED.
- [ ] Falla controlada cuando patrón de workspace no corresponde al contrato.
- [x] Smoke del checkout real ejecutado en CI #40262055473 para SHA `961c7036` (21 JS/TS, 2 requirements Python, 285 declaraciones; previo a overrides).
- [x] Smoke del HEAD con 4 `OVERRIDE_APPLIED`, 0 `STALE_LOCKFILE` y 2 peers sin resolver: `quality-gates` CI #40264754613 PASS en commit `0e4f1815`.
- [ ] Revisión independiente del contrato y de los 3 pins potencialmente incompatibles; sin merge/deploy.
- [x] CI #40264754613: `quality-gates`, `unit-coverage`, `e2e` SUCCESS, incluyendo SDD/índice sobre commit `0e4f1815`.
- [ ] Último PR review humano independiente y prueba de resolución post-merge si se aprueba; la ejecución actual NO valida producción.

## 10. Mapa de implementación

- `scripts/library-hub-inventory-lib.mjs`: parser estático/funciones puras y read-only.
- `scripts/library-hub-inventory.mjs`: CLI; no escritura.
- `tests/unit/library-hub-inventory.test.mjs`: fixtures temporales sintetizados, borrados en test.
- `docs/specs/platform/semse-library-hub-f1-inventory.spec.md`: contrato del slice.

## 11. Fuentes de investigación

1. pnpm lockfile y workspaces oficiales: https://pnpm.io/workspaces y https://pnpm.io/lockfile — adecuar al formato v9 observado, no interpretar datos como código.
2. OWASP SCVS inventory: https://scvs.owasp.org/scvs/v1-inventory/ — etiquetar procedencia y no confundir manifiesto con binario.
3. SPDX spec y CycloneDX: https://spdx.dev/specifications/ y https://cyclonedx.org/specification/ — no emitir un formato oficial parcial sin validación.
Aplicado ahora: inspección estática; backlog: SBOM transitorio, licencias/CVE verificadas; descartado: hot-install.

## 12. Gates

- [x] 15/15 tests locales Node 22 en copias exactas verificadas por Git blob SHA; evidencia en reporte adjunto (no repo entero)
- [ ] Reconciliar conteos y diagnósticos de todo el monorepo con snapshots
- [ ] `pnpm spec:validate:strict` y `pnpm spec:index` al final
- [ ] CI registrado sin inventar PASS
- [ ] PR separado y sin merge/deploy
