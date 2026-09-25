---
type: plan
feature: "Consolidación del producto SEMSE móvil"
domain: "ui"
spec: "docs/specs/ui/mobile-product-consolidation.spec.md"
version: "2.0"
status: "APPROVED"
branch: "feat/semse-product-consolidation-20260906"
date: "2026-09-06"
---

# Plan de integración

Base GitHub `88171003d645e620ff748bbe53ee11baa5716783`. El backend observado responde; su deployment por CLI no informa un SHA. No se infiere paridad desde ese healthcheck.

1. Registrar fuentes y preservar todos los originales. El worktree `Desktop/semse-consolidated` es el destino autorizado de esta integración; no es una segunda aplicación ni una publicación nueva. El registro de máquina de agosto queda como antecedente histórico y no prevalece sobre la instrucción actual de consolidación.
2. Escribir pruebas de configuración y sesión; implementar una única conexión y renovar sin carreras entre solicitudes y logout. Mantener cabeceras de autoridad en el backend.
3. Incorporar avances de navegación y exponer las funciones comunes desde el shell autenticado. Usar componentes y tokens de diseño existentes con controles accesibles.
4. Recuperar funciones de Prometeo, tareas, notificaciones, perfil y sesiones en vivo contra endpoints reales; conservar la procedencia de cada adaptación.
5. Reconciliar el temporizador local antes de incorporarlo: no ocultar rechazos del backend, no compartir datos entre cuentas y no dar un stop por sincronizado sin respuesta.
6. Configurar builds desde una fuente, mantener identificadores existentes y soportar el nombre histórico de la URL. Registrar el proyecto EAS usado y su historial; no borrar el segundo proyecto.
7. Ejecutar suites, exportación de bundles y SDD; registrar resultados y limitaciones en el reporte final. Preparar distribución/canary solo sobre una revisión validada.

Se conserva `apps/api` como backend único y `@semse/schemas` como contrato. Los cambios de datos de LiveSession se evalúan por separado, con migración aditiva y tests de ownership; no se aplican a producción por inferencia. El riesgo principal es mezclar código recuperado con contratos más recientes: cada función debe pasar por el adaptador compartido y una prueba relevante.

Rollback de código mediante una nueva revisión o publicación de la versión anterior; sin eliminar carpetas, certificados, builds ni datos. Fallos de sesión, aislamiento, compilación o recorrido crítico impiden promocionar la entrega. No se utilizan datos reales en fixtures ni tokens públicos persistentes.
