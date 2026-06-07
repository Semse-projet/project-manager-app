# Nivel 4B — Runbook Ollama Remoto

**Fecha:** 2026-05-17  
**Prerequisito:** Nivel 4A cerrado — código listo para OLLAMA_BASE_URL remoto  
**Objetivo:** Conectar Railway API → Ollama VPS/GPU externo

---

## 1. Requisitos recomendados de VPS/GPU

### Para validar conectividad (4B-test — CPU)

```
Proveedor: Hetzner CX21 / DigitalOcean 4GB / Vultr Regular
CPU:  2-4 vCPUs
RAM:  4-8 GB
Disk: 40 GB SSD
OS:   Ubuntu 22.04 LTS
Costo: ~$6-20/mes
GPU:  No (solo para probar que el pipe funciona)
Nota: qwen2.5:3b tardará ~60s warm, ~85s cold — útil solo para tareas async
```

### Para producción interactiva (4B-prod — GPU)

```
Opción A — RunPod (cloud GPU por hora)
  GPU:  RTX 3090 (24 GB VRAM) o RTX 4090
  Costo: ~$0.35-0.75/hora
  Útil para: staging, burst, pruebas de producción sin compromiso mensual

Opción B — Hetzner GPU VPS
  GPU:  NVIDIA A30 o similar
  Costo: ~$80-150/mes
  Útil para: producción continua con costo predecible

Opción C — DigitalOcean GPU Droplet
  GPU:  NVIDIA H100
  Costo: desde ~$3.50/hora
  Útil para: staging de alta performance

Opción D — Servidor propio con GPU (RTX 3060+)
  GPU:  RTX 3060 12GB VRAM
  Costo: hardware único ~$400-600
  Útil para: producción privada sin costos recurrentes de hosting
```

### Requisitos mínimos de RAM por modelo

```
qwen2.5:0.5b  →  ~1 GB RAM  (sin GPU: fast, con GPU: muy fast)
qwen2.5:3b    →  ~4 GB RAM  (sin GPU: ~60s warm, con GPU: ~2s)
qwen2.5:7b    →  ~8 GB RAM  (sin GPU: lento, con GPU: ~3-5s)
llama3.1:8b   →  ~8 GB RAM  (similar a 7b)
```

---

## 2. Instalación de Ollama en el VPS

```bash
# Conectarse al VPS
ssh root@<vps-ip>

# Actualizar sistema
apt update && apt upgrade -y

# Instalar Ollama (instala automáticamente como servicio systemd)
curl -fsSL https://ollama.com/install.sh | sh

# Verificar servicio
systemctl status ollama

# Ver logs
journalctl -u ollama -f
```

---

## 3. Configuración systemd

Por defecto, Ollama escucha solo en `127.0.0.1:11434`. Para exponerlo en red:

```bash
# Editar el servicio
systemctl edit ollama
```

Añadir en el editor:
```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

```bash
# Recargar y reiniciar
systemctl daemon-reload
systemctl restart ollama

# Verificar que escucha en 0.0.0.0
ss -tlnp | grep 11434
```

**Alternativa con variable de entorno:**
```bash
# En /etc/systemd/system/ollama.service.d/override.conf
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_MODELS=/var/lib/ollama/models"
```

---

## 4. Descarga del modelo

```bash
# Modelo principal de SEMSE
ollama pull qwen2.5:3b

# Modelo ligero para desarrollo/fallback rápido
ollama pull qwen2.5:0.5b

# Verificar
ollama list

# Prueba rápida
ollama run qwen2.5:3b "Responde solo con: OK"
```

---

## 5. Protección del endpoint

### Opción A — Firewall solo (más simple, menos seguro)

```bash
# Instalar ufw
apt install ufw -y
ufw default deny incoming
ufw allow ssh
ufw allow from <railway-egress-ip> to any port 11434
# Para HTTPS si usas reverse proxy:
ufw allow 443

ufw enable
```

**Nota:** Railway no tiene IP egress estática fija en todos los planes. Verificar en Railway settings → Networking.

### Opción B — Reverse proxy nginx con autenticación (recomendado)

```bash
# Instalar nginx y herramientas
apt install nginx apache2-utils certbot python3-certbot-nginx -y

# Crear usuario/password para SEMSE API
htpasswd -c /etc/nginx/.htpasswd semse
# (ingresar el password — este será el OLLAMA_API_KEY que uses en SEMSE)

# Crear config nginx
cat > /etc/nginx/sites-available/ollama << 'EOF'
server {
    listen 443 ssl;
    server_name ollama.tudominio.com;

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/ollama.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ollama.tudominio.com/privkey.pem;

    location / {
        auth_basic "SEMSE Ollama";
        auth_basic_user_file /etc/nginx/.htpasswd;

        proxy_pass http://127.0.0.1:11434;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 300s;  # Ollama puede tardar en responder
        proxy_connect_timeout 10s;
    }
}
EOF

