---
type: plan
feature: "library-hub-override-compatibility"
domain: "platform"
spec: "docs/specs/platform/library-hub-override-compatibility.spec.md"
version: "2.0"
status: "REVIEW"
branch: "chore/library-hub-dependency-compat-20261025"
date: "2026-10-25"
---

# Plan de compatibilidad aislada
1. Documentar propósito, riesgos de cuatro pins y dependencia de F1 (ya realizado).
2. Definir workflow efímero sin DB con permisos `contents: read` para `pnpm --frozen-lockfile`, `check:assistant-portal` y `build:assistant-portal` (en PR).
3. Verificar evidencia de GitHub Actions: ruta filtrada y pruebas ejecutadas realmente, no solo archivo YAML.
4. Registrar duración/coste de runner real; completar revisión independiente, sin prometer rentabilidad.
5. No modificar paquetes, ejecutar deploy ni fusionar sin gate. Rollback eliminando workflow.
