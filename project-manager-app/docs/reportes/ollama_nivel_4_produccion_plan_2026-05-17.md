# Plan de Producción — Ollama Nivel 4

**Fecha:** 2026-05-17  
**Estado:** Nivel 4A — Código listo, infraestructura pendiente  
**Prerequisito:** Niveles 1-3.5 cerrados ✅

---

## Arquitectura recomendada

```
┌─────────────────────────────────────────────────────┐
│                      Railway                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Web     │  │  API     │  │  Worker          │  │
│  │ (Next.js)│  │ (NestJS) │  │ (queue consumer) │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│  ┌──────────┐  ┌──────────┐                         │
│  │ Postgres │  │  Redis   │                         │
│  └──────────┘  └──────────┘                         │
└─────────────────────────────────────────────────────┘
         │                  │
         │ OLLAMA_BASE_URL  │ ANTHROPIC_API_KEY
         ↓                  ↓
┌────────────────┐    ┌─────────────┐
│  VPS / GPU     │    │  Anthropic  │
│  Ollama Server │    │  OpenAI     │
│  qwen2.5:3b    │    │ (fallback)  │
└────────────────┘    └─────────────┘
```

---

## Tabla comparativa de opciones

| Opción | Costo | Latencia | GPU | Recomendado para |
|--------|-------|----------|-----|-----------------|
| Railway directo (CPU) | $0 extra | 60-120s | No | Pruebas rápidas, NO producción |
| VPS CPU (4-8 core) | $10-30/mes | 40-90s | No | Tareas asincrónicas (analysis, batch) |
| VPS GPU (RTX 3060+) | $80-200/mes | 1-5s | Sí | **Producción interactiva** ✅ |
| Cloud GPU (RunPod, Lambda) | $0.20-0.50/h | 1-3s | Sí | Staging, bursts |
| Anthropic/OpenAI siempre | API costs | <2s | N/A | Fallback, tareas complejas |

**Recomendación:** VPS con GPU para Ollama + Railway para API/Web/Worker.

---

## Requisitos mínimos del servidor Ollama

### Para modelos 3B (desarrollo/staging)
```
CPU:  4 cores
RAM:  8 GB (6 GB para modelo + 2 GB OS)
Disk: 20 GB SSD
Red:  100 Mbps
OS:   Ubuntu 22.04 LTS
GPU:  Opcional (acelera 10-50x)
```

### Para producción interactiva (recomendado)
```
CPU:  8+ cores
RAM:  16 GB
GPU:  RTX 3060 (12 GB VRAM) o superior
Disk: 50 GB NVMe
Red:  1 Gbps
OS:   Ubuntu 22.04 LTS con drivers NVIDIA
```

### Modelos recomendados por caso de uso
```
qwen2.5:3b  → operaciones estándar SEMSE (change orders, evidence, summaries)
qwen2.5:7b  → mejor precisión JSON, razonamiento más complejo
llama3.1:8b → alternativa con mejor manejo de instrucciones
mistral:7b  → buena relación precio/rendimiento
```

---

## Variables de entorno para Railway

```env
# ── Ollama (VPS/GPU externo) ───────────────────────────────────────────────
LLM_NATIVE_PROVIDER=ollama
LLM_DEFAULT_PROVIDER=ollama
LLM_FALLBACK_PROVIDERS=anthropic,openai,template
LLM_EXTERNAL_FALLBACK_PROVIDER=anthropic

ENABLE_OPEN_SOURCE_MODELS=true
OLLAMA_BASE_URL=http://<vps-ip>:11434        # o https:// con reverse proxy
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_TIMEOUT_MS=30000                       # GPU: 30s suficiente
OLLAMA_HEALTH_TIMEOUT_MS=5000
OLLAMA_API_KEY=<token>                        # si VPS tiene autenticación

# ── Fallback externos ─────────────────────────────────────────────────────
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

---

## Seguridad del servidor Ollama

### Opciones de protección (elegir una)

**Opción A — Firewall + IP whitelist (más simple)**
```bash
# En el VPS: solo permitir Railway IPs
ufw allow from <railway-egress-ip> to any port 11434
ufw deny 11434
```

**Opción B — Reverse proxy con Basic Auth (nginx)**
```nginx
server {
  listen 443 ssl;
  location /ollama/ {
    auth_basic "SEMSE Ollama";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://localhost:11434/;
  }
}
```
Con `OLLAMA_BASE_URL=https://vps.example.com/ollama` y `OLLAMA_API_KEY` para autenticación.

