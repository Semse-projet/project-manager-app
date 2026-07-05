# Secuencia Operativa para Codex

## Objetivo

Aplicar la estructura modular de SEMSEproject sobre el Admin existente del repo:

`project-manager-app/apps/web/app/(app)/admin/`

sin tocar backend, Prisma ni Railway en esta fase.

## Secuencia exacta

### Paso 1 — Auditoría real

Desde la raíz canónica:

```bash
cd project-manager-app
find apps/web/app/\(app\)/admin -maxdepth 2 -type f | sort
find apps/web -maxdepth 4 -type f \( -name '*sidebar*' -o -name '*nav*' -o -name '*layout*' \) | sort
```

Generar un archivo:

`docs/admin_modular_restructure_audit.md`

Debe listar:

- rutas existentes;
- rutas duplicadas o legacy;
- componentes de navegación existentes;
- páginas que se pueden envolver en shells;
- riesgos antes de modificar.

### Paso 2 — Crear navegación central

Crear:

`apps/web/lib/admin/admin-navigation.ts`

Debe exportar:

- `ADMIN_MODULES`;
- `getAdminModuleById`;
- `getAdminModuleForPath`;
- `ADMIN_PRIMARY_NAV`.

### Paso 3 — Crear UI shared del Admin modular

Crear si no existe:

`apps/web/components/admin/module-card.tsx`
`apps/web/components/admin/module-shell.tsx`
`apps/web/components/admin/context-bridge-panel.tsx`

No duplicar estilos innecesarios. Usar Tailwind y componentes existentes si están disponibles.

### Paso 4 — Crear hubs nuevos

Crear páginas shell:

- `/admin/workops`
- `/admin/intelligence`
- `/admin/tool-hub`
- `/admin/verticals`

Actualizar sin romper:

- `/admin/mission-control`

### Paso 5 — Pruebas locales

Ejecutar:

```bash
pnpm exec tsc --noEmit --project apps/web/tsconfig.json
pnpm --filter @semse/web build
```

Si el filtro real no es `@semse/web`, revisar `package.json` y usar el nombre correcto.

### Paso 6 — Reporte final

Codex debe entregar:

- archivos creados;
- archivos modificados;
- rutas nuevas;
- rutas preservadas;
- validación ejecutada;
- errores encontrados;
- siguiente PR sugerido.
