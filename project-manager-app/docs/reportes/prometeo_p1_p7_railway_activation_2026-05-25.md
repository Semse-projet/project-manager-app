# Prometeo P1–P7 Railway Activation Report
**Fecha:** 2026-05-25  
**PR:** #32 — commit `65342b1e` mergeado a `main`  
**Estado de partida:** merge limpio, typecheck 0 errores, 240/240 tests, web build OK

---

## 1. Worktree local — verificado

| Check | Resultado |
|-------|-----------|
| `origin/main` actualizado | `65342b1` (PR #32) |
| Typecheck | ✅ 0 errores |
| Unit tests | ✅ 240/240 |
| Web build | ✅ exit 0 |
| Spec validate | ✅ exit 0 |
| Conflict markers | ✅ ninguno |
| Prisma client regenerado | ✅ v6.19.3 |

Hay cambios sin commitear en el worktree (`.env.example`, Angular, tools) — son deuda técnica preexistente, no relacionados con P1-P7. No bloquean el deploy.

---

## 2. Migraciones pendientes en Railway

Hay **dos** migraciones que Railway aún no tiene aplicadas (no estaban en main antes del PR #32):

### Migración A — `20260524180000_payment_escrow_status_enum`
Convierte `PaymentEscrow.status` de texto libre a enum PostgreSQL `EscrowStatus`.  
**Incluye validación**: falla antes de alterar si hay valores inesperados en prod.

### Migración B — `20260525000000_governance_sandbox`
Crea las 3 tablas del sandbox DAO:
- `GovernanceProposal`
- `GovernanceVote`
- `GovernanceCreditEvent`

---

## 3. Comandos exactos para aplicar en Railway

### Opción A — Railway CLI (recomendada si tienes sesión activa)

```bash
# Autenticarse primero (login interactivo en browser)
railway login

# Seleccionar proyecto y entorno correcto
railway environment production   # o el nombre de tu entorno

# Correr la migración desde el servicio de DB
railway run --service semse-api \
  "cd /app && npx prisma migrate deploy"
```

### Opción B — Railway Shell desde la UI (sin CLI local)

1. Ir a Railway Dashboard → tu proyecto → servicio **semse-api**
2. Click en el deployment activo → **Shell** (ícono de terminal)
3. Ejecutar:
```bash
npx prisma migrate deploy
```

### Opción C — DATABASE_URL directa (desde local con acceso a red)

```bash
# Obtener DATABASE_URL desde Railway Dashboard → PostgreSQL → Variables
export DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"

# Desde el directorio del proyecto
cd /home/yoni/labsemse/project-manager-app
pnpm --filter @semse/db prisma:deploy
```

### Verificación post-migración (ejecutar en la shell de Railway)

```sql
-- Verificar que las 3 tablas existen
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'GovernanceProposal',
    'GovernanceVote',
    'GovernanceCreditEvent'
  )
ORDER BY table_name;
-- Esperado: 3 filas

-- Verificar enum EscrowStatus
SELECT enumlabel
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'EscrowStatus'
ORDER BY enumlabel;
-- Esperado: active, cancelled, closed, pending_settlement, released
```

---

## 4. Variable de entorno Railway Web

Añadir/verificar en Railway Dashboard → servicio **semse-web** → Variables:

```
NEXT_PUBLIC_SEMSE_TENANT_ID=<tu_valor>
```

**Propósito:** La governance page y la citizen profile page usan esta variable para filtrar propuestas y créditos por tenant. Si no está definida, caen al default `"default"` — funcionará pero sin filtrado correcto por tenant.

**Impacto de ausencia:** No bloquea el deploy, pero governance/credits queries devuelven datos de todos los tenants mezclados.

---

## 5. Smoke tests post-deploy

### HTTP / cURL (correr desde cualquier shell con acceso a la URL de Railway)

```bash
BASE="https://semse-web.up.railway.app"   # ajustar a tu URL real
TOKEN="Bearer <tu_token_de_sesión>"

# Rutas BFF governance
curl -sf -H "Authorization: $TOKEN" "$BASE/api/semse/governance/proposals?tenantId=default" | jq '.data | length'

# Ruta BFF behavioral
curl -sf -H "Authorization: $TOKEN" "$BASE/api/semse/ops/behavioral" | jq '.data.behavioralScore'

# Ruta DID (requiere userId real)
curl -sf -H "Authorization: $TOKEN" "$BASE/api/semse/did/<userId>" | jq '.data.id'

# Ruta Trust Passport
curl -sf -H "Authorization: $TOKEN" "$BASE/api/semse/trust/<userId>/passport" | jq '.data.did'

# Ruta credits
curl -sf -H "Authorization: $TOKEN" "$BASE/api/semse/governance/credits/<userId>?tenantId=default" | jq '.data.tier'
```

### Navegador — páginas a verificar

| URL | Verificar |
|-----|-----------|
| `/admin/governance` | Se carga sin error; estado vacío o con propuestas |
| `/admin/trust` | Tabla de usuarios; cada fila tiene botón "Pasaporte" |
| `/admin/trust` → click "Pasaporte" | Se expande TrustPassportCard con DID y tier badge |
| `/admin/users/<id>` | Citizen Profile carga: DID card + Passport card + Credits |
| `/admin/consciousness` | Observer Panel muestra sección "Salud Social" si hay behavioralHealth |
| Nav admin | "Gobernanza DAO" aparece en el sidebar |

---

## 6. Errores conocidos / mitigaciones

| Error posible | Causa | Mitigación |
|---------------|-------|------------|
| `relation "GovernanceProposal" does not exist` | Migración no aplicada | Correr `npx prisma migrate deploy` |
| `Cannot find module '../../_server'` | Solo en versiones pre-fix | Ya corregido en commit `b7aab12` |
| Governance page vacía | No hay propuestas en prod aún | Normal — empty state muestra Vote icon + texto |
| TrustPassportCard `HTTP 404` | Endpoint `/v1/users/:id/trust-passport` no existe aún | Ver P1 trust module — endpoint debe estar en API |
| `NEXT_PUBLIC_SEMSE_TENANT_ID` no seteado | Usa `"default"` como fallback | Setear en Railway Web env |
| `EscrowStatus` migration falla | Hay valores no reconocidos en prod | El SQL tiene guard — leerá cuáles son los valores inválidos |

---

## 7. Estado de la API — endpoints requeridos

Los BFF routes del frontend llaman a estos endpoints en el API (deben estar deployados en semse-api):

| BFF Route | API endpoint |
|-----------|-------------|
| `/api/semse/governance/proposals` | `GET/POST /v1/governance/proposals` |
| `/api/semse/governance/proposals/[id]/vote` | `POST /v1/governance/proposals/:id/vote` |
| `/api/semse/governance/proposals/[id]/results` | `GET /v1/governance/proposals/:id/results` |
| `/api/semse/governance/proposals/[id]/close` | `POST /v1/governance/proposals/:id/close` |
| `/api/semse/governance/credits/[userId]` | `GET /v1/governance/credits/:userId` |
| `/api/semse/ops/behavioral` | `GET /v1/ops/behavioral` |
| `/api/semse/trust/[userId]/passport` | `GET /v1/users/:userId/trust-passport` |
| `/api/semse/did/[userId]` | `GET /v1/did/:userId` |

Todos estos endpoints fueron implementados en P1-P4 y están en el código mergeado. La API en Railway debe redeployarse automáticamente tras el merge a main (si Railway está configurado con auto-deploy desde GitHub).

---

## 8. Conclusión

| Condición | Estado |
|-----------|--------|
| Código P1-P7 en main | ✅ mergeado `65342b1e` |
| Typecheck / tests / build | ✅ todos limpios |
| Migración `EscrowStatus` aplicada | ⏳ pendiente (Railway shell) |
| Migración `GovernanceSandbox` aplicada | ⏳ pendiente (Railway shell) |
| `NEXT_PUBLIC_SEMSE_TENANT_ID` seteado | ⏳ pendiente (Railway Web env) |
| API re-deployed tras merge | ⏳ depende de auto-deploy Railway |
| Smoke tests | ⏳ pendiente post-deploy |

**Veredicto: Producción bloqueada únicamente por las 2 migraciones y el env var.**  
Una vez aplicadas las migraciones y seteada la variable, el sistema está listo para smoke test.

El Railway CLI local requiere `railway login` interactivo (browser OAuth).  
**Acción requerida por el operador:** ejecutar los comandos de la Sección 3 desde Railway Shell o con DATABASE_URL directa.
