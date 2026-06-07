# SEMSE Authentication Architecture

## Decisión técnica

**Opción A — Mantener el formato custom SEMSE Signed Token.**

El sistema es internamente consistente. No se usa ninguna librería JWT estándar en ningún punto del stack.
No hay integraciones externas que requieran JWT estándar. Las propiedades de seguridad son correctas.

---

## Tokens y formatos

### 1. API Bearer Token (`apps/api/src/common/auth-token.ts`)

**Formato**: `<encodedPayload>.<sig>` (2 partes — SEMSE Signed Token, no JWT estándar)

```
encodedPayload = base64url(JSON.stringify(claims))
sig            = HMAC-SHA256(encodedPayload, AUTH_SECRET) → base64url
```

**Claims**:
| Campo    | Tipo     | Descripción                              |
|----------|----------|------------------------------------------|
| userId   | string   | ID del usuario                           |
| tenantId | string   | ID del tenant                            |
| orgId    | string   | ID de la organización                    |
| roles    | string[] | Roles del usuario: CLIENT, PRO, OPS_ADMIN, WORKER |
| sid      | string   | Session ID (mapea a `jti` en JWT)        |
| typ      | "access" | Tipo de token                            |
| jti      | string   | UUID único por token (replay protection) |
| iat      | number   | Unix timestamp — issued at               |
| exp      | number   | Unix timestamp — expires at              |

**TTL**: 1 hora (access), 30 días (refresh)

**Secret**: `AUTH_SECRET` (mínimo 32 caracteres, requerido en producción)

**Comparación**: `crypto.timingSafeEqual` — constant-time ✓

### 2. Web Session Cookie (`apps/web/lib/auth.ts`)

**Nombre de cookie**: `semse_session`

**Formato**: `<encodedPayload>.<sig>` (igual que el API Bearer Token, separado)

```
encodedPayload = base64url(JSON.stringify(sessionPayload))
sig            = HMAC-SHA256(encodedPayload, secret) → base64url  (Web Crypto API)
```

**Payload**:
| Campo    | Tipo     | Descripción                    |
|----------|----------|--------------------------------|
| userId   | string   | ID del usuario                 |
| tenantId | string   | ID del tenant                  |
| orgId    | string   | ID de la organización          |
| roles    | string[] | Roles del usuario              |
| exp      | number   | Unix timestamp — expires at    |

**TTL**: 8 horas (configurable en `apps/web/app/api/semse/auth/token/route.ts`)

**Secret**: `SEMSE_WEB_SESSION_SECRET` → fallback `AUTH_SECRET` → fallback `semse-dev-session-secret` (dev only)

**Comparación**: `crypto.subtle.verify` — constant-time ✓

**Atributos de cookie**:
- `HttpOnly` — no accesible desde JS del browser ✓
- `SameSite=Lax` — protección CSRF ✓
- `Secure` — solo en HTTPS (detectado por `req.nextUrl.protocol`) ✓
- `Path=/` ✓
- `Max-Age` alineado con `exp` ✓

### 3. Bootstrap Token (`SEMSE_BOOTSTRAP_TOKEN`)

Usado por el Worker para obtener su primer access token desde la API.

**Endpoint**: `POST /v1/auth/token` — requiere header `x-semse-bootstrap`

**Comparación**: `crypto.timingSafeEqual` sobre SHA-256 de ambos lados ✓

**No es un token de sesión** — es un secreto compartido entre servicios internos.

---

## Flujo de autenticación

### Usuario humano (Web → API)

```
1. Browser POST /api/semse/auth/token (BFF)
   → BFF llama a API POST /v1/auth/login con email+password
   → API devuelve { accessToken, refreshToken }
   → BFF guarda accessToken en cookie semse_session (HMAC-firmada)
   → BFF devuelve { ok: true, redirectTo }

2. Browser navega a ruta protegida
   → Next.js middleware verifica cookie semse_session
   → Si válida: inyecta x-semse-* headers al request downstream
   → Si inválida/expirada: redirect a /login

3. BFF API routes (/api/semse/*) llaman a API con Bearer token
   → API verifica Bearer token con AUTH_SECRET
   → API extrae claims y popula authContext
   → AuthGuard + RbacGuard ejecutan
```

### Worker (sistema)

```
1. Worker inicia → llama a API POST /v1/auth/token con SEMSE_BOOTSTRAP_TOKEN
   → API verifica bootstrap token con timingSafeEqual
   → API genera access + refresh token con roles OPS_ADMIN,WORKER
   → Worker almacena tokens en memoria

2. Worker llama a API → usa Authorization: Bearer <accessToken>
   → En 401: llama a POST /v1/auth/refresh con refreshToken
   → Renueva token automáticamente

3. Si AUTH_SECRET no está configurado (dev): Worker usa identity headers directamente
   → API acepta x-semse-user-id, x-semse-tenant-id, etc. en modo dev
```

