# Reporte — `apps/web` instalable como PWA

**Fecha:** 2026-07-27
**Repositorio:** Semse-projet/project-manager-app
**Alcance:** `apps/web` (superficie movil sin binarios ni tiendas). **Sin cambios de API, worker ni base de datos.**

## Problema

Tras retirar el spike de `apps/mobile` (#439), SEMSE no tenia ninguna superficie
movil. La pregunta de partida fue si hacia falta montar un pipeline de binarios
nativos, y la respuesta corta es que no para este paso:

- **SAT-003, la spec vigente y `APPROVED`, no describe una app nativa.** Dice
  textualmente *"Existe una app movil (Vite + shadcn...)"*, es decir una app web,
  y deja **fuera de alcance** la publicacion en tiendas y las push nativas.
- `apps/web` ya tenia lo caro: service worker (`public/sw.js`) con Web Push,
  iconos 1024 y el registro en `hooks/usePushNotifications.ts`.
- Lo unico que faltaba para que el navegador ofreciera "Añadir a pantalla de
  inicio" era un **manifest**.

## Solucion aplicada

### 1. Manifest (`app/manifest.ts`)

Ruta de metadatos de Next 15, servida como `/manifest.webmanifest` con
`content-type: application/manifest+json`. Declara `display: standalone`,
`start_url: /`, `scope: /`, `lang: es`, `background_color: #050810` (la
superficie base del tema oscuro, `--color-base`) y `theme_color: #3b82f6`
(coincide con el `viewport.themeColor` ya existente).

Lleva `dynamic = "force-static"` porque el layout raiz declara `force-dynamic` y
el manifest no debe heredarlo.

### 2. Iconos

Derivados de `public/icon-1024.png` con `sharp`:

| Archivo | Tamaño | Uso |
|---|---|---|
| `icon-192.png` · `icon-512.png` | 192², 512² | `purpose: any` — conservan las esquinas redondeadas y el alfa del arte original |
| `icon-maskable-512.png` | 512² | `purpose: maskable` — a sangre completa sobre el degradado de marca (`#7c63f6` → `#447df6`, muestreado del propio icono), arte al 80% para respetar la zona segura del recorte del SO |
| `apple-touch-icon.png` | 180² | iOS ignora el manifest para el icono de inicio y no respeta el alfa (lo pinta negro): va aplanado |

`sharp` solo esta en el repo como *override* de pnpm, no como dependencia
directa, asi que **no se dejo un script generador** que dependiera de algo no
declarado. Los PNG se comitean como assets estaticos.

### 3. Registro global del service worker

`components/pwa/ServiceWorkerRegistrar.tsx`, montado en el layout raiz. Antes el
SW solo se registraba desde `usePushNotifications`, o sea **unicamente si el
usuario activaba las notificaciones**; sin SW registrado el navegador no ofrece
instalar. Registrar el mismo script en el mismo scope es idempotente, asi que no
duplica el registro del hook de push.

### 4. Fallback offline (`public/sw.js` + `public/offline.html`)

La cabecera de `sw.js` decia *"Offline cache"* y declaraba `const CACHE`, pero
**no habia ningun listener `fetch`**: no cacheaba nada. Se añadio uno
deliberadamente conservador:

- Solo intercepta **navegaciones GET del propio origen**. API, POST, assets y
  terceros pasan directos sin que el SW los toque.
- Es **network-first sin cache de respuestas**: mientras hay red siempre sirve la
  red, asi que no puede mostrar contenido obsoleto.
- Lo unico en cache es `/offline.html`, una pagina estatica precargada en el
  `install`. **Ninguna respuesta autenticada se almacena**, asi que no hay riesgo
  de filtrar datos de una sesion a otra en un dispositivo compartido.
- El `activate` ahora ademas purga caches de versiones anteriores del SW.

### 5. Metadatos iOS (`app/layout.tsx`)

`appleWebApp.capable`, titulo `SEMSE`, `apple-touch-icon` y `applicationName`.

El `statusBarStyle` se dejo en **`default`, no en `black-translucent`**:
translucent mete el contenido debajo de la barra de estado, y la app solo
compensa `safe-area-inset-bottom` (nav inferior en `app/(app)/layout.tsx`), no el
inset superior — habria tapado la cabecera en iOS.

## Validacion

Verificado contra un servidor real (`next start`), no solo contra la salida del build.

| Verificacion | Resultado |
|---|---|
| `tsc --noEmit` en `@semse/web` | ✅ exit 0 |
| `next build` | ✅ exit 0 — `/manifest.webmanifest` como `○ (Static)` |
| `GET /manifest.webmanifest` | ✅ 200, `application/manifest+json`, JSON correcto |
| `<link rel="manifest">` en el HTML | ✅ presente |
| `mobile-web-app-capable: yes` | ✅ presente |
| `apple-mobile-web-app-status-bar-style` | ✅ `default` |
| `<link rel="apple-touch-icon" sizes="180x180">` | ✅ presente |
| `/offline.html`, 4 iconos, `/sw.js` | ✅ 200 con su content-type |
| Esquinas de `maskable` y `apple-touch-icon` | ✅ opacas (`a=255`); las de `purpose: any` transparentes |

## Lo que esto **no** hace

- **No es offline-first.** Sin red se muestra una pagina de reintento, no la app.
  El offline real en campo (capturar evidencia sin cobertura y sincronizar
  despues) sigue sin abordarse, y SAT-003 lo deja explicitamente fuera de alcance.
- **No publica en tiendas.** No hay binarios: eso requeriria React Native + EAS
  Build, cuenta Apple Developer y Google Play.
- **No resuelve el §4.1 de SAT-003** (enganchar `SatelliteAppGuard` a rutas
  reales sin romper web/worker). Esta PWA es `apps/web`, no el satelite.

## Pendiente de decision

SAT-003 da por existente un repo satelite en `~/labsemse/semse-mobile-app`, pero
**no esta en esta maquina ni en GitHub** (no existe la org `labsemse` ni un repo
con ese nombre). Conviene confirmar donde vive antes de apoyarse en esa premisa,
o actualizar la spec si el camino pasa a ser esta PWA.
