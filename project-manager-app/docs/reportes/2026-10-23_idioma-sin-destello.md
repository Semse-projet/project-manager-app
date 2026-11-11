# Idioma elegido desde el primer pintado (sin destello de español)

**Fecha:** 2026-10-23 · **Rama:** `claude/fix-language-flash` (desde `main` @ `06dfd7b`) · **Pedido por:** el responsable, a partir de la nota del PR #1030 · **CI de GitHub:** bloqueado a nivel de cuenta; la evidencia es local.

## Hallazgo

`LanguageProvider` arrancaba siempre en `"es"` y leía la preferencia de `localStorage` dentro de un efecto. Por eso el servidor dibujaba todas las páginas en español con `<html lang="es">`, y quien había elegido inglés veía un instante en español hasta que React cambiaba el texto. Pasaba en toda la app.

## Cambio

- `lib/language-preference.ts`, un módulo sin `"use client"` que se usa también en el servidor. Contiene:
  - el tipo;
  - la clave `semse-language`, la misma que ya se usaba en `localStorage`;
  - `parseLanguagePreference`, que sólo acepta `es` o `en`;
  - `languageCookie`, una cookie de preferencia: un año, todo el sitio, `SameSite=Lax` y `Secure` en HTTPS. No es una credencial.
- El **layout raíz** lee esa cookie en el servidor y renderiza `<html lang>` y el idioma inicial (`InitialLanguageProvider`). El layout ya era `force-dynamic`, así que leer la cookie no vuelve dinámica ninguna página estática.
- **`LanguageProvider`:**
  - empieza con el idioma del servidor;
  - `setLanguage` guarda la elección en la cookie y en `localStorage`;
  - al montar, si un visitante sólo tenía la preferencia antigua en `localStorage`, la aplica una vez y escribe la cookie, así que desde la siguiente carga ya no hay destello;
  - tolera un `localStorage` bloqueado (modo privado).
- La API pública de `language-context` no cambia (`LanguageProvider`, `useLanguage`, `LanguagePreference`), así que no hay que tocar ninguna pantalla.

## Evidencia (web en modo producción, Chromium sin interfaz)

| Prueba | Resultado |
|---|---|
| HTML del servidor de `/contributors` con cookie `en` y con cookie `es` | 20 líneas de texto distintas: «How it works» frente a «Cómo funciona»; `<html lang="en">` frente a `"es"` |
| Cookie `fr` o sin cookie | español, `<html lang="es">` |
| Pulsar «English» | cookie `semse-language=en`: un año, `Path=/`, `SameSite=Lax`, no `httpOnly` |
| Recargar **con JavaScript desactivado** | ya en inglés y con `lang="en"`: lo decide el servidor, no hay destello |
| Visitante con sólo `localStorage=en` (preferencia antigua) | la primera visita se corrige al hidratar y escribe la cookie; la segunda llega del servidor en inglés |
| Visitante nuevo | español, como antes |
| Avisos de React o de hidratación con cookie `en`/`es` en `/contributors` y `/login` | ninguno. Sólo aparece un 503 de la API local, que estaba apagada, igual en los dos idiomas |
| `tests/unit/language-preference-cookie.test.ts` | 4 pass |
| Tests unitarios de la raíz | 1556 pass, 1 fail (`isUrlSafe`, necesita DNS real) |
| `tsc`, `next build` y `pnpm --filter @semse/web lint` | 0 errores; ningún aviso en los archivos modificados |

## Notas

- Las páginas de acceso de #1030 crean su propio `LanguageProvider`, así que heredan el arreglo sin cambios.
- Las páginas que no usan `LanguageProvider` siguen como estaban.
