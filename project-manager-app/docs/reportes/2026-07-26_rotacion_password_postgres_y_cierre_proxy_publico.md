# Reporte — Rotación de la contraseña de Postgres (prod) y cierre del proxy TCP público

**Fecha:** 2026-07-26
**Repositorio:** Semse-projet/project-manager-app
**Ítem:** P0-1 del informe de auditoría de arquitectura (2026-07-25) — credenciales expuestas
**Autor:** Claude Code (sesión de continuación tras corte por límite de sesión)
**Alcance:** infraestructura Railway (proyecto `SEMSEproject`, entorno `production`). **Cero cambios de código.**

## Problema

La contraseña del usuario `postgres` de la base de datos de producción estuvo en **texto plano** en dos scripts temporales dentro del repo (sin trackear, nunca commiteados — se borraron el 2026-07-25) y en el historial de shell. Borrar los scripts no des-expone la credencial.

El riesgo real no era la contraseña por sí sola, sino su combinación con el **proxy TCP público** del servicio Postgres (`turntable.proxy.rlwy.net:18164`), que exponía el puerto 5432 a internet. Se verificó en la sesión previa que **ningún** servicio de la app usa ese proxy: `semse-API`, `semse-worker` y `semse-vision` se conectan por la red interna (`postgres.railway.internal`). El proxy solo se había usado para un reset de emergencia manual.

La sesión del 2026-07-25 se cortó por límite de sesión justo después de planificar la remediación, sin ejecutar nada. Se confirmó al retomar: el proxy seguía abierto y la contraseña vieja seguía activa.

## Solución aplicada

Orden deliberado: rotar primero, cerrar el proxy **al final**, para conservar la vía de rollback (`ALTER USER` de vuelta a la contraseña vieja) hasta tener la verificación completa en verde.

1. **Inventario.** La contraseña vivía en **7 variables** de 3 servicios:
   - `Postgres`: `DATABASE_URL`, `DATABASE_PUBLIC_URL`, `PGPASSWORD`, `POSTGRES_PASSWORD`
   - `semse-API`: `DATABASE_URL`
   - `semse-worker`: `DATABASE_URL`
   - `semse-vision` y `semse-web`: ninguna (no tocan Postgres directo) ✅
2. **Contraseña nueva:** 48 caracteres hex (`crypto.randomBytes(24)`), sin símbolos para evitar problemas de URL-encoding. Se generó a un archivo temporal y se manipuló siempre por `$(cat …)`, sin imprimirla nunca a stdout; los archivos temporales se borraron al terminar. La única copia persistente es el almacén de variables de Railway.
3. **`ALTER USER postgres WITH PASSWORD`** ejecutado con `prisma db execute` a través del proxy público (todavía abierto para esto). Se validó antes la herramienta con un `SELECT 1;`.
4. **Propagación de las 7 variables.** `semse-API` y `semse-worker` con redeploy; el servicio `Postgres` con `--skip-deploys` para **no reiniciar la base de datos** (`POSTGRES_PASSWORD` solo se usa en `initdb`, así que en un volumen existente es puro bookkeeping).
5. **Cierre del proxy TCP público** (`railway tcp-proxy delete`), ya con todo verificado.

## Validación

| Verificación | Resultado |
|---|---|
| Conexión con la contraseña **nueva** | ✅ `Script executed successfully` |
| Conexión con la contraseña **vieja** | ✅ Rechazada |
| Las 7 variables coinciden con la nueva | ✅ 7/7 |
| `GET /v1/health` | ✅ `status: ok` |
| `GET /v1/ready` | ✅ `database: ok (Prisma query succeeded)`, `migrations: ok`, `redis: ok`, `worker: heartbeat ok` |
| `POST /v1/auth/login` con credencial inválida | ✅ 401 real (`Credenciales incorrectas`) — la BD responde |
| Logs de `semse-worker` | ✅ `product intelligence engines/retention complete` (antes del redeploy decían `failed`) |
| `POST /v1/agents/runs/reclaim-stale` en logs de la API | ✅ 201 cada 10s, 4-6 ms, sin errores |
| BD por el proxy público, después del cierre | ✅ Inalcanzable |
| App tras el cierre del proxy | ✅ `/v1/ready` sigue en `ready` |

**Ventana de degradación observada:** un único `stale reclaim call failed` a las 14:23:26 UTC, nunca repetido. Coincide con el solapamiento de dos contenedores del worker durante el redeploy (`another worker with same workerId is running — waiting for lock`), no con la rotación. La API respondió ese mismo endpoint con 201 de forma continua.

## Notas y riesgos

- **Rollback ya no disponible por la vía original.** Cerrado el proxy, un acceso externo de emergencia a la BD requiere recrear el proxy (`railway tcp-proxy create`, un comando; Railway asignará un puerto nuevo). La contraseña no cambia al hacerlo.
- **`DATABASE_PUBLIC_URL` quedó obsoleta a propósito** en el servicio `Postgres`: apunta al proxy ya eliminado. No se borró porque `railway variables delete` no acepta `--skip-deploys` y habría **reiniciado la base de datos** por una variable inerte. Conviene borrarla en la próxima ventana de mantenimiento (o dejarla: Railway la regenera si alguna vez se recrea el proxy).
- **`db-dedup-script` tiene una contraseña de BD ya obsoleta** (de una rotación anterior, distinta de la que acaba de reemplazarse). Ese servicio lleva tiempo sin poder conectar. Es un one-off de mantenimiento — candidato a borrarse.
- La contraseña nueva **no está en el repo ni en ningún archivo local**. Para leerla: variables del servicio en Railway.

## Pendiente del mismo bloque P0 (no cubierto por este reporte)

- **Rotar la API key de Resend** (`RESEND_API_KEY`) — quedó expuesta en historial de shell. Requiere acción manual en https://resend.com/api-keys (crear una nueva con permiso *Sending access* únicamente).
- **`EMAIL_FROM` sigue en el remitente sandbox** `onboarding@resend.dev`, que solo entrega al correo de la propia cuenta. Depende de verificar el dominio `semseproject.com` en Resend (faltan los registros **MX** y **TXT** en `send.semseproject.com`; el DKIM ya está).
