# Ollama en Railway — Guía de despliegue

**Fecha:** 2026-05-17  
**Alternativa a:** Nivel 4B VPS/GPU externo  
**Ventaja:** Sin servidor separado, red interna privada, mismo proyecto Railway

---

## Arquitectura

```
Railway Project
  ├── API (NestJS)    → OLLAMA_BASE_URL=http://ollama.railway.internal:11434
  ├── Web (Next.js)
  ├── Worker
  ├── Postgres
  ├── Redis
  └── Ollama (nuevo) → imagen Docker ollama/ollama, volume en /root/.ollama
```

La comunicación API → Ollama es por **red interna privada** (`railway.internal`).  
**No se expone públicamente** — no necesita auth ni nginx.

---

## Paso 1 — Crear servicio Ollama en Railway

### Via Dashboard (recomendado):

1. Abre tu proyecto en [railway.app](https://railway.app)
2. Click **"New Service"** → **"Docker Image"**
3. Image: `ollama/ollama:latest`
4. O mejor: **"GitHub Repo"** → seleccionar el repo → usar `Dockerfile.ollama`

### Variables de entorno del servicio Ollama:

```env
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_HOST=0.0.0.0:11434
PORT=11434
```

### Volume (crítico para persistir modelos):

En Railway Dashboard → servicio Ollama → **Volumes** → **Add Volume**:
```
Mount Path: /root/.ollama
Size: 5 GB mínimo (qwen2.5:3b = 1.9 GB + espacio)
```

Sin el volume, el modelo se descarga en cada restart (~5 min).

---

## Paso 2 — Actualizar variables en servicio API

En Railway → servicio API → Variables:

```env
LLM_DEFAULT_PROVIDER=ollama
ENABLE_OPEN_SOURCE_MODELS=true
OLLAMA_BASE_URL=http://ollama.railway.internal:11434
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_TIMEOUT_MS=120000
LLM_FALLBACK_PROVIDERS=anthropic,openai,template
```

**Nota:** Sin `OLLAMA_API_KEY` — la red interna es privada y segura.

---

## Paso 3 — Deploy

1. Railway detecta `Dockerfile.ollama` automáticamente
2. El script `ollama-start.sh`:
   - Arranca el servidor Ollama
   - Descarga `qwen2.5:3b` si no está en el volume
   - Hace warm-up (carga el modelo en RAM)
   - Queda sirviendo

**Primera vez:** ~5-10 minutos (descarga 1.9 GB del modelo)  
**Restarts subsiguientes:** ~2-3 minutos (modelo ya en volume)

---

## Paso 4 — Validar

### Health check desde la API:

```bash
curl https://api.semseproject.com/v1/ops/ai-mission-control/ollama/health \
  -H "Authorization: Bearer <jwt>"
```

Esperado:
```json
{
  "registered": true,
  "serverOk": true,
  "modelLoaded": true,
  "isRemote": false,
  "configuredModel": "qwen2.5:3b"
}
```

**Nota:** `isRemote=false` porque `railway.internal` no es `localhost` pero tampoco es una IP externa. El código detecta esto por la URL.

### Smoke script (apuntando a Railway):

```bash
cd apps/api
OLLAMA_BASE_URL=http://ollama.railway.internal:11434 \
OLLAMA_MODEL=qwen2.5:3b \
node scripts/smoke-ollama-remote-level4.mjs
```

---

## Paso 5 — Modelo alternativo (si RAM es limitada)

Si Railway tiene límites de RAM (<4GB) o el 3b es lento:

```env
OLLAMA_MODEL=qwen2.5:0.5b   # 397 MB, mucho más rápido en CPU
OLLAMA_TIMEOUT_MS=30000      # 0.5b responde en ~4-8s warm
```

---

## Costos estimados

| Plan Railway | RAM | Ollama viable | Modelo |
|-------------|-----|--------------|--------|
| Starter $5/mes | 512 MB | ❌ Insuficiente | — |
| Pro (~$20/mes) | 8 GB | ✅ | qwen2.5:3b (lento) |
| Pro con más RAM | 16+ GB | ✅ mejor | qwen2.5:3b o 7b |

**Railway Pro** es necesario para un modelo 3B. El Starter no tiene suficiente RAM.

---

## Ventajas vs VPS externo

| | Railway Ollama | VPS/GPU externo |
|--|---------------|-----------------|
| Seguridad | Red interna privada | Nginx/firewall/VPN |
| Auth | No necesaria | OLLAMA_API_KEY |
| Latencia (CPU) | ~60-120s | ~60-120s |
| Latencia (GPU) | ❌ No disponible | ~1-5s |
| Setup | 15 min | 1-2 horas |
| Costo | Incluido en Pro | $20-150/mes extra |
| GPU para producción | ❌ | ✅ RunPod/Hetzner |

**Conclusión:** Railway Ollama es perfecto para desarrollo y tareas async. Para chat interactivo en producción, necesitas GPU externo.

---

## Rollback

Si Ollama Railway falla o es demasiado lento:

```env
# En Railway API Variables:
LLM_DEFAULT_PROVIDER=anthropic
ENABLE_OPEN_SOURCE_MODELS=false
```

El sistema cae automáticamente a Anthropic. Sin deploy adicional.

---

## Archivos creados

| Archivo | Propósito |
|---------|----------|
| `Dockerfile.ollama` | Imagen Docker con startup script |
| `scripts/ollama-start.sh` | Arranca servidor + descarga modelo + warm-up |
| `infra/railway/ollama.railway.json` | Config Railway para el servicio |
| `.env.example` actualizado | Variables documentadas para Railway interno |
