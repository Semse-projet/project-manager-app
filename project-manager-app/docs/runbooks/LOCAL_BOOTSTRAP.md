# Local Bootstrap (MVP stack)

## Prerrequisitos
- Node.js >= 20
- Docker + Docker Compose

## Boot rápido
```bash
cd /home/yoni/labsemse/project-manager-app
docker compose -f infra/docker/compose.semse-mvp.yml up -d
npm run bootstrap:semse
npm run db:migrate
```

Servicios esperados:
- Postgres: `127.0.0.1:5433`
- Redis: `localhost:6379`
- MinIO API: `localhost:9000`
- MinIO Console: `localhost:9001`
- MailHog UI: `localhost:8025`

## Próximo paso
```bash
npm run dev:api
npm run dev:web
npm run dev:worker
```

## Verificación rápida
```bash
npm run check
```

Nota:
- `apps/web` ejecuta Next con `NEXT_IGNORE_INCORRECT_LOCKFILE=1` para evitar ruido por lockfiles ajenos fuera del repo.
- `npm run db:migrate` aplica migraciones ya versionadas del repo contra tu base local.
