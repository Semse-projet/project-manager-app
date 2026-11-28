---
type: checklist
feature: "Workspace funcional integrado"
spec: "docs/specs/ui/workspace-functional-hub.spec.md"
version: "2.0"
date: "2026-11-14"
---
# Checklist: Workspace funcional integrado

- [x] Ocho resultados de spec corresponden al alcance aprobado por usuario/Blueprint.
- [x] No se amplían auth, permisos, backend, Prisma, pagos, FSM ni pipelines.
- [x] Selección de UI no autoriza acceso; referencias no son ejecuciones.
- [x] Sin migración/backfill ni datos ficticios; rollback frontend por revert.
- [x] Pruebas de navegación por rol, IDs, estados, filtros y concurrencia.
- [x] Typecheck/lint/build comprobados o blockers explícitos.
- [x] Queries descartan respuestas obsoletas y no mezclan datos de recursos; 401 retira scope privado, 403 conserva otras consultas autorizadas.
- [x] Evidencia solo tras bytes reales, sin confundir ubicación con verificación.
- [x] Configuración persiste solo preferencias visuales; móvil implementa foco/Escape y controles con IDs únicos.
- [x] Prometeo reutilizado sin otro chat ni ejecución sensible automática.
- [x] Revisión read-only independiente y defectos corregidos con regresiones.
- [x] Spec index/metadata/reporte actualizados con evidencia real.
- [ ] Rama y PR borrador: operación remota aún pendiente en este snapshot; diff local revisado y sin secretos.
- [x] CI, merge, deploy y activación separados; production_evidence vacío.

Evidencia de implementación local, no observación de journeys autenticados. La interacción de foco en dispositivos reales, ownership efectivo y almacenamiento del proveedor necesitan un entorno autorizado. Los gates de fusión/despliegue/producción quedan pendientes para el mantenedor; no están autorizados por esta implementación.
