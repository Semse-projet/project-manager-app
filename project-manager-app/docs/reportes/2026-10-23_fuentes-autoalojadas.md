# Fuente Geist servida desde la propia web, sin Google Fonts

**Fecha:** 2026-10-23 · **Rama:** `claude/fix-self-hosted-fonts` (desde `main` @ `06dfd7b`) · **Pedido por:** el responsable, a partir de la nota del PR #1030 · **CI de GitHub:** bloqueado a nivel de cuenta; la evidencia es local.

## Hallazgo

`app/globals.css` cargaba Geist con `@import url('https://fonts.googleapis.com/…')`. La CSP de `next.config.ts` (`style-src 'self' 'unsafe-inline'`, `font-src 'self' data:`) bloquea esa hoja de estilos: la consola mostraba el error en cada página y el navegador usaba la fuente de sistema en lugar de Geist.

## Decisión

Había dos opciones: abrir la CSP a Google o alojar la fuente en la propia web. Se elige **alojarla**:

- la CSP no se abre;
- no se envía la IP de los visitantes a un tercero, algo relevante para el RGPD;
- desaparece una dependencia de red en tiempo de ejecución.

## Cambio

- Dependencia `geist@1.7.2` en `apps/web`, con la versión fijada. Es el paquete oficial de la fuente (licencia SIL OFL), publicado el 2026-06-01. No tiene scripts de instalación; sólo trae los `.woff2` y un `next/font/local`. En el lockfile se añaden 12 líneas.
- `app/layout.tsx` aplica `GeistSans.variable` y `GeistMono.variable` a `<html>`.
- `app/globals.css` quita el `@import` de Google; `--font-sans` y `--font-mono` apuntan ahora a `--font-geist-sans` y `--font-geist-mono`.
- `worker/tracker/page.tsx` usaba el nombre literal `'Geist Mono'`, que con `next/font` ya no coincide; pasa a `var(--font-mono)`.
- Sin cambios en la CSP, la API ni el esquema.

## Evidencia (web en modo producción, Chromium sin interfaz)

| Prueba | Antes (#1030, local) | Después |
|---|---|---|
| Errores de consola en `/login` | 2 × «Refused to load the stylesheet 'https://fonts.googleapis.com/…'» | ninguno |
| Peticiones de fuentes | a `fonts.googleapis.com` (bloqueadas) | sólo `/_next/static/media/*.woff2` (mismo origen) |
| Fuente del `body` en `/login` y `/` | la de sistema | `GeistSans`, con estado `loaded` |
| `tests/unit/web-self-hosted-fonts.test.ts` | — | 4 pass |
| Tests unitarios de la raíz | — | 1556 pass, 1 fail (`isUrlSafe`, necesita DNS real) |
| `tsc`, `next build` y `pnpm --filter @semse/web lint` | — | 0 errores; ningún aviso en los archivos modificados |