---

## Variables de entorno por servicio

### API (`apps/api`)
| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `AUTH_SECRET` | Sí (prod) | Secret para firmar/verificar API Bearer tokens. Mínimo 32 chars. |
| `SEMSE_BOOTSTRAP_TOKEN` | Recomendado | Token que permite al Worker obtener un session token. |

### Web (`apps/web`)
| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `AUTH_SECRET` | Sí (prod) | Fallback para firmar cookies web si `SEMSE_WEB_SESSION_SECRET` no está definido. |
| `SEMSE_WEB_SESSION_SECRET` | Recomendado | Secret dedicado para firmar la cookie `semse_session`. Si se omite, usa `AUTH_SECRET`. |
| `SEMSE_API_BASE_URL` | Sí | URL interna de la API (Railway: `http://semse-api.railway.internal:4000`). |

### Worker (`apps/worker`)
| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `SEMSE_BOOTSTRAP_TOKEN` | Sí (prod) | Token para obtener el session token al arrancar. |
| `AUTH_SECRET` | No (usa bootstrap) | Si está presente, el worker también puede verificar tokens localmente. |

---

## Recomendaciones de Railway

1. **Compartir `AUTH_SECRET`** entre API y Web con el mismo valor.
2. **Agregar `SEMSE_WEB_SESSION_SECRET`** como variable separada en el servicio Web. Esto aisla las firmas de cookies web de los tokens API.
3. **Agregar `SEMSE_BOOTSTRAP_TOKEN`** en API y Worker con el mismo valor.
4. **`SEMSE_WEB_SESSION_SECRET` debe tener mínimo 32 caracteres**.

Ejemplo (Railway Service Variables):

```
# API y Web comparten:
AUTH_SECRET=<64-char-random-hex>

# Solo Web:
SEMSE_WEB_SESSION_SECRET=<diferente-64-char-random-hex>

# API y Worker comparten:
SEMSE_BOOTSTRAP_TOKEN=<64-char-random-hex>
```

Para generar secretos seguros:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## RBAC

Los roles y permisos están definidos en `packages/auth/src/rbac.ts`.

| Rol | Acceso |
|-----|--------|
| `CLIENT` | Gestión de jobs, bids, contratos, milestones propios |
| `PRO` | Bids, proyectos, contratos como contratista |
| `OPS_ADMIN` | Control total: auditoría, disputes, finance, runbooks |
| `WORKER` | Agentes de sistema: `agents:run:worker`, `field-ops:*` |

Los aliases disponibles:
- `ADMIN` → `OPS_ADMIN`
- `FIELD_WORKER` → `WORKER`
- `PROFESSIONAL` → `PRO`

---

## Cómo verificar manualmente

### Login y sesión

```bash
# 1. Login via BFF
curl -X POST https://app.semseproject.com/api/semse/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"client@demo.semse","password":"demo1234"}' \
  -c /tmp/semse-cookies.txt

# 2. Acceder a un endpoint protegido
curl https://app.semseproject.com/api/semse/jobs \
  -b /tmp/semse-cookies.txt

# 3. Verificar identidad directamente en la API
curl https://api.semseproject.com/v1/auth/me \
  -H "Authorization: Bearer <token>"
```

### Inspeccionar token (no firmar — solo inspeccionar payload)

```bash
TOKEN="..."
PAYLOAD=$(echo $TOKEN | cut -d'.' -f1)
echo $PAYLOAD | base64 -d 2>/dev/null || echo $PAYLOAD | python3 -c "
import sys, base64, json
s = sys.stdin.read().strip()
s += '=' * (4 - len(s) % 4)
print(json.dumps(json.loads(base64.urlsafe_b64decode(s)), indent=2))
"
```

---

## Riesgos pendientes y mitigaciones

| Riesgo | Estado | Mitigación |
|--------|--------|------------|
| Token no es JWT estándar | Cerrado (decisión Opción A) | Documentado como SEMSE Signed Token |
| Bootstrap token con comparación simple | **Cerrado** | `crypto.timingSafeEqual` sobre SHA-256 |
| Sesiones eternas | Cerrado | Access TTL 1h, cookie TTL 8h, refresh TTL 30d |
| `alg=none` exploit | N/A | No hay alg dinámico — HMAC custom siempre |
| Cookie sin `Secure` en HTTP | Bajo riesgo (dev only) | `Secure` habilitado automáticamente en HTTPS |
| `AUTH_SECRET` y `SEMSE_WEB_SESSION_SECRET` iguales | Bajo riesgo | Separar con variable dedicada en Railway |
| Worker sin `SEMSE_BOOTSTRAP_TOKEN` en producción | Falta configurar | Agregar en Railway Worker Service Variables |
