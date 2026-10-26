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
- [ ] Repetir en checkout completo y CI Node de SEMSE, incluyendo validación de SDD/índice.
- [ ] Revisar si hay manifests Python adicionales fuera de requirements en las apps.
- [ ] Revisión de seguridad independiente antes de ampliar ejecución.

## Datos
- [x] Solo lectura; hashes de manifiesto, no de artefactos.
- [x] Lockfile resuelto sólo cuando se confirma que el specifier coincide.
- [x] Datos no resueltos `UNVERIFIED`/`UNRESOLVED`.
- [ ] Salida JSON verificada en repo real contra snapshots.
- [ ] SBOM/licencias/CVEs: fase posterior, **NO implementada**.

## Release
- [x] CLI + pruebas dirigidas de archivos SHA idénticos en fixture sintético.
- [x] Test de lectura real del checkout y CLI incluido en suite unitaria; pendiente resultado.
- [ ] CLI en checkout real y reconciliación contra manifiestos/lockfile del monorepo (evidencia CI).
- [ ] Spec strict e índice actualizados y comprobados.
- [ ] CI final, diff revisado, PR abierto y revisión.
- [ ] Merge, deploy, activación: fuera de F1 y no ejecutados.
