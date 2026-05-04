# MIGRATION_RULES

## Proposito

Definir como se migra valor desde carpetas transicionales, laboratorios o snapshots hacia el tronco canonico de SEMSEproject.

## Regla madre

No se migran carpetas completas.

Se migra:

- funcionalidad
- componentes
- contratos
- patrones operativos
- conocimiento

## Destino canonico

Toda migracion estructural debe aterrizar en:

- `project-manager-app/apps/web`
- `project-manager-app/apps/api`
- `project-manager-app/apps/worker`
- `project-manager-app/packages/*`

## Orden de migracion recomendado

1. componentes base compartidos
2. contratos y schemas
3. vistas y layouts
4. paginas completas
5. integraciones de datos
6. automatizaciones y workers
7. infraestructura avanzada

## Flujo obligatorio por capacidad

Para absorber una capacidad desde una fuente no canonica:

1. leer la fuente como especificacion
2. identificar que pertenece a:
   - UI
   - dominio
   - backend
   - ops
   - agents
   - infra
3. mapear el destino dentro del monorepo
4. adaptar a contratos canonicos
5. reconstruir o portar minimamente
6. validar con TypeScript y tests disponibles
7. marcar la fuente original como absorbida o pendiente

## Reglas de tipos

1. Tipos de dominio compartidos viven en `packages/schemas`.
2. Tipos de persistencia viven alineados con `packages/db`.
3. Tipos de presentacion local viven dentro de la app correspondiente.
4. No se permiten nuevos modelos paralelos si ya existe un contrato canonico.

## Reglas de componentes

1. Todo componente reutilizable nuevo entra primero a `packages/ui`.
2. Ningun layout compartido debe vivir duplicado entre varias apps.
3. Si un componente nace dentro de una pagina pero se reutiliza por segunda vez, debe extraerse.

## Reglas de frontend

1. `src/` se usa como fuente UX transitoria.
2. La reconstruccion debe hacerse en `apps/web`.
3. No se copia una pagina 1:1 si arrastra deuda de datos o tipos.
4. Se migra la experiencia, no el archivo.

## Reglas de backend

1. Toda logica core nueva entra por `apps/api`.
2. No se agregan nuevos flujos core acoplados directamente a Supabase desde frontend.
3. Prisma/PostgreSQL son la direccion oficial para el dominio canonico.

## Reglas de datos

Antes de migrar un flujo con datos:

1. identificar modelo actual
2. identificar contrato canonico
3. detectar divergencias
4. decidir:
   - reemplazar
   - adaptar
   - deprecar
   - extender

## Reglas de origenes no canonicos

### `src/`

Se absorbe por funcionalidad:

- `PanelProfesional`
- `Agenda`
- `Evidencias`
- `Profesionales`
- `Escrow`
- `AssistantSettings`

### `semse-control-mvp`

Se absorbe como fuente de:

- worklog
- evidence workflow
- knowledge flow
- milestone ops

### `Agent_Semse App Maximizada`

Se absorbe como fuente de:

- infra
- observabilidad
- servicios de agentes
- blueprint de escalado

### `Agent_Chat semántico sobre PDFs`

Se absorbe como fuente de:

- retrieval documental
- chat semantico
- knowledge engine

## Regla final

Si una migracion no reduce fragmentacion, no esta bien planteada.
