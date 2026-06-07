# SOURCE OF TRUTH — Fuentes de Verdad del Ecosistema SEMSE OS
**Versión:** 1.0 · **Fecha:** Marzo 22, 2026
**Mantenido por:** Arquitecto Principal

> Para el mapa completo del ecosistema consultar:
> `repository-rules/CANONICITY.md` y `program/governance/repository-consolidation/ARCHITECTURE_AUDIT.md` en la raíz de `labsemse/`

---

## Este repo (`project-manager-app`) es la fuente canónica de:

| Capa | Archivo / Directorio | Quién lo consume |
|------|---------------------|-----------------|
| **Esquema de datos** | `packages/db/prisma/schema.prisma` | API, Workers, Seeds |
| **Contratos y tipos** | `packages/schemas/src/` | API, Web, Workers |
| **Sistema de agentes** | `packages/agents/src/index.ts` | API, Web |
| **API REST** | `apps/api/src/modules/` | Web, Workers, clientes externos |
| **Frontend canónico** | `apps/web/` | Usuarios finales |
| **Componentes UI** | `packages/ui/` | apps/web, futuras apps |
| **Autenticación** | `packages/auth/` | apps/web, apps/api |
| **Arquitectura técnica** | `docs/architecture/` | Equipo de ingeniería |
| **Domain model** | `docs/foundation/DOMAIN_GLOSSARY.md` | Todo el equipo |

---

## Este repo NO es la fuente canónica de:

| Capa | Fuente real | Nota |
|------|-------------|------|
| **Visión de producto** | `/vision/` (raíz de labsemse) | `docs/vision/` aquí es un espejo de lectura |
| **Estrategia y ejecución** | `/program/` (raíz de labsemse) | MasterPlan, Roadmap, Sprints viven allá |
| **Infraestructura K8s** | (pendiente → `infra/k8s/` en este repo) | Actualmente en `Agent_Semse App Maximizada` |
| **Prometheus / Grafana** | (pendiente → `infra/observability/`) | Actualmente en `Agent_Semse App Maximizada` |

---

## Regla para `docs/vision/` (este directorio)

Los archivos en `docs/vision/` son **espejo de lectura** de `/vision/` (raíz del repo).

- **No editar aquí directamente.**
- Si necesitas actualizar la visión → edita en `/vision/[archivo].md`
- Si los archivos divergen → prevalece `/vision/`
- Proceso de sync: copiar manualmente o automatizar con script cuando sea necesario

---

## Precedencia en caso de conflicto de tipos

```
packages/schemas/  >  src/types/index.ts (Vite App)  >  cualquier tipo local en apps/
```

Si un tipo en `apps/web/` contradice uno en `packages/schemas/`:
1. El de `packages/schemas/` es correcto
2. Actualizar `apps/web/` para que importe de `@semse/schemas`
3. No crear tipos nuevos dentro de `apps/` — siempre en `packages/schemas/`

---

## Precedencia en caso de conflicto de modelos de datos

```
packages/db/prisma/schema.prisma  >  supabase_schema.sql (legacy)  >  cualquier otro
```

La base de datos de producción es **PostgreSQL manejada por Prisma**.
Supabase es la infraestructura transitoria del Vite App (raíz) — no es el destino final.

---

## Agregar nueva funcionalidad — checklist

Antes de escribir código nuevo:

- [ ] ¿El tipo/modelo ya existe en `packages/schemas/` o `packages/db/`? Si no, crearlo ahí primero.
- [ ] ¿El componente ya existe en `packages/ui/`? Si no, considerar si debe vivir ahí.
- [ ] ¿El módulo de API ya existe en `apps/api/src/modules/`? Si no, crearlo con su estructura completa (controller, service, dto, module).
- [ ] ¿El agente ya está definido en `packages/agents/src/index.ts`? Si no, definirlo ahí antes de implementarlo como microservicio.
- [ ] ¿La decisión de arquitectura quedó documentada en `docs/adr/`? Si no, crear ADR.

---

*Ver también: `repository-rules/CANONICITY.md` · `program/governance/repository-consolidation/ARCHITECTURE_AUDIT.md` · `program/MASTERPLAN.md`*
