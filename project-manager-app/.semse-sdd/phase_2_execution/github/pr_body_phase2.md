# PR — SEMSE Admin Modular Shells + Tool Hub MVP

## Qué cambia

- Crea navegación modular centralizada para Admin.
- Agrega hubs para WorkOps, Intelligence, Tool Hub y Verticals.
- Actualiza Mission Control como entrada al ecosistema modular.
- Agrega Tool Hub MVP con Context Bridge.
- Preserva rutas legacy existentes.

## Qué NO cambia

- No backend.
- No Prisma.
- No migraciones.
- No Railway.
- No cambios destructivos de rutas.

## Validación

- [ ] `pnpm exec tsc --noEmit --project apps/web/tsconfig.json`
- [ ] `pnpm --filter @semse/web build`
- [ ] `/admin/mission-control`
- [ ] `/admin/workops`
- [ ] `/admin/intelligence`
- [ ] `/admin/tool-hub`
- [ ] `/admin/verticals`

## Capturas sugeridas

- Mission Control modular.
- WorkOps hub.
- Intelligence hub.
- Tool Hub con Context Bridge.
- Verticals hub.

## Riesgos

- Verificar nombre real del paquete web si `@semse/web` no existe.
- Verificar layout Admin existente antes de reemplazar sidebar.
- Si lint falla por configuración existente, documentarlo sin mezclarlo con este PR.