**Opción C — Tailscale/WireGuard VPN (más seguro)**
```bash
# Railway → VPN privada → VPS
# Ollama solo escucha en VPN interface
OLLAMA_HOST=100.x.x.x:11434  # IP interna VPN
```

**Opción D — Token Bearer (si Ollama lo soporta en versión futura)**  
`OLLAMA_API_KEY` ya está implementado en `OllamaProvider` como Bearer token.

---

## Setup del servidor Ollama (runbook)

```bash
# 1. Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Configurar servicio (systemd)
sudo systemctl enable ollama
sudo systemctl start ollama

# 3. Exponer en red (por defecto solo localhost)
# Editar /etc/systemd/system/ollama.service:
# Environment="OLLAMA_HOST=0.0.0.0:11434"
sudo systemctl daemon-reload
sudo systemctl restart ollama

# 4. Descargar modelos
ollama pull qwen2.5:3b
ollama pull qwen2.5:0.5b  # backup ligero

# 5. Verificar
ollama list
curl http://localhost:11434/api/tags

# 6. Test remoto desde laptop
curl http://<vps-ip>:11434/api/tags
```

---

## Criterios de aceptación para Nivel 4

```
□ Servidor Ollama corriendo en VPS/GPU
□ ollama list muestra qwen2.5:3b (o modelo elegido)
□ OLLAMA_BASE_URL apunta al VPS
□ GET /v1/ops/ai-mission-control/ollama/health responde serverOk=true modelLoaded=true
□ POST /v1/ops/ai-mission-control/ollama/test responde provider=ollama fallbackUsed=false
□ Latencia warm <5s con GPU / <60s con CPU
□ scripts/smoke-ollama-remote-level4.mjs pasa en modo remoto
□ localOnly → ollama → template (nunca cloud)
□ privacyCritical → ollama → template (nunca cloud)
□ Si Ollama falla → fallback a anthropic (para default) o template (para localOnly)
□ Logs muestran provider=ollama routingReason=default fallbackUsed=false
□ Railway Service Variables configuradas correctamente
□ .env local no commiteado
□ TypeScript 0 errores, nest build OK
```

---

## Performance esperada

| Hardware | Modelo | Primera carga | Warm | Tipo tarea |
|----------|--------|--------------|------|------------|
| CPU 8-core | qwen2.5:3b | ~85s | ~60s | Análisis async |
| GPU RTX 3060 | qwen2.5:3b | ~8s | ~2s | Interactivo ✅ |
| GPU RTX 3060 | qwen2.5:7b | ~15s | ~4s | Razonamiento ✅ |
| GPU A100 | qwen2.5:3b | ~2s | <1s | Producción alta carga |

---

## Routing en producción

```
Request SEMSE
│
├── localOnly=true     → ollama → template (NUNCA cloud)
├── privacyCritical    → ollama → template (NUNCA cloud)  
├── requiresTools      → anthropic → openai → template
├── riskLevel=high     → anthropic → openai → template
└── default            → ollama → anthropic → openai → template
                                    ↑
                    Si ollama falla, fallback controlado a anthropic
```

**Regla de oro en producción:**
```
Si Ollama (VPS/GPU) está caído y el request es localOnly/privacyCritical:
→ Usar template (respuesta basada en reglas)
→ Registrar evento en IA Mission Control
→ No usar Anthropic/OpenAI
→ No silenciar el error
```

