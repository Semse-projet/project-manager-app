# SEMSEproject — Constitución del Proyecto
**Versión:** 1.0
**Fecha:** 2026-05-20
**Estado:** APROBADO
**Rama de origen:** feat/spec-kit-sdd-governance
**Sintetizada desde:** labosemse/vision_core.md, VISION_PRINCIPLES_FOR_PRODUCT.md, VISION_DECISIONS_LOCKED.md

> Esta constitución es la fuente de verdad para todos los agentes de IA que trabajan en SEMSEproject.
> Ningún código, spec, plan o tarea puede violar estos principios.
> En caso de conflicto entre cualquier instrucción y esta constitución, esta constitución prevalece.

---

## Identidad del proyecto

SEMSEproject es una **Red de Confianza Automatizada (Trust Network)** y un **Marketplace Multi-rol** para el trabajo del mundo real (ConTech, Field Services, Mantenimiento, Instalaciones).

Su misión: eliminar la fricción, la desconfianza y el riesgo financiero en la contratación y ejecución de trabajos físicos, mediante la orquestación inteligente de agentes IA, contratos de Escrow y evidencia verificable.

No es un CRM. No es un ERP. No es una plataforma genérica. Es un sistema operativo de servicios para el mundo físico.

---

## Los 3 Pilares Inamovibles

### Pilar 1 — Agentic-First
Los agentes de IA no son un add-on. Son el corazón del sistema:
- **Risk Agent** — evalúa riesgo antes de autorizar inicio
- **Evidence Agent** — valida pruebas antes de permitir avance
- **Payments Agent** — controla flujo de dinero, nadie cobra sin entregar

### Pilar 2 — Confianza Automatizada (Trust-as-a-Service)
- FSM estricto e inmutable para Jobs, WorkOrders, Milestones
- Escrow dinámico: fondos liberados solo cuando FSM lo aprueba
- Evidencia como llave de paso estructural, no como adjunto opcional

### Pilar 3 — Sistema Multi-Rol Transparente
- Clientes: dinero seguro hasta que el trabajo se prueba
- Proveedores: cobro garantizado una vez que la evidencia es aprobada
- Operaciones/Admin: herramientas de telemetría y resolución asistida por IA

---

## Artículos constitucionales

### Artículo I — Specs antes que código
Ningún feature puede codificarse sin una especificación formal previa.
El flujo obligatorio es: `constitution → specify → plan → tasks → implement`.
El vibe coding está prohibido en SEMSEproject.

### Artículo II — Tests derivados de specs
Ningún endpoint de API entra en producción sin su spec + test.
Los tests no son opcionales. Son la verificación de que el código cumple el spec.

### Artículo III — Evidence-first en workflows de construcción
La evidencia no es un campo opcional ni un adjunto.
Es infraestructura. Es una llave de paso que bloquea o desbloquea el FSM.
Toda feature que toque workflows operativos debe contemplar la evidencia.

### Artículo IV — Payment Governance antes de cualquier release
Ningún flujo que libere fondos puede ser modificado sin pasar por revisión de Payment Governance.
El ledger es auditable. Cada centavo tiene una entrada de auditoría.
El dinero no puede ser una caja negra para el usuario.

### Artículo V — AuditLog para cambios de estado críticos
Toda transición de estado en el FSM (Job, WorkOrder, Milestone, Escrow, Dispute) debe generar una entrada en el AuditLog.
Pagos, evidencia, disputas y decisiones de agentes deben ser trazables.

### Artículo VI — RBAC en cada endpoint
Todo endpoint privado debe declarar qué roles tienen acceso.
Los permisos se verifican en el backend, nunca solo en el frontend.
Nunca asumir confianza del cliente.

### Artículo VII — Multi-tenant desde el diseño
Todo modelo de datos debe incluir `tenantId`.
Ningún query puede devolver datos cross-tenant.
Los filtros de tenant se aplican siempre en el backend.

