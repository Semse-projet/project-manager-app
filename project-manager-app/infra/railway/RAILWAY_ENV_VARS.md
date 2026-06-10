# Railway Environment Variables Configuration

This guide documents all required environment variables for SEMSE services on Railway.

## Critical Security Rules

1. **NEVER commit .env files with real secrets** — Use `.env.example` templates only
2. **Set all secrets as Railway Service Variables** (via Railway console at runtime)
3. **DO NOT embed secrets in Build Variables** — they would be baked into Docker images
4. **Use private Railway URLs** (`*.railway.internal`) for inter-service communication (faster, no public internet)

## Service Variables by Application

### API Service (`semse-api`)

These must be set in Railway console as Service Variables (not build args):

| Variable | Type | Required | Source | Notes |
|----------|------|----------|--------|-------|
| `DATABASE_URL` | string | ✓ | Railway Postgres plugin | PostgreSQL connection string |
| `REDIS_URL` | string | ✓ | Railway Redis plugin | Redis connection string |
| `AUTH_SECRET` | string | ✓ | Generated | `openssl rand -hex 32` — min 32 chars |
| `SEMSE_BOOTSTRAP_TOKEN` | string | ✓ | Generated | Used by worker and internal services |
| `ANTHROPIC_API_KEY` | string | optional | User secret | For LLM fallback (tool calling, premium models) |
| `OPENAI_API_KEY` | string | optional | User secret | For LLM fallback |
| `NODE_ENV` | string | ✓ | Value: `production` | |
| `PORT` | number | ✓ | Value: `4000` | Listening port inside container |
| `HOST` | string | ✓ | Value: `0.0.0.0` | Accept connections on all interfaces |
| `SEMSE_API_BASE_URL` | string | ✓ | Value: `https://semse-api-xxxx.railway.app` | External public URL for clients |
| `CORS_ORIGINS` | string | ✓ | Value: `https://semse-web-xxxx.railway.app` | Comma-separated allowed origins |
| `ENABLE_LLM_ROUTER` | string | ✓ | Value: `true` | Route requests to best LLM provider |
| `LLM_NATIVE_PROVIDER` | string | ✓ | Value: `ollama` | Prefer local Ollama for cost/latency |
| `LLM_DEFAULT_PROVIDER` | string | ✓ | Value: `ollama` | Default provider for all requests |
| `OLLAMA_BASE_URL` | string | ✓ | Value: `http://ollama.railway.internal:11434` | Internal Railway address (no auth) |
| `OLLAMA_MODEL` | string | ✓ | Value: `qwen2.5:3b` | Model size: 0.5b (fast), 3b (balanced), 7b (quality) |
| `OLLAMA_TIMEOUT_MS` | number | ✓ | Value: `120000` | CPU-based Railway: 120s | GPU: 30s |
| `STORAGE_PROVIDER` | string | ✓ | Value: `s3` | Use S3 instead of local filesystem |
| `AWS_S3_BUCKET` | string | optional | User secret | S3 bucket for file storage |
| `AWS_ACCESS_KEY_ID` | string | optional | User secret | S3 credentials |
| `AWS_SECRET_ACCESS_KEY` | string | optional | User secret | S3 credentials |

**Example .env for local testing** (never commit with real values):
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/semse_prod"
REDIS_URL="redis://127.0.0.1:6379"
AUTH_SECRET=$(openssl rand -hex 32)
SEMSE_BOOTSTRAP_TOKEN=$(openssl rand -hex 32)
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
SEMSE_API_BASE_URL=https://semse-api-xxxx.railway.app
CORS_ORIGINS=https://semse-web-xxxx.railway.app
ENABLE_LLM_ROUTER=true
LLM_NATIVE_PROVIDER=ollama
LLM_DEFAULT_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama.railway.internal:11434
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_TIMEOUT_MS=120000
STORAGE_PROVIDER=s3
```

### Web Service (`semse-web`)

These must be set as Service Variables (NOT build args):

| Variable | Type | Required | Source | Notes |
|----------|------|----------|--------|-------|
| `AUTH_SECRET` | string | ✓ | Generated | `openssl rand -hex 32` — session middleware secret |
| `SEMSE_API_BASE_URL` | string | ✓ | Value: `http://semse-api.railway.internal:4000` | Internal URL (fast, private network) |
| `SEMSE_BOOTSTRAP_TOKEN` | string | ✓ | Generated | For auth middleware internal calls |
| `NODE_ENV` | string | ✓ | Value: `production` | |

