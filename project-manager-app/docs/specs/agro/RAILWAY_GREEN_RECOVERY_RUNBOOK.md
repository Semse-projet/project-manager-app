# SEMSEproject Railway Green Recovery Runbook

Version: 1.0  
Estado: DRAFT  
Objetivo: dejar SEMSEproject verde y desplegable en Railway sin implementar features nuevas.

## 1. Mision

Dejar el proyecto en estado:

```txt
TypeScript limpio
Build API limpio
Build Web limpio
Worker limpio si aplica
Prisma generate correcto
Tests criticos pasando
Railway deploy listo
Health checks funcionando
Sin secretos filtrados
Sin cambios masivos innecesarios
```

Prioridad:

```txt
1. Que compile.
2. Que tests criticos pasen.
3. Que Railway pueda desplegar.
4. Que health checks respondan.
5. Que el repo quede limpio para PR.
```

## 2. Reglas no negociables

No reconstruir la plataforma.

No implementar SEMSE Agro completo durante recovery.

No imprimir secretos:

```txt
DATABASE_URL
REDIS_URL
OPENAI_API_KEY
ANTHROPIC_API_KEY
WHATSAPP_CLOUD_ACCESS_TOKEN
WHATSAPP_APP_SECRET
RAILWAY_TOKEN
JWT_SECRET
STRIPE_SECRET_KEY
*_SECRET
*_TOKEN
*_KEY
```

No cambiar nombres de env vars sin razon.

## 3. Auditoria inicial obligatoria

Ejecutar:

```bash
git status
git branch --show-current
git log --oneline -10
git diff --stat
git diff
find . -maxdepth 3 -name "railway.json" -o -name "Dockerfile" -o -name "package.json"
```

Revisar:

```txt
package.json raiz
pnpm-workspace.yaml
apps/api/package.json
apps/web/package.json
apps/worker/package.json si existe
packages/*/package.json
railway.json
Dockerfiles
Prisma schema/migrations
Next config
NestJS bootstrap
health endpoints
CI workflows
```

Reporte inicial:

```txt
1. Rama actual.
2. Estado git.
3. Servicios detectados.
4. Comandos reales disponibles.
5. Config Railway detectada.
6. Riesgos principales.
7. Plan de reparacion.
```

## 4. Reproducir fallos

Usar comandos reales del repo.

Comandos esperados:

```bash
pnpm install --frozen-lockfile
pnpm exec prisma generate
pnpm --filter @semse/api type-check
pnpm --filter @semse/api build
pnpm --filter @semse/api test
pnpm --filter @semse/web type-check
pnpm --filter @semse/web build
pnpm --filter @semse/worker type-check
pnpm --filter @semse/worker build
pnpm type-check
pnpm build
pnpm test
pnpm lint
```

Si los filtros son distintos, detectarlos desde `package.json`.

## 5. Prioridad de fixes

```txt
P0 — Build roto.
P0 — TypeScript roto.
P0 — Prisma generate/migrate roto.
P0 — Railway config rota.
P0 — Health check roto.
P0 — App no escucha PORT correcto.
P1 — Tests criticos fallando.
P1 — Dependencias internas no resueltas.
P1 — Next.js build roto.
P1 — Worker no arranca.
P2 — Lint/config si bloquea CI.
P2 — Warnings no bloqueantes.
```

## 6. API checklist

Verificar:

```txt
NestJS compila
PrismaService funciona
Prisma Client se genera antes del build
/v1/health existe y responde
API escucha process.env.PORT
imports internos resuelven
Redis/queues no bloquean build
```

Archivos clave:

```txt
apps/api/src/main.ts
apps/api/src/app.module.ts
health controller
prisma service
config module
apps/api/package.json
Dockerfile.api
railway config
```

## 7. Web checklist

Verificar:

```txt
Next.js build pasa
TypeScript pasa
No hay rutas duplicadas
No hay route handlers invalidos
No hay server-only import en client components
/api/sense/health responde
BFF routes apuntan a API correcta
```

## 8. Worker checklist

Verificar:

```txt
compila
Prisma Client disponible
Redis/BullMQ compatible
no conecta en import-time durante build
env vars runtime no rompen build
```

## 9. Paquetes internos

Si aparece:

```txt
Cannot find module @semse/schemas
```

Revisar:

```txt
package name
exports
tsconfig paths
build order
pnpm workspace
project references
```

No duplicar codigo para evitar arreglar el paquete.

## 10. Railway checklist

Debe quedar claro:

```txt
API build/start/health/PORT
Web build/start/health/PORT
Worker build/start
```

Health esperado:

```txt
API  GET /v1/health       → 200
Web  GET /api/sense/health → 200
```

Health debe ser liviano. No debe depender de IA, WhatsApp, Stripe u otros
servicios externos.

## 11. Env vars

Entregar tabla sin valores:

```txt
Variable | Servicio | Build | Runtime | Estado
```

No imprimir secretos.

## 12. Prisma

Permitido:

```bash
pnpm exec prisma generate
```

Prohibido sin aprobacion explicita:

```bash
prisma migrate reset
```

No borrar migraciones.

## 13. SEMSE Agro durante recovery

Permitido:

```txt
arreglar imports rotos
arreglar modelos incompletos que rompen Prisma
arreglar controllers/services que rompen build
cerrar foundation si ya estaba empezado
```

No permitido:

```txt
implementar F1 completo
implementar F2-F5
meter marketplace agro
meter IA agro
meter sensores/satelite
meter pagos agro
```

Si Agro incompleto no bloquea deploy, documentarlo como backlog.

## 14. Verificacion final

Ejecutar lo maximo posible:

```bash
git status
pnpm exec prisma generate
pnpm --filter @semse/api type-check
pnpm --filter @semse/api build
pnpm --filter @semse/web type-check
pnpm --filter @semse/web build
pnpm --filter @semse/worker build
pnpm test
```

No decir "todo verde" si algo fallo.

## 15. Reporte final requerido

```txt
# SEMSEproject Railway Green Recovery — Resultado

## Veredicto
Verde / Casi verde / Bloqueado

## Resumen ejecutivo
Que estaba roto y que se arreglo.

## Cambios realizados
- API
- Web
- Worker
- Packages
- Prisma
- Railway
- Tests
- Docs

## Archivos modificados

## Comandos ejecutados
Comando | Resultado | Nota

## Railway readiness
- API build:
- API start:
- API health:
- Web build:
- Web start:
- Web health:
- Worker build/start:

## Variables de entorno revisadas
Tabla sin valores.

## Riesgos pendientes

## Backlog recomendado
P0 deploy / P1 stability / P2 cleanup / SEMSE Agro futuro

## Siguiente paso
```

## 16. Frase guia

```txt
Primero verde. Despues features.
```

