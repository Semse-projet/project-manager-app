# SEMSE Context

## Visión del ecosistema

SEMSE busca convertirse en un sistema operativo de servicios especializados, inicialmente enfocado en construcción y gestión de proyectos, con una capa de inteligencia artificial para automatizar flujos, asistir clientes y profesionales, analizar documentos, gestionar contratos, operar dashboards y ejecutar procesos empresariales.

La visión práctica del repo actual es separar con claridad:

- raíz Git del workspace: `labsemse/`
- raíz canónica de desarrollo: `project-manager-app/`
- módulos auxiliares o históricos: `semse-mobile-app/`, `semse/`, `archive/`, `app semse/_satellites-archive/`

## Módulos existentes y futuros

### Núcleo de plataforma

- Client Dashboard
- Professional Dashboard
- Admin Panel
- Marketplace
- Project Management
- Contracts
- Escrow & Milestones
- Evidence Center
- Invoice & Receipt Scanner

### Núcleo de inteligencia

- AI Center
- Floating AI Assistant
- Prometeo Engine
- Nexus DB
- RAG Pipeline
- Multi-provider LLM Router

### Integraciones futuras

- Home Depot
- Alexa
- Pasarelas de pago y escrow
- OCR y extracción documental
- Integraciones ERP / CRM

## Reglas de arquitectura

- No duplicar lógica innecesariamente.
- No mover carpetas críticas sin plan.
- No borrar archivos sin respaldo o justificación.
- No subir secretos.
- Mantener documentación viva.
- Todo cambio importante debe tener commit claro.
- Todo desarrollo nuevo debe aterrizar en `project-manager-app/`, salvo justificación explícita.
- `archive/` y `_satellites-archive/` no son fuente de verdad para código nuevo.
- Los contratos de datos deben preferir `packages/schemas/` y la persistencia canónica `packages/db/`.

## Reglas para asistentes IA

- Leer primero `README.md`, este archivo y `ROADMAP.md`.
- Confirmar la raíz antes de ejecutar comandos destructivos o de Git.
- No usar `git add .` ni commits masivos sin revisión de estado.
- No reintroducir código desde `archive/` sin un plan de migración documentado.
- No inventar scripts: usar únicamente los scripts reales de `project-manager-app/package.json`.
- No exponer ni copiar valores reales de `.env`.
- Documentar supuestos cuando falte contexto.
- Priorizar cambios pequeños, verificables y con rutas claras de rollback.

## Estado operativo actual

- El workspace ya está inicializado con Git en `labsemse/`.
- El repositorio está activo y presenta una gran cantidad de cambios staged/untracked previos.
- `project-manager-app/` es la base canónica de desarrollo según la documentación existente.
- Hay artefactos locales y pesados en la raíz del workspace (`*.zip`, builds, `node_modules`, logs, `dist/`) que deben mantenerse fuera de commits nuevos.
- Existen módulos Vite/React y un módulo Angular adicional, pero el stack canónico principal es NestJS + Next.js + Prisma.

## Prioridades inmediatas

1. Mantener la higiene Git de la raíz del workspace.
2. Centralizar la documentación operativa para humanos y asistentes IA.
3. Trabajar nuevas features en `project-manager-app/`.
4. Revisar y separar el código real de los artefactos archivados.
5. Estabilizar frontend, backend y flujos base antes de expandir Prometeo / Nexus DB.
