# Estilos base en `@layer base`: botones y espaciado de las páginas con Tailwind

**Fecha:** 2026-10-26 · **Rama:** `claude/fix-publicar-proyecto-cta` (desde `main` @ `06dfd7b`) · **Origen:** hallazgo del PR #1041 (texto de «Publicar proyecto» invisible)

## Causa

`apps/web/app/globals.css` declaraba el reset base **fuera de cualquier capa**:

```css
*, *::before, *::after { margin: 0; padding: 0; }
a { color: var(--brand); }
button, input, textarea, select { color: inherit; }
```

Tailwind v4 coloca sus utilidades en `@layer utilities`, y en CSS las reglas sin capa ganan a **todas** las capas, sea cual sea su especificidad. El resultado era que, en toda la web, se ignoraban:
- `p-*`, `px-*`, `py-*`, `m-*`, `mt-*`, `gap` de márgenes…: todo quedaba a 0;
- `text-white` y cualquier `text-*` en enlaces, que salían en `--brand`.

Las páginas con estilos en línea, como el login o casi todo `(app)`, no se veían afectadas. Las páginas públicas hechas con Tailwind, en cambio, sí, empezando por la **portada y «Cómo funciona», que son las que ve un visitante nuevo**:
- botones «Publicar proyecto» y «Publicar mi proyecto» con texto azul sobre fondo azul;
- ningún relleno;
- textos pegados.

Es la versión que sirve producción (`main` @ `06dfd7b`).

## Cambio

Ese bloque (reset universal, `html/body`, controles de formulario y `a`/`a:hover`) pasa a `@layer base`, que es donde Tailwind v4 espera los estilos base. Las utilidades vuelven a ganarle y los estilos en línea siguen ganando a todo. El contenido de las reglas no cambia.

## Evidencia (web en modo producción, Chromium a 1100 px)

| Medida | Antes | Después |
|---|---|---|
| Color de «Publicar proyecto» en `/` y `/como-funciona` | `rgb(37,99,235)` sobre fondo azul (invisible) | `rgb(255,255,255)` |
| Relleno de esos botones | `0px` | de `8px 16px` a `16px 32px` (los que pide su clase) |
| Botón de envío de `/login` (estilos en línea) | blanco, `12px` | igual: sin regresión |
| Errores de página | ninguno | ninguno |
| `tests/unit/web-base-styles-layer.test.ts` | **2 fail** (reproduce el fallo) | 2 pass |
| Tests unitarios de la raíz | — | 1554 pass, 1 fail (`isUrlSafe`, que necesita DNS real) |
| `next build` y lint de la web | — | 0 errores |

Capturas antes/después de `/`, `/como-funciona`, `/login` y `/contributors` en la carpeta de la sesión.

## Pantallas internas de la app (comprobado)

Como ahora las utilidades de Tailwind sí se aplican, también cambian los componentes que las usan dentro de `(app)`. Se revisaron 9 pantallas con sesión iniciada (cuentas sintéticas, web en modo producción, 1280 px), con el CSS de `main` y con el de este PR:

| Rol | Pantallas | Píxeles que cambian |
|---|---|---|
| Cliente | `/client/dashboard`, `/client/jobs`, `/client/marketplace` | 7.9 %, 4.9 %, 8.1 % |
| Profesional | `/worker/dashboard`, `/worker/tracker`, `/worker/settings` | 8.6 %, 9.2 %, 6.3 % |
| Admin | `/admin/dashboard`, `/admin/mission-control`, `/admin/marketplace` | 6.9 %, 2.5 %, 9.2 % |

El cambio común es la **barra lateral**. Antes tenía el logo pegado al borde, el botón de plegar encima del nombre y los enlaces sin margen. Ahora tiene el espaciado de su diseño, lo que desplaza unos píxeles el contenido principal. No hay errores de página ni elementos rotos.

## Corrección posterior (2026-10-27): el comentario cerraba antes de tiempo

La revisión de Codex en #1055 detectó que el comentario sobre el bloque decía `p-*/m-*/text-*`. Ese `*/` cierra el comentario, el resto se lee como un selector roto delante de `@layer base {` y el navegador descarta el bloque entero. En producción el `body` quedó sin fondo (transparente), con texto negro, 16px e interlineado normal. Los botones se veían bien porque el reinicio de Tailwind (preflight) ya cubre márgenes y relleno.

- Comentario reescrito sin `*/` dentro.
- El test quita los comentarios como lo hace el navegador (cada uno acaba en el primer `*/`) y exige que `@layer base {` quede como regla válida. Con el CSS anterior falla.
- Comprobado en Chromium con el CSS solo: antes `body` transparente, negro, 16px; después `rgb(5, 8, 16)`, `rgb(241, 245, 249)`, 15px, interlineado 24px.
- Build de producción local: estilos base aplicados, los CTA «Publicar proyecto» siguen blancos y con relleno, 9 pantallas de cliente, profesional y admin sin errores.
