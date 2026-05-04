# Tema, idioma y cierre parcial del tracker web — 2026-04-09

## Alcance

Se completó la mejora de experiencia del shell web y se endureció el runtime del tracker persistente en el frontend de `project-manager-app`.

## Cambios implementados

### 1. Preferencias globales de idioma y tema

Se añadieron controles persistentes de:

- idioma: `es | en`
- tema: `dark | light`

Archivos tocados:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/layout.tsx`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/globals.css`

Comportamiento:

- guarda preferencias en `localStorage`
- actualiza `document.documentElement.lang`
- actualiza `document.documentElement.dataset.theme`
- traduce etiquetas base del shell
- cambia variables CSS del sistema para modo claro/oscuro

### 2. Tracker: consistencia visual del trabajo activo

Se corrigió la resolución del trabajo actual para que el panel priorice el `job` embebido en `activeSession`, en vez de depender solo de la lista filtrada de jobs.

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/worker/tracker/page.tsx`

### 3. Runtime web: propagación de identidad

Se reforzó la capa web para intentar resolver identidad por dos caminos:

- headers `x-semse-*` inyectados por middleware
- cookie `semse_session` leída directamente por el proxy server-side

Archivos:

- `/home/yoni/labsemse/project-manager-app/apps/web/middleware.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/_server.ts`

Esto reduce dependencia frágil entre middleware y subrequests del navegador.

### 4. E2E del tracker

Se endureció el spec del tracker para volverlo más idempotente y menos dependiente de sesiones previas:

- limpia sesión activa previa del usuario local antes del flujo
- deja el setup más estable para reload/pause/resume/stop
- migra el escenario hacia login real + bootstrap browser-side del tracker
- prueba una ruta de bootstrap autenticada en `/api/semse/tracker/bootstrap`

Archivo:

- `/home/yoni/labsemse/project-manager-app/tests/e2e-semse/worker-tracker.spec.js`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/tracker/bootstrap/route.ts`

### 5. Endurecimiento de login web

Se reforzó la emisión de sesión en el login demo para evitar que en entorno local HTTP la cookie quede marcada como `Secure` por error.

Archivo:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/auth/token/route.ts`

Cambio:

- la cookie ahora solo se marca `secure` si la request real entra por `https`

## Verificaciones ejecutadas

- `npm run build --workspace @semse/web -- --debug-prerender` → OK
- limpieza de `.next` corrupto → aplicada
- arranque web validado en puertos auxiliares (`3004`, `3005`, `3006`, `3007`, `3008`) → OK
- arranque web validado también en `3009` → OK

## Estado real al cerrar

### Cerrado

- idioma configurable
- tema oscuro/claro configurable
- shell persistente por preferencia local
- tracker con mejor resolución del trabajo activo
- build del web corregido tras limpiar drift en `.next`
- login web endurecido para escribir cookie vía `response.cookies.set(...)`
- login web ajustado para no emitir cookie `Secure` en HTTP local
- login web ajustado para usar `credentials: "include"` y navegación completa con `window.location.assign(...)`
- bootstrap autenticado del tracker desde la propia web

### Residuo real

La prueba e2e browser del tracker avanzó, pero sigue sin cerrar completamente el reload. El síntoma final ya no es el seed del tracker, sino la persistencia de sesión del web durante `page.reload()` dentro del escenario Playwright.

Se probó y quedó integrado:

- lectura de identidad por headers y por cookie
- bootstrap autenticado del tracker por el proxy web
- login real del producto en el spec
- escritura de cookie de sesión con `response.cookies.set(...)`

El síntoma remanente en local es este:

- tras login + bootstrap + reload, el navegador vuelve a `/login`
- el endurecimiento de cookie mejoró el tiempo de supervivencia del flujo, pero no cerró aún el `reload` del escenario Playwright

Esto no bloquea las mejoras de idioma/tema ni invalida el tracker persistente ya validado por API/smoke. El remanente queda acotado al circuito:

- login demo del web
- persistencia de `semse_session`
- middleware protegido en reload
- Playwright sobre `next start`

## Conclusión

La mejora pedida por el usuario quedó implementada. El shell web ya permite configurar idioma y tema, y el tracker quedó más sólido en UI y en su capa de identidad web. El único remanente es la persistencia de sesión web bajo reload en el escenario Playwright, ya acotada a la capa de login/middleware y no al tracker ni al theme/language.
