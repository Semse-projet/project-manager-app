# Launch Core

## Objetivo

Definir qué significa que SEMSEproject esté listo para salida real en su primer
recorte serio, y evitar trabajar sin Definition of Done.

## Regla

El producto no está “listo” porque exista código.

Está listo cuando el core mínimo:

- funciona de punta a punta;
- usa contratos canónicos;
- usa API como fuente oficial;
- es auditable;
- y reemplaza el camino legacy en las capacidades críticas.

## Backend mínimo

Debe existir y operar:

- auth real
- jobs
- reservations
- contracts
- milestones
- evidence
- escrow básico
- disputes mínimo
- trust básico
- notifications mínimas

## Frontend mínimo

Debe existir y operar:

- publish job
- client dashboard
- worker dashboard
- agenda base
- evidence flow
- escrow flow básico
- profesionales / discovery básico

## Plataforma mínima

Debe existir y operar:

- `packages/ui`
- `packages/schemas`
- Prisma canónico
- API como fuente oficial
- auditabilidad mínima
- workers mínimos para expiración/notificación si aplican

## Definition of Done por migración

Una pantalla o flujo migrado desde `src/` está DONE cuando:

1. funciona 100% en `apps/web`;
2. usa `apps/api`, no Supabase directo para core;
3. usa `packages/ui` para piezas reutilizables;
4. usa `packages/schemas` para contratos compartidos;
5. compila con TypeScript;
6. reemplaza funcionalmente a la variante anterior;
7. la fuente vieja puede marcarse como absorbida.

## Regla de scope durante migración

Durante migración:

- no se mejora;
- no se rediseña;
- no se amplía funcionalidad;
- no se abren features nuevas ajenas al flujo;

solo:

- replicar;
- conectar;
- estabilizar;
- absorber.

## Métricas de progreso mínimas

- `% de UI migrada a apps/web`
- `% de componentes compartidos en packages/ui`
- `% de tipos canónicos saliendo de packages/schemas`
- `# de llamadas directas a Supabase desde frontend core`
- `# de carpetas paralelas todavía activas`
- `# de flujos core con audit trail completo`

## Cadencia diaria recomendada

Cada día debe cerrarse con estas respuestas:

1. qué cerré hoy;
2. qué quedó parcial;
3. qué bloquea lo siguiente;
4. qué haré mañana.

Regla:

- no abrir una tarea nueva sin cerrar o cortar conscientemente una existente.

## Prioridad absoluta

1. `packages/ui`
2. `packages/schemas`
3. corte progresivo de Supabase en dominios core
4. migración funcional de `src/` a `apps/web`
5. freeze de ramas paralelas

## Criterio de salida del primer core real

SEMSEproject tiene un primer core real cuando:

- cliente puede publicar y seguir un job;
- worker puede operar dashboard, agenda y evidencia;
- milestone puede revisarse y pagarse;
- disputa mínima puede abrirse y resolverse;
- trust básico puede registrar señales;
- audit puede explicar cambios sensibles;
- el flujo principal ya no depende de múltiples apps paralelas para existir.
