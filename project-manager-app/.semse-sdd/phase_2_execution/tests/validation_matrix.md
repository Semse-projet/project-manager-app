# Validation Matrix — Phase 2

| Área | Validación | Comando / Método | Aceptación |
|---|---|---|---|
| TypeScript | Compila web | `pnpm exec tsc --noEmit --project apps/web/tsconfig.json` | 0 errores nuevos |
| Build | Build web | `pnpm --filter @semse/web build` | Build exitoso o error existente documentado |
| Routing | Mission Control | Abrir `/admin/mission-control` | Renderiza tarjetas principales |
| Routing | WorkOps | Abrir `/admin/workops` | Renderiza hub y submódulos |
| Routing | Intelligence | Abrir `/admin/intelligence` | Renderiza hub y submódulos |
| Routing | Tool Hub | Abrir `/admin/tool-hub` | Renderiza tools + Context Bridge |
| Routing | Verticals | Abrir `/admin/verticals` | Renderiza verticales iniciales |
| Legacy | Rutas viejas | Probar enlaces desde cards | Siguen navegando |
| UI | Mobile | DevTools mobile | Sin overflow horizontal crítico |
| UI | Desktop | 1440px | Layout limpio |
| Safety | Backend | `git diff -- apps/api packages/db prisma` | Sin cambios |
| Safety | Prisma | `git diff -- packages/db prisma` | Sin cambios |
| Safety | Railway | `git diff -- railway.json nixpacks.toml Dockerfile*` | Sin cambios salvo que se haya pedido explícitamente |
