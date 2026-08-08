# Mobile vs Web Parity Gap

Fecha: 2026-04-23

## Conclusión

La observación es correcta: la app móvil ya consume contratos y repositorios propios, pero todavía no refleja la madurez funcional de la app web canónica.

La diferencia no está solo en datos. Está en:

- densidad de acciones por pantalla
- estados operativos derivados
- componentes canónicos de `@semse/ui`
- mensajes contextuales y flujos de trabajo
- reglas de negocio visibles ya presentes en web

## Worker Dashboard

### Web ya tiene

- KPIs derivados de `jobs` por estado real
- accesos rápidos conectados a disputas, pagos, evidencia y travel
- `NotificationBanner`
- paneles `HtmlInCanvasPanel`, `StatCard`, `JobCard`
- lectura operativa de cartera activa, revisión y presupuesto

### Móvil hoy

- resumen simplificado
- datos conectados, pero sin la capa de lectura operativa del web
- sin `NotificationBanner`
- sin resumen de review/dispute/opportunities equivalente

## Worker Jobs

### Web ya tiene

- tabs semánticos por estado real
- `next action` por status
- filtro/search con copy operativo
- estados `reserved`, `accepted`, `review`, `dispute`

### Móvil hoy

- lista funcional básica
- estados adaptados a un modelo visual más antiguo
- sin copy de siguiente acción ni semántica completa del workflow

## Worker Travel

### Web ya tiene

- agregados por assignment
- readiness de cierre
- faltantes de receipts
- presupuesto vs gasto
- create flow más completo
- ordenamiento por criticidad operativa

### Móvil hoy

- snapshot conectado
- vista simplificada de viajes, gastos y hospedaje
- no expone aún `readyToClose`, `missingReceipts`, `blockedReason`, `expectedBalance`

## Worker Payments

### Web ya tiene

- método de cobro configurable
- filtro por job
- relación con disputas
- clasificación real `released / in_escrow / pending`
- notices de escrow

### Móvil hoy

- historial conectado por jobs
- lectura resumida
- sin panel de payout method
- sin alertas de disputa ligadas al cobro

## Worker Profile

### Web ya tiene

- ratings reales
- completed jobs reales
- disponibilidad editable
- panel de reseñas
- aviso de disputas abiertas
- copy de trust/verification

### Móvil hoy

- snapshot conectado
- lectura de perfil más austera
- sin ratings/reviews reales
- sin availability state equivalente

## Causa estructural

La móvil partió de una app independiente tipo demo/prototipo. Lo que se hizo hasta ahora fue:

1. canonizarla
2. desacoplarla de `mockData`
3. conectarla a contratos
4. preparar infra y chunking

Eso no portó automáticamente la lógica de producto del web.

## Siguiente fase correcta

No seguir creando más wiring genérico. Ahora toca absorción de producto desde web hacia móvil:

1. `worker/profile`
2. `worker/dashboard`
3. `worker/jobs`

## Progreso 2026-04-23

- `worker/travel`: la móvil ya refleja liquidación pendiente, soportes faltantes, saldo esperado, presión de presupuesto y orden operacional.
- `worker/payments`: la móvil ya refleja liberado vs escrow vs pendiente, filtro por trabajo, señales de disputa y configuración básica de método de cobro.
- `worker/profile`: la móvil ya refleja ratings reales (lista con estrellas, comentario, fecha, job), openDisputesCount en alerta roja, completedJobsCount real, availability toggle, trust badge verificado.
- `worker/dashboard`: la móvil ya refleja KPIs derivados de rawStatus (activos, completados, en revisión, disputas), pipeline summary (oportunidades, presupuesto activo, tasa de cierre, carga en review), trabajos en curso con badges semánticos, oportunidades abiertas, greeting con nombre real, quick actions expandidas.
- La brecha principal restante ya se concentra solo en `worker/jobs` (tabs semánticos, next action por status, copy operativo completo).

## Regla de ejecución

Cada absorción debe mover:

- modelo derivado
- copy operativo
- estados visibles
- acciones
- componentes compartibles si conviene

No basta con “pegar el endpoint”.