# Habilitar
ln -s /etc/nginx/sites-available/ollama /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL con Let's Encrypt
certbot --nginx -d ollama.tudominio.com
```

Con esta configuración:
- `OLLAMA_BASE_URL=https://ollama.tudominio.com`
- `OLLAMA_API_KEY=<password del htpasswd>` (SEMSE lo usará como Bearer token)

**Nota importante:** `OllamaProvider` en SEMSE envía `Authorization: Bearer <OLLAMA_API_KEY>`. nginx Basic Auth usa formato diferente. Si usas nginx Basic Auth, necesitas ajustar el header en `authHeaders()`:

```ts
// Para Basic Auth: usar base64(usuario:password)
private authHeaders(): Record<string, string> {
  if (!this.apiKey) return {};
  // Si el apiKey ya es base64 de "user:pass", usar Authorization: Basic
  if (this.apiKey.startsWith('Basic ')) return { Authorization: this.apiKey };
  return { Authorization: `Bearer ${this.apiKey}` };
}
```

O más simple: configurar nginx para aceptar Bearer token:
```nginx
location / {
    if ($http_authorization != "Bearer tu-token-secreto") {
        return 401;
    }
    proxy_pass http://127.0.0.1:11434;
    ...
}
```

### Opción C — Tailscale VPN (la más segura, sin exponer puerto 11434)

```bash
# En el VPS
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# En Railway: conectar via Tailscale (requiere Railway Private Networking)
# OLLAMA_BASE_URL=http://100.x.x.x:11434  (IP interna Tailscale)
# No necesitas OLLAMA_API_KEY — la red es privada
```

---

## 6. Variables exactas para Railway

En Railway → Service → Variables, configurar:

```env
# Ollama remoto
LLM_DEFAULT_PROVIDER=ollama
LLM_NATIVE_PROVIDER=ollama
LLM_FALLBACK_PROVIDERS=anthropic,openai,template
LLM_EXTERNAL_FALLBACK_PROVIDER=anthropic
ENABLE_OPEN_SOURCE_MODELS=true

OLLAMA_BASE_URL=https://ollama.tudominio.com   # con nginx
# ó
OLLAMA_BASE_URL=http://100.x.x.x:11434         # con Tailscale
# ó
OLLAMA_BASE_URL=http://<vps-ip>:11434          # sin protección (no recomendado)

OLLAMA_MODEL=qwen2.5:3b
OLLAMA_TIMEOUT_MS=30000       # GPU: 30s | CPU: 120000
OLLAMA_HEALTH_TIMEOUT_MS=5000
OLLAMA_API_KEY=<token>        # solo si usas auth (nginx Bearer / Basic)
```

**No eliminar variables de Anthropic/OpenAI** — siguen siendo fallback externo.

---

## 7. Cómo probar desde local

```bash
# 1. Test básico de conectividad
curl https://ollama.tudominio.com/api/tags \
  -H "Authorization: Bearer <token>"

# 2. Test de chat directo
curl https://ollama.tudominio.com/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5:3b","messages":[{"role":"user","content":"OK"}],"stream":false}'

# 3. Smoke script SEMSE con URL remota
OLLAMA_BASE_URL=https://ollama.tudominio.com \
OLLAMA_API_KEY=<token> \
node apps/api/scripts/smoke-ollama-remote-level4.mjs

# Verificar en output:
# Modo = REMOTO ☁️
# B → Servidor Ollama responde ✅
# B → Modelo 'qwen2.5:3b' disponible ✅
# G → provider=ollama, fallbackUsed=false ✅
```

---

## 8. Cómo probar desde Railway

```bash
# 1. Verificar OLLAMA_BASE_URL en Railway Variables

# 2. Hacer deploy (las variables se aplican en el siguiente deploy)

# 3. Probar endpoint admin desde curl con token JWT de SEMSE:
curl https://api.semseproject.com/v1/ops/ai-mission-control/ollama/health \
  -H "Authorization: Bearer <jwt>" \
  | jq '.data'

# Respuesta esperada:
{
  "registered": true,
  "serverOk": true,
  "modelLoaded": true,
  "configuredModel": "qwen2.5:3b",
  "isRemote": true,
  "hasApiKey": true
}

# 4. Test real de chat desde admin
curl -X POST https://api.semseproject.com/v1/ops/ai-mission-control/ollama/test \
  -H "Authorization: Bearer <jwt>"

# Respuesta esperada:
{
  "success": true,
  "provider": "ollama",
  "model": "qwen2.5:3b",
  "latencyMs": 2000,
  "fallbackUsed": false
}
```

---

## 9. Correr smoke-ollama-remote-level4.mjs

**Desde tu máquina local apuntando al VPS:**

```bash
cd project-manager-app/apps/api

OLLAMA_BASE_URL=https://ollama.tudominio.com \
OLLAMA_API_KEY=<token> \
OLLAMA_MODEL=qwen2.5:3b \
OLLAMA_TIMEOUT_MS=30000 \
node scripts/smoke-ollama-remote-level4.mjs
```

**Output esperado cuando todo está bien:**

