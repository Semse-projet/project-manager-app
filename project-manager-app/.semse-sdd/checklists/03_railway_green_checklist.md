# Railway Green Checklist

## Antes de deploy

- [ ] Web build pasa localmente.
- [ ] API build pasa localmente si fue tocado.
- [ ] Worker build pasa localmente si fue tocado.
- [ ] Variables requeridas revisadas.
- [ ] Healthcheck no cambió accidentalmente.
- [ ] Prisma no tiene migración pendiente accidental.

## Después de deploy

- [ ] Web responde.
- [ ] API health responde.
- [ ] Worker no reinicia en loop.
- [ ] Logs sin TypeScript/build errors.
- [ ] Rutas Admin cargan.
- [ ] Railway marca success.

