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
- [ ] Tests Node reales sobre esos casos y contra JSON/YAML malformados.
- [ ] Revisar si hay manifests Python adicionales fuera de requirements en las apps.
- [ ] Revisión de seguridad independiente antes de ampliar ejecución.

## Datos
- [x] Solo lectura; hashes de manifiesto, no de artefactos.
- [x] Lockfile resuelto sólo cuando se confirma que el specifier coincide.
- [x] Datos no resueltos `UNVERIFIED`/`UNRESOLVED`.
- [ ] Salida JSON verificada en repo real contra snapshots.
- [ ] SBOM/licencias/CVEs: fase posterior, **NO implementada**.

## Release
- [ ] CLI en checkout real y tests dirigidos.
- [ ] Spec strict e índice actualizados y comprobados.
- [ ] CI final, diff revisado, PR abierto y revisión.
- [ ] Merge, deploy, activación: fuera de F1 y no ejecutados.