```
Modo = REMOTO ☁️

A — Configuración de URL remota
  ✅ URL tiene esquema http/https
  ✅ OLLAMA_MODEL configurado — qwen2.5:3b
  ✅ OLLAMA_TIMEOUT_MS adecuado (≥30s) — 30000ms
  ✅ OLLAMA_API_KEY configurado (VPS protegido)

B — Health check Ollama (conexión real)
  ✅ OllamaProvider registrado en orchestrator
  ✅ isRemote detectado correctamente — isRemote=true
  ✅ Servidor Ollama responde — 180ms
  ✅ Modelo 'qwen2.5:3b' disponible — listo

C,D,E — Policy tests
  ✅ localOnly → sin cloud
  ✅ privacyCritical → sin cloud
  ✅ default → cloud disponible

F — providerHealthSummary
  ✅ ollama.localOnly=true
  ✅ anthropic.localOnly=false

G — Prueba LLM real
  ✅ provider=ollama
  ✅ fallbackUsed=false

Tests: 23/23 (100%)
Modo: REMOTO ☁️
```

---

## 10. Criterios de éxito para declarar REMOTO listo

```
□ OLLAMA_BASE_URL apunta a VPS (no localhost)
□ isRemote=true en el smoke
□ GET /ollama/health → serverOk=true, modelLoaded=true
□ POST /ollama/test → success=true, provider=ollama
□ smoke-ollama-remote-level4.mjs → 23/23
□ Latencia acceptable (GPU: <5s, CPU: <120s para async)
□ localOnly → chain: ollama → template (sin cloud)
□ privacyCritical → chain: ollama → template (sin cloud)
□ Logs Railway muestran: provider=ollama, fallbackUsed=false
□ IA Mission Control summary → nativeProvider=ollama, ollamaAvgLatencyMs<5000
□ Repo limpio, sin .env commiteado
□ .env.example actualizado si hay nuevas variables
```

---

## 11. Plan de rollback si Ollama remoto falla

### Rollback inmediato (sin deploy)

```bash
# En Railway Variables — cambiar:
LLM_DEFAULT_PROVIDER=anthropic
ENABLE_OPEN_SOURCE_MODELS=false
# El circuito cae a anthropic automáticamente en el siguiente request
```

### Rollback con circuit breaker (automático)

El sistema ya tiene circuit breaker:
- 3 fallos consecutivos → circuit abierto
- Próximos requests → fallback a `anthropic` automáticamente
- Después de 30s → half-open (prueba una vez más)

No se necesita intervención manual si el fallo es temporal.

### Rollback completo (deploy)

```bash
# Cambiar las Railway Variables:
LLM_DEFAULT_PROVIDER=anthropic
# O directamente quitar OLLAMA_BASE_URL
# Deploy automático aplica los cambios
```

### Verificación post-rollback

```bash
# Confirmar que el sistema usa Anthropic:
curl https://api.semseproject.com/v1/ops/ai-mission-control/summary \
  -H "Authorization: Bearer <jwt>" \
  | jq '.data.llmDefaultProvider'
# Debe devolver: "anthropic"
```

---

## Checklist completo de Nivel 4B

```
PREPARACIÓN
□ Elegir proveedor VPS/GPU
□ Crear servidor con Ubuntu 22.04

INSTALACIÓN
□ curl -fsSL https://ollama.com/install.sh | sh
□ systemctl enable ollama
□ Configurar OLLAMA_HOST=0.0.0.0:11434 en systemd override
□ ollama pull qwen2.5:3b
□ Verificar: ollama list

SEGURIDAD
□ Elegir método: firewall / nginx / Tailscale
□ Configurar autenticación
□ Probar que el endpoint es inaccesible sin auth

PRUEBA LOCAL
□ curl https://ollama.tudominio.com/api/tags (con auth)
□ OLLAMA_BASE_URL=... OLLAMA_API_KEY=... node smoke-ollama-remote-level4.mjs
□ Verificar: Modo=REMOTO, 23/23 (o al menos 21/23 si modelo frío)

RAILWAY
□ Configurar Service Variables
□ Deploy
□ GET /ollama/health desde Railway
□ POST /ollama/test desde Railway
□ Verificar logs: provider=ollama, isRemote=true

CIERRE
□ IA Mission Control muestra Ollama remote healthy
□ Docs/reportes actualizados
□ Repo limpio
```

---

## Costo estimado

| Opción | Setup | Mensual | Latencia warm |
|--------|-------|---------|---------------|
| VPS CPU 4GB | 1h | $6-12/mes | ~60s |
| VPS CPU 8GB | 1h | $15-30/mes | ~45s |
| RunPod GPU (por hora) | 30min | $0.35-0.75/hora | ~2s |
| Hetzner GPU VPS | 2h | $80-150/mes | ~2s |
| Servidor propio GPU | setup único | $0 mensual | <1s |

**Recomendación para empezar:** VPS CPU de $12-15/mes para validar el pipe Railway→Ollama. Si funciona bien, migrar a GPU para producción interactiva.
