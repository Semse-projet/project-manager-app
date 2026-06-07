# Consolidación estructural — Opción B ejecutada

Fecha: 2026-04-07
Autor: Claude (infclaude)
Tipo: Reorganización de estructura de carpetas

---

## Problema detectado

La carpeta `/home/yoni/labsemse/` tenía un nivel intermedio innecesario (`labsemse_project/`) que causaba:

1. `vision/` y `program/` duplicados byte a byte en dos lugares
2. `repository-rules/CANONICITY.md` apuntando a `app semse/project-manager-app` que no existía en esa ruta
3. El monorepo canónico (`project-manager-app/`) enterrado dos niveles adentro
4. Documentación estratégica separada físicamente del código (en raíces distintas)
5. `app semse/` existiendo en dos versiones diferentes sin vínculo

---

## Acciones ejecutadas

### Movidos a raíz (contenido único de labsemse_project/)
| Origen | Destino | Tamaño |
|--------|---------|--------|
| `labsemse_project/project-manager-app/` | `project-manager-app/` | 724 MB |
| `labsemse_project/openai/` | `openai/` | 14 MB |
| `labsemse_project/semse-agent-runtime/` | `semse-agent-runtime/` | 52 KB |
| `labsemse_project/app semse/app/` | `app semse/_satellites-archive/vite-boilerplate-app/` | 904 KB |

### Eliminados (duplicados exactos)
| Carpeta/Archivo eliminado | Motivo |
|--------------------------|--------|
| `labsemse_project/vision/` | Idéntico a `vision/` en raíz |
| `labsemse_project/supabase/` | Idéntico a `supabase/` en raíz |
| `labsemse_project/src/` | Raíz tiene versión más reciente |
| `labsemse_project/program/` | Raíz tiene archivos adicionales |
| `labsemse_project/app semse/` (subcontenido archivado) | Ya existía en `_satellites-archive/` |
| 22 archivos de config duplicados | Idénticos en raíz |
| `labsemse_project/` (vacía) | Eliminada al quedar vacía |

---

## Estructura resultante

```
/home/yoni/labsemse/
├── project-manager-app/        ← MONOREPO CANÓNICO (antes en labsemse_project/)
│   ├── apps/api/               ← NestJS backend
│   ├── apps/web/               ← Next.js frontend
│   ├── apps/worker/            ← BullMQ workers
│   ├── packages/db/            ← Prisma schema
│   ├── packages/schemas/       ← Zod contracts
│   └── packages/agents/        ← AI agents
├── vision/                     ← Visión estratégica (fuente única)
├── program/                    ← Roadmap y ejecución (fuente única)
├── openai/                     ← Config OpenAI (antes solo en labsemse_project/)
├── semse-agent-runtime/        ← Runtime config (antes solo en labsemse_project/)
├── app semse/
│   └── _satellites-archive/   ← Todos los experimentos congelados
├── _governance/                ← Logs de decisiones
├── reportes/                   ← Reportes operativos
├── src/                        ← App Vite transitoria
├── supabase/                   ← Config Supabase
└── [docs estratégicos raíz]    ← 01_KERNEL.md ... 08_SPRINT_BACKLOG.md
```

---

## Archivos actualizados post-consolidación

### CANONICITY.md
Todas las referencias a `app semse/project-manager-app` actualizadas a `project-manager-app`.
Clasificación de carpetas actualizada para reflejar que los satélites están en `_satellites-archive/`.

### .claude/launch.json
Todos los `cwd` actualizados:
- `labsemse_project/project-manager-app` → `project-manager-app`
- Satélites apuntan ahora a `app semse/_satellites-archive/`

---

## Verificación post-consolidación

```bash
# TypeScript API — 0 errores
npm exec tsc --workspace @semse/api -- --noEmit  ✅

# TypeScript Web — 0 errores
npm exec tsc --workspace @semse/web -- --noEmit  ✅

# Estructura de apps intacta
apps/: api, web, worker ✅
packages/: agents, auth, db, schemas, shared, ui ✅
```

---

## Inconsistencias en reportes (detectadas en mismo análisis)

Los siguientes problemas en `/reportes/` quedan documentados pero NO corregidos
(los archivos históricos se preservan tal como están):

| Problema | Cantidad | Archivos afectados |
|---------|----------|--------------------|
| Links con path antiguo `/home/yoni/reportes/` | 8 | Reportes 2026-04-05 |
| Documento fantasma `dtos_exactos_*.md` | 3 citas | Reportes 2026-04-05 |
| Referencias a ruta `app semse/project-manager-app` | Múltiples | Reportes 2026-04-04/05 |

Estos reportes son históricos — sus inconsistencias son trazables pero no requieren corrección.

---

## Impacto en el trabajo activo

- **Todo el trabajo de código sigue en el mismo lugar** — solo cambió la ruta de acceso
- El monorepo es el mismo, los módulos son los mismos, TypeScript compila igual
- La ruta nueva es más corta y directa: `/home/yoni/labsemse/project-manager-app/`
- El prompt de Codex generado previamente debe actualizar las rutas de `labsemse_project/project-manager-app` a `project-manager-app`