---

## Plan de migración paso a paso

```
Nivel 4A: Código preparado (COMPLETADO)
  ✅ OLLAMA_API_KEY soportado
  ✅ modelHealthCheck() verifica modelo específico
  ✅ GET /ollama/health y POST /ollama/test
  ✅ smoke-ollama-remote-level4.mjs
  ✅ Routing policy intacta

Nivel 4B: Servidor Ollama en VPS
  □ Elegir proveedor VPS (DigitalOcean, Hetzner, Vultr, RunPod)
  □ Instalar Ollama + modelo
  □ Configurar seguridad (firewall / reverse proxy / VPN)
  □ Probar desde laptop local

Nivel 4C: Conectar Railway staging
  □ Configurar OLLAMA_BASE_URL en Railway (staging environment)
  □ Verificar GET /v1/ops/ai-mission-control/ollama/health
  □ Ejecutar smoke-ollama-remote-level4.mjs contra staging

Nivel 4D: Smoke de producción
  □ Ejecutar smoke-ollama-real-flow.mjs contra staging
  □ Verificar logs provider=ollama en Railway
  □ Verificar fallback anthropic si se desconecta VPS

Nivel 4E: Producción
  □ Configurar OLLAMA_BASE_URL en Railway (producción)
  □ Monitor IA Mission Control 24h
  □ Alertas si Ollama falla > 3 veces consecutivas
  □ Documentar runbook de incidentes
```

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| VPS sin GPU lento en producción | Alta | Alto | Usar tareas asincrónicas o GPU |
| Seguridad Ollama expuesto | Media | Alto | Firewall + auth + VPN |
| Modelo no cargado al inicio | Media | Medio | Health check + auto-pull |
| Latencia variable en VPS | Media | Medio | Circuit breaker + fallback |
| Costos GPU si escala | Media | Medio | Usar Ollama solo para localOnly/privacyCritical |
| JSON inválido en producción | Baja | Medio | Zod validation + retry implementado |
| Prompt injection | Baja | Medio | Guardrails implementados |

---

## Rollback plan

Si Ollama produce problemas en producción:
```bash
# Opción 1: Cambiar default a anthropic (sin código)
# En Railway Service Variables:
LLM_DEFAULT_PROVIDER=anthropic
ENABLE_OPEN_SOURCE_MODELS=false

# Opción 2: Deshabilitar solo Ollama
ENABLE_OPEN_SOURCE_MODELS=false
# El router cae a anthropic automáticamente

# Opción 3: Circuit breaker automático
# Ya implementado: 3 fallos consecutivos → circuit abierto
# El sistema fallback a anthropic sin intervención manual
```

---

## Endpoints admin disponibles

```
GET  /v1/ops/ai-mission-control/summary    → resumen sistema IA
GET  /v1/ops/ai-mission-control/providers  → estado todos los providers
GET  /v1/ops/ai-mission-control/ollama/health  → health + model check
POST /v1/ops/ai-mission-control/ollama/test    → test real (requiere write)
GET  /v1/ops/ai-mission-control/llm-runs   → métricas por provider×taskType
GET  /v1/ops/llm/metrics                   → métricas raw
```

---

## Conclusión

**Nivel 4A cerrado:** El código de SEMSE ya está preparado para apuntar a un servidor Ollama remoto. Solo falta la infraestructura.

**Próximo paso real:** Elegir un VPS con GPU (recomendado: RunPod, Hetzner Cloud, DigitalOcean GPU Droplet) e instalar Ollama con `qwen2.5:3b`.

El costo estimado de un VPS con GPU RTX 3060 para beta privada: **$80-120/mes**.  
Para desarrollo y tareas async sin urgencia: un VPS CPU de **$20-30/mes** es suficiente.
