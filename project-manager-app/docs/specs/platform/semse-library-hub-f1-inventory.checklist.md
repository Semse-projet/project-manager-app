---
type: checklist
feature: "semse-library-hub-f1-inventory"
spec: "docs/specs/platform/semse-library-hub-f1-inventory.spec.md"
version: "2.0"
date: "2026-10-25"
---

# Checklist F1

## Contratos
- [x] Owner autoriza este slice offline y no F2/F3.
- [x] API/UI/agente ausentes; no mutaciones tenant/org, pagos o Evidence.
- [x] Sólo librerías necesarias; scanner no instala/descarga/importa paquetes de clientes.
- [x] No interpretar manifiestos como evidencia de runtime.

## Seguridad
- [x] Diseño rechaza paths no autorizados, symlinks y JSON inválido.
- [x] Se eliminan credenciales de referencias Python con esquema URL.
- [x] Tests Node reales aislados sobre archivos con SHA Git idéntico: 15 casos PASS (Node 22; evidencia vinculada).
- [x] Smoke CI Node 22 previo al cambio de overrides: #40262055473, 3 jobs SUCCESS.
- [x] HEAD del código F1 `0e4f1815` validado por CI #40264754613 en quality, cobertura y E2E.
- [ ] Revisar si hay manifests Python adicionales fuera de requirements en las apps.
- [ ] Revisión de seguridad independiente antes de ampliar ejecución.

## Datos
- [x] Solo lectura; hashes de manifiesto, no de artefactos.
- [x] Lockfile: coincidencia directa `RESOLVED` o override global exacto `OVERRIDE_APPLIED`; discrepancia sin override `STALE_LOCKFILE`. Ninguna equivale a seguridad, integridad o compatibilidad demostrada.
- [x] Datos no resueltos `UNVERIFIED`/`UNRESOLVED`.
- [x] Salida JSON en checkout real (previa a override) comprobada mediante suite CI #40262055473; nuevos contadores pendientes.
- [x] Cuatro overrides y dos peers confirmados; cero falsos stale (CI #40264754613).
- [ ] SBOM/licencias/CVEs: fase posterior, **NO implementada**.

## Release
- [x] CLI + pruebas dirigidas de archivos SHA idénticos en fixture sintético.
- [x] Test de lectura real del checkout y CLI incluido y ejecutado en CI #40262055473; volver a ejecutar tras corrección.
- [x] Primera lectura en checkout real acreditada (21 JS/TS, 2 Python) en SHA `961c7036`.
- [x] Métricas registradas en el log GitHub del smoke y en informe de reconciliación.
- [x] Spec strict e índice de commit `0e4f1815` aprobados en CI; metadata final a revalidar en nuevo HEAD.
- [x] CI de código F1 y diff completados; PR abierto en DRAFT.
- [ ] Review humano independiente pendiente.
- [ ] Merge, deploy, activación: fuera de F1 y no ejecutados.