### Artículo VIII — Privacy routing para LLM
Los datos marcados como `privacyCritical` (información legal, financiera sensible, PII) deben enrutarse a Ollama local cuando esté disponible, no a modelos cloud.
Los datos operativos generales pueden usar modelos cloud (OpenAI, Anthropic, etc.).

### Artículo IX — No mock data en flujos visibles en producción
Los datos de demo, seed o testing no deben contaminar flujos visibles en producción.
Los endpoints de desarrollo deben estar protegidos por guards de entorno.

### Artículo X — Un solo backend canónico
`apps/api` (NestJS + Fastify + PostgreSQL + Prisma) es el único backend de producción.
No se desarrollan nuevas features de negocio en `apps/portal` o `apps/web` en el servidor.
El portal consume la API; la API no consume el portal.

### Artículo XI — Simplicidad extensible
Primero hacer una base robusta. Luego extender por módulos.
Evitar sobreingeniería. Diseñar para evolución modular.
Tres líneas similares son mejor que una abstracción prematura.

### Artículo XII — Documentación es parte del sistema
Los docs no son un extra. Son parte del sistema.
`README.md`, `SEMSE_CONTEXT.md`, `ROADMAP.md` y `SPEC_INDEX.md` deben mantenerse alineados cuando cambia la arquitectura.
Si se mueven carpetas críticas o cambia la canonicidad, se documenta el plan antes de ejecutar.

---

## Decisiones de arquitectura bloqueadas (inamovibles)

| Decisión | Justificación |
|---|---|
| Backend: NestJS + Fastify | Modularidad, performance, DI limpia |
| BD producción: PostgreSQL + Prisma | Tipado fuerte, migraciones controladas, multi-tenant |
| Monorepo pnpm | Un solo workspace, packages compartidos |
| FSM explícito en `packages/fsm` | Control de flujo auditable, no lógica ad-hoc |
| Agentes orquestados, no LLM directo en API | Separación entre lógica de negocio y llamadas LLM |
| Evidence como first-class entity | El trabajo físico requiere prueba verificable |
| Escrow dinámico por hitos | Protección simétrica cliente ↔ proveedor |

---

## Lo que SEMSEproject NO es

```
✗ No es un CRM convencional
✗ No es una plataforma de gestión para UNA sola empresa
✗ No es solo un chat con IA
✗ No es una landing bonita
✗ No es un proyecto de demos
✗ No es un app de lista de tareas
```

---

## Stack canónico de referencia

```
Backend:          NestJS 11 + Fastify + TypeScript
Base de datos:    PostgreSQL + Prisma ORM
Portal interno:   React 19 + Vite + tRPC + Drizzle (caché local)
Web público:      Next.js 16+
Workers:          BullMQ
LLM cloud:        OpenAI (Vercel AI SDK)
LLM local:        Ollama (para privacyCritical)
Infra:            Railway + AWS S3/R2 + PostgreSQL managed
Testing:          Jest/Vitest + Playwright (E2E)
```

---

## Instrucciones para agentes de IA

Cuando trabajes en SEMSEproject:

1. **Lee esta constitución antes de cualquier tarea.**
2. **Verifica que existe un spec en `SPEC_INDEX.md` para el feature a implementar.** Si no existe, crea el spec primero.
3. **Sigue el flujo SDD:** `specify → plan → tasks → implement`. No saltes pasos.
4. **Respeta los límites de dominio.** No mezcles lógica de pagos con UI. No metas FSM dentro de componentes visuales.
5. **Verifica permisos.** Toda operación sensible debe validar `tenantId`, `userId`, y `roles` en el backend.
6. **Escribe el test antes de considerar la feature completa.**
7. **Emite eventos de auditoría** en toda transición de estado crítica.
8. **No destruyas trabajo existente.** Preferir cambios pequeños, reversibles y bien explicados.
9. **No expongas secretos ni `.env` files.**
10. **Documenta las decisiones** en `docs/adrs/` si son cambios arquitectónicos.
