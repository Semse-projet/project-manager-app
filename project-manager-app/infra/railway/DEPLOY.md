# Deploy SEMSE OS on Railway

This runbook assumes one Railway project with five resources:

1. `semse-api`
2. `semse-web`
3. `semse-worker`
4. PostgreSQL
5. Redis

It uses service-specific config-as-code files:

- `/infra/railway/api.railway.json`
- `/infra/railway/web.railway.json`
- `/infra/railway/worker.railway.json`

Railway supports custom config-as-code paths per service and lets the file override build/deploy settings for that deployment only.

## 1. Create the Railway project

1. Create a new Railway project.
2. Connect the GitHub repository that contains this monorepo.
3. Add:
   - PostgreSQL
   - Redis

## 2. Create the three app services

Create three empty services from the same repo:

1. `semse-api`
2. `semse-web`
3. `semse-worker`

In each service, set:

1. Source repo: this repository
2. Root directory: repo root
3. Config-as-code path:
   - API: `/infra/railway/api.railway.json`
   - Web: `/infra/railway/web.railway.json`
   - Worker: `/infra/railway/worker.railway.json`

## 3. Add the API volume

The API stores uploads on the filesystem when `STORAGE_PROVIDER=local`.
Without a volume, evidence files disappear on redeploy.

Create one Railway volume and mount it on the API service at:

`/data`

## 4. Set shared secrets

Set the same values on API, Web and Worker:

```env
NODE_ENV=production
AUTH_SECRET=<64+ char secret>
SEMSE_BOOTSTRAP_TOKEN=<second secret for internal token bootstrap>
```

Notes:

- `AUTH_SECRET` now protects API auth tokens and signs the web session cookie.
- `SEMSE_BOOTSTRAP_TOKEN` protects `POST /v1/auth/token` so only internal services can mint bootstrap access tokens.

## 5. Set API variables

```env
PORT=4000
HOST=::
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
CORS_ORIGINS=https://app.semseproject.com,https://semseproject.com
SEMSE_API_BASE_URL=https://api.semseproject.com
SEMSE_WEB_BASE_URL=https://app.semseproject.com
SEMSE_DEMO_MODE=false
STORAGE_PROVIDER=local
SEMSE_STORAGE_ROOT=/data/semse-storage
SEMSE_MULTIPART_STORAGE_ROOT=/data/semse-storage/multipart
RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_LIMIT=20
ENABLE_LLM_ROUTER=true
LLM_DEFAULT_PROVIDER=anthropic
LLM_FALLBACK_PROVIDERS=anthropic,openai,template
ANTHROPIC_API_KEY=<optional but strongly recommended>
OPENAI_API_KEY=<optional>
STRIPE_SECRET_KEY=<optional, Block B>
```

## 6. Set Web variables

Use Railway private networking for server-to-server API calls:

```env
PORT=3000
HOSTNAME=0.0.0.0
SEMSE_API_BASE_URL=http://semse-api.railway.internal:4000
NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED=true
NEXT_PUBLIC_SEMSE_DEMO_LOGIN_ENABLED=false
SEMSE_TENANT_ID=tenant_default
SEMSE_ORG_ID=org_admin_001
SEMSE_USER_ID=usr_admin_001
SEMSE_ROLES=OPS_ADMIN
```

Notes:

- On the Web service, `SEMSE_API_BASE_URL` should be the private API URL, not the public API domain.
- Keep `NEXT_PUBLIC_SEMSE_DEMO_LOGIN_ENABLED=false` in production.

## 7. Set Worker variables

```env
SEMSE_API_URL=http://semse-api.railway.internal:4000
REDIS_URL=${{Redis.REDIS_URL}}
SEMSE_WORKER_ID=worker-primary
SEMSE_TENANT_ID=tenant_default
SEMSE_ORG_ID=org_admin_001
SEMSE_USER_ID=usr_admin_001
SEMSE_ROLES=OPS_ADMIN,WORKER
SEMSE_HEARTBEAT_MS=2500
SEMSE_RUN_SIM_MS=4000
SEMSE_FAIL_RATE=0
SEMSE_RECLAIM_MS=10000
SEMSE_STALE_AFTER_MS=10000
```

## 8. Domains

Attach domains:

- API: `api.semseproject.com`
- Web: `app.semseproject.com`

Then update:

- API `SEMSE_API_BASE_URL`
- API `SEMSE_WEB_BASE_URL`
- API `CORS_ORIGINS`

## 9. First deploy

Deploy all three services.

The API config runs:

```bash
npm run db:migrate
```

as a Railway pre-deploy command before the new deployment starts.

Important Railway detail:

- pre-deploy commands run in a separate container with env vars available
- they do not persist filesystem changes and do not mount volumes
- that is fine for Prisma migrations, but not for upload/data initialization

## 10. Seed demo data once

Run this once after Postgres is ready:

```bash
railway run --service semse-api npm run db:seed
```

This seeds the demo tenant and demo users:

- `client@demo.semse`
- `worker@demo.semse`
- `admin@demo.semse`

The login flow now authenticates against the API instead of issuing unsigned demo cookies directly in the web layer.

## 11. Verify

API:

```bash
curl https://api.semseproject.com/v1/health
```

Web:

```bash
curl https://app.semseproject.com/api/semse/healthz
```

Expected:

- API returns HTTP 200
- Web returns HTTP 200
- Railway healthchecks go green for API and Web
- Worker starts without restart loops
- Logging in via `/login` creates a valid signed session cookie

## 12. Production checklist before Block B

- API and Web have public domains
- API and Web healthchecks are green
- PostgreSQL migrations run clean on deploy
- Redis is connected
- API volume exists and is mounted at `/data`
- Demo login UI is disabled in production
- `AUTH_SECRET` and `SEMSE_BOOTSTRAP_TOKEN` are set on all three services
- `SEMSE_API_BASE_URL` is public on API and private on Web

## Reference docs

- Railway config as code: https://docs.railway.com/deploy/config-as-code
- Railway config reference: https://docs.railway.com/reference/config-as-code
- Railway pre-deploy commands: https://docs.railway.com/deployments/pre-deploy-command
- Railway healthchecks: https://docs.railway.com/reference/healthchecks
