# Electrical Tool Advanced Module

Fecha de cierre: 2026-05-25

## Alcance implementado

- Se convirtio `/tools/electrical` en entrada directa al dashboard electrico, con `/tools/electrical/dashboard` como ruta canonica enlazada desde Tool Hub.
- Se agregaron rutas internas reales bajo `/tools/electrical/[section]`:
  - `/tools/electrical/dashboard`
  - `/tools/electrical/estimate`
  - `/tools/electrical/scope`
  - `/tools/electrical/materials`
  - `/tools/electrical/summary`
  - `/tools/electrical/milestones`
  - `/tools/electrical/inspection`
  - `/tools/electrical/load-analysis`
  - `/tools/electrical/research`
- Se reemplazo la vista electrica de una sola pagina por un modulo operativo con sidebar interno, dashboard, calculadora, alcance, materiales, resumen financiero, milestones/evidencia/pagos, checklist rough-in y analisis de carga.
- La pantalla de estimacion conserva integracion con el endpoint existente `/api/semse/tools/calculate` para generar `SemseToolResult` y mostrar `ToolResultPanel` / `SemseIntelligencePanel` cuando el engine devuelve metricas extendidas.
- Las pantallas operativas usan datos mock editables y funciones puras frontend para preparar integracion futura con persistencia.
- Se agrego un research engine electrico con busqueda web server-side en `/api/semse/tools/electrical/research`.
- El research engine soporta `BRAVE_SEARCH_API_KEY` o `TAVILY_API_KEY`; si no hay credenciales, devuelve fallback offline con fuentes confiables, queries preparadas y gates SEMSE.

## Algoritmos frontend preparados

- Materiales: `lengthFt * unitCostPerFt * conductorCount * adjustmentFactor`.
- Labor: `estimatedHours * hourlyRate * difficultyMultiplier` con ajustes por casa ocupada, horario comercial after-hours, acceso estrecho, wiring antiguo y condicion desconocida.
- Precio: costo directo, overhead, margen, contingencia y precio de venta.
- Riesgo: permisos, remodelacion, acceso, carga sobre 80%, evidencia faltante y nivel de codigo estricto.
- Carga: `loadAmps / breakerAmps * 100` con estados dentro de norma, revisar, cerca del limite, sobrecarga y dato incompleto.
- Payment readiness: preparado por milestone con estados `not_ready`, `ready_to_release`, `released` y `held`.
- Research: construccion de query contextual por categoria, proveedor, ubicacion, recomendaciones, warnings y gates de seguridad/estimacion.

## Integracion SEMSE

- Tool Hub apunta ahora a `/tools/electrical/dashboard`.
- Unified Tools Dashboard apunta ahora a `/tools/electrical/dashboard`.
- La calculadora electrica sigue usando el contrato existente de `calculateSemseTool`.
- La conversion a BuildOps queda disponible desde `ToolResultPanel` al ejecutar el engine.
- Las llaves de busqueda se leen solo en el servidor para no exponer proveedores en el cliente.

## Pendiente recomendado

- Persistir estimaciones, materiales, milestones y checklist rough-in en backend.
- Crear entidad o metadata formal para `ElectricalEstimate` si se decide guardar el flujo avanzado completo.
- Agregar smoke E2E especifico para las rutas internas cuando se estabilicen los selectors de UI.
- Guardar resultados de research como evidencia/assumption versionada dentro de estimaciones y change orders.