**Build Args (baked into Docker image, can be public):**
```
NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED=true
NEXT_PUBLIC_SEMSE_DEMO_LOGIN_ENABLED=false
```

These are set via Build Arguments in Railway console (not Service Variables).

### Worker Service (`semse-worker`)

| Variable | Type | Required | Source | Notes |
|----------|------|----------|--------|-------|
| `REDIS_URL` | string | ✓ | Railway Redis | Queue backend |
| `SEMSE_API_URL` | string | ✓ | Value: `http://semse-api.railway.internal:4000` | Private Railway URL |
| `SEMSE_BOOTSTRAP_TOKEN` | string | ✓ | Same as API | Authentication to API |
| `NODE_ENV` | string | ✓ | Value: `production` | |

### Ollama Service (`semse-ollama`)

| Variable | Type | Required | Source | Notes |
|----------|------|----------|--------|-------|
| `OLLAMA_MODEL` | string | ✓ | Value: `qwen2.5:3b` | Model to preload on startup |

## How to Configure in Railway Console

1. **Go to your Railway project** → select service (API, Web, Worker, Ollama)
2. **Click "Variables"** tab
3. **Add each variable:**
   - Paste from list above
   - Mark sensitive vars with the "secret" toggle (e.g., `AUTH_SECRET`, API keys)
   - Click "Deploy" to apply changes

### Private URLs Between Services

- **API ↔ Web:** Use `http://semse-api.railway.internal:4000`
- **API ↔ Worker:** Use `http://semse-api.railway.internal:4000`
- **Web → Ollama:** (Web doesn't talk to Ollama, API does)
- **API → Ollama:** Use `http://ollama.railway.internal:11434`

These internal addresses are:
- **Fast** (no public internet routing)
- **Secure** (only accessible within Railway private network)
- **Require no authentication** when on same project

## Build Configuration

`railway.json` specifies the build strategy:

```json
{
  "build": {
    "builder": "DOCKERFILE"
  }
}
```

- **Builder: DOCKERFILE** — Uses Dockerfile.api, Dockerfile.web, etc.
- Each service has its own Dockerfile with proper multi-stage builds
- Build arguments are baked into images (OK for non-sensitive values)
- Runtime service variables override environment at container start

## Health Checks & Observability

Each service includes health checks:

- **API:** `GET /health` on port 4000
- **Web:** Next.js built-in health checks
- **Worker:** Heartbeat to Redis
- **Ollama:** Health endpoint on port 11434

Failed health checks trigger automatic restart (see `railway.json` deploy policy).

## Troubleshooting

### "Cannot reach API from Web"
- Verify `SEMSE_API_BASE_URL` in Web service points to `http://semse-api.railway.internal:4000`
- Check API service is running: `railway logs --service semse-api`

### "Ollama timeout"
- Increase `OLLAMA_TIMEOUT_MS` if using CPU-based Railway (default 120s is safe)
- Check Ollama memory: `railway logs --service semse-ollama | grep "loaded"`
- GPU instances need less timeout (30s is typical)

### "401 Unauthorized from API"
- Verify `SEMSE_BOOTSTRAP_TOKEN` matches between API and Worker/Web
- Check token is not empty or whitespace
- Restart services after changing tokens

## References

- [Railway Private Networks](https://docs.railway.app/deploy/private-networking)
- [Railway Variables Documentation](https://docs.railway.app/develop/variables)
- [SEMSE Constitution](../../docs/SEMSE_CONSTITUTION.md)
- [Auth Design](../../docs/auth.md)
