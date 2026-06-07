# ROADMAP

## Fase 1: Orden Git y documentación base

Objetivo: asegurar versionado, contexto y reglas mínimas de trabajo.

- endurecer `.gitignore`
- consolidar `README.md`, `SEMSE_CONTEXT.md` y prompts
- dejar claro que `labsemse/` es raíz Git y `project-manager-app/` es raíz canónica
- evitar commits gigantes y secretos

## Fase 2: Limpieza de estructura y dependencias

Objetivo: distinguir código vivo, código legado y artefactos locales.

- auditar carpetas activas vs archivadas
- revisar dependencias duplicadas o huérfanas
- definir qué módulos siguen vigentes y cuáles quedan congelados
- limpiar outputs locales fuera de control de versiones

## Fase 3: Estabilización frontend

Objetivo: estabilizar la experiencia de usuario y el flujo visual principal.

- consolidar `apps/web` como frontend canónico
- revisar compatibilidad con `semse-mobile-app` y módulos Vite
- validar dashboards de cliente, profesional y admin
- unificar componentes y reglas de diseño

## Fase 4: Estabilización backend

Objetivo: fortalecer API, workers y contratos internos.

- consolidar módulos NestJS
- validar límites de dominio y contratos Zod
- estabilizar jobs, colas y procesos de background
- mejorar observabilidad, errores y runbooks operativos

## Fase 5: Sistema de usuarios/roles

Objetivo: establecer identidad, permisos y multitenancy.

- auth robusta
- roles por actor: cliente, profesional, admin, ops
- tenant y org context consistentes
- políticas de acceso por módulo

## Fase 6: Contratos, milestones y escrow

Objetivo: formalizar el flujo transaccional del negocio.

- contratos digitales
- hitos y validaciones
- evidencias por milestone
- pagos retenidos, liberación y disputas

## Fase 7: Agentes IA y floating chat

Objetivo: llevar la capa asistiva a un modo operacional real.

- AI Center y floating assistant
- agentes por dominio
- acciones seguras con contexto de usuario y tenant
- auditoría de prompts, tools y ejecución

## Fase 8: Prometeo RAG / Nexus DB

Objetivo: dotar a SEMSE de memoria, recuperación y análisis documental avanzados.

- pipeline RAG
- vector database / Nexus DB
- indexación documental y evidencias
- routing entre proveedores y estrategias de grounding

## Fase 9: Integraciones externas

Objetivo: conectar SEMSE con servicios estratégicos de terceros.

- Home Depot
- Alexa
- proveedores de pago
- mensajería, OCR, mapas, firma digital y otros conectores

## Fase 10: Producción, seguridad y monitoreo

Objetivo: operar SEMSE con disciplina de plataforma.

- hardening de secretos y CI/CD
- monitoreo, alertas y métricas
- backups, restauración y continuidad operativa
- performance, costos y compliance
