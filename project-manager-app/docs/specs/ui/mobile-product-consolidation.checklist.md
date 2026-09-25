---
type: checklist
feature: "Consolidación del producto SEMSE móvil"
spec: "docs/specs/ui/mobile-product-consolidation.spec.md"
version: "2.0"
date: "2026-09-06"
---

# Checklist de calidad

- [x] La consolidación corresponde a un solo producto y preserva originales.
- [x] Contratos de sesión, permisos, datos y entrega definidos.
- [ ] Ningún token puede enviarse a otro origen mediante una ruta o redirección.
- [ ] Refresh concurrente, logout y errores de red cubiertos por pruebas.
- [ ] Datos locales separados por usuario y tenant.
- [ ] Todas las capacidades recuperadas están conectadas o registradas explícitamente como pendientes.
- [ ] Navegación legible, accesible y con estados de recuperación.
- [ ] Expo Go inicia sin módulos nativos incompatibles.
- [ ] Videollamada y ubicación verificadas en builds nativos.
- [ ] TypeScript, tests, Metro y SDD verdes.
- [ ] GitHub, EAS y runtime corresponden a revisiones registradas.
- [ ] Canary autenticado, instalación y publicación tienen evidencia propia.
