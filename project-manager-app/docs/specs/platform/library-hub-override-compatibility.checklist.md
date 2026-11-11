---
type: checklist
feature: "library-hub-override-compatibility"
spec: "docs/specs/platform/library-hub-override-compatibility.spec.md"
version: "2.0"
date: "2026-10-25"
---

# Checklist
- [x] Workflow sin servicio persistente, base de datos ni deploy.
- [x] Solo se dispara en rutas del portal/dependencias o mediante accionamiento manual.
- [x] Acceso mínimo de solo lectura al repo.
- [x] Mantiene `--frozen-lockfile`; nunca cambia versiones automáticamente.
- [x] Incluye prueba de contrato `@types/express` 4.x + Express portal 4.x.
- [ ] Confirmar que `check`, tests y build del portal se ejecutaron y pasaron.
- [ ] Revisar y registrar CVEs y motivación de pins tras análisis independiente.
- [ ] Registrar duración GitHub Actions y coste real (si aplica).
- [ ] Contrato SDD estricto + PR review y CI completos.
- [ ] No fusionar ni desplegar automáticamente.
