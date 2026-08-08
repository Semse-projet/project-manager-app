# Worker Surfaces

## Identidad

La superficie `worker` es el cockpit operativo del ejecutor de campo. Su prioridad no es exploracion sino ejecucion verificable.

## Proposito

- Ejecutar trabajos.
- Registrar evidencias.
- Coordinar viajes y gastos.
- Reportar incidentes y estado real de campo.

## Pantallas base

- `Dashboard.tsx`: resumen de carga operativa y accesos criticos.
- `Trabajos.tsx`: cola personal de trabajos y estado de avance.
- `DetalleTrabajo.tsx`: contexto puntual del trabajo.
- `Evidencias.tsx`: captura y revision de entregables de prueba.
- `Viajes.tsx`: viajes asignados, itinerario y gastos.
- `Tareas.tsx`: ejecucion de checklist y pendientes.
- `Pagos.tsx`: ingresos y liquidaciones.
- `FieldOps.tsx`, `Tracker.tsx`, `Incidentes.tsx`, `Materiales.tsx`: extensiones de campo.

## Principios no negociables

- Ninguna pantalla worker debe depender directamente de `mockData` una vez pase a fase canonica.
- Cada vista debe declarar su dominio primario.
- El modo `mock` es solo fallback de desarrollo, no contrato de producto.
- La trazabilidad de acciones de campo debe poder auditarse.

## Estado actual

- `Dashboard`, `Trabajos`, `Evidencias`, `Viajes`: en cableado inicial a repositorios de dominio.
- Resto del bloque: pendiente de absorcion por modulo.
