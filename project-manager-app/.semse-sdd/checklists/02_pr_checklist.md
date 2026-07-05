# GitHub PR Checklist

## Antes del PR

- [ ] Branch creada desde main actualizado.
- [ ] Commits pequeños.
- [ ] Sin archivos temporales.
- [ ] Sin secretos.
- [ ] Sin cambios destructivos.
- [ ] README/spec actualizado.

## Validación

- [ ] `pnpm exec tsc --noEmit --project apps/web/tsconfig.json`
- [ ] `pnpm build:web`
- [ ] Lint ejecutado o error documentado.
- [ ] Capturas añadidas si hay UI.

## Descripción del PR

- [ ] Qué cambia.
- [ ] Por qué cambia.
- [ ] Qué NO cambia.
- [ ] Rutas nuevas.
- [ ] Rutas preservadas.
- [ ] Riesgos.
- [ ] Rollback.

