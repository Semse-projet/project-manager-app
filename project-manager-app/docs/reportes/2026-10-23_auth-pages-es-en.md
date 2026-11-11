# Páginas de acceso en ES/EN: login, registro y recuperación de contraseña

**Fecha:** 2026-10-23 · **Rama:** `claude/fix-login-i18n` (desde `main` @ `06dfd7b`) · **Pedido por:** el responsable, tras la revisión de producción de esta sesión · **CI de GitHub:** bloqueado a nivel de cuenta; toda la evidencia es local.

## Hallazgo

En producción (`app.semseproject.com/login`, revisada sólo en lectura) la página de entrar estaba únicamente en español y no tenía selector de idioma. En el código pasaba lo mismo en las cuatro páginas públicas de acceso: `/login`, `/register`, `/forgot-password` y `/reset-password`. Los textos estaban fijos en español y los mensajes de error se mostraban tal cual los devuelve la API, también en español. Quedan fuera del layout `(app)`, que es donde vive el selector de idioma.

## Cambio

- **Selector común `app/_auth/LanguageSwitch.tsx`**: botones ES/EN con `role="group"`, `aria-pressed` y `lang`. Usa `LanguageProvider`, así que guarda la elección en `localStorage["semse-language"]` y actualiza `<html lang>`, igual que el resto de la app.
- **Medidor de contraseña común `app/_auth/PasswordStrength.tsx`**, traducido. Antes estaba duplicado en registro y en nueva contraseña.
- Cada página se envuelve en `LanguageProvider` y lleva su catálogo `COPY = { es, en }`, el mismo patrón que las otras páginas con catálogo propio.
- **Errores elegidos por código HTTP**, no por el texto de la API:
  - login: 401 → credenciales inválidas; 429 → demasiados intentos;
  - registro: 409 → la cuenta ya existe (con enlace a entrar); 429 → demasiados intentos;
  - recuperación: el enlace no es válido o caducó.
- El español visible no cambia. El inglés es nuevo.
- Sin cambios en la API, en la BFF ni en el esquema.

## Checklist final

- ✅ Test nuevo `tests/unit/auth-pages-i18n.test.ts` (15 casos). Para cada una de las 4 páginas comprueba:
  - mismas claves en `COPY.es` y `COPY.en`;
  - envuelta en `LanguageProvider` y con el selector común;
  - sin texto en español fuera del catálogo;
  - sin mostrar `data.error` de la API.

  Además cubre los errores del login por código HTTP, la accesibilidad del selector y el medidor en los dos idiomas.
- ✅ `tests/unit/demo-login.test.ts` sigue en verde: el modo demo continúa oculto en producción.
- ✅ Los e2e existentes siguen siendo válidos: un navegador nuevo empieza en español y el selector del botón de envío ya acepta `Ingresar|Sign in`.

## Evidencia (web en modo producción, Chromium sin interfaz)

| Prueba | Resultado |
|---|---|
| `/login` sin preferencia guardada | «Iniciar sesión», `<html lang="es">` |
| Pulsar EN | «Sign in», botón «Sign in →», etiqueta «Password», `<html lang="en">` |
| Recargar | sigue en inglés, EN con `aria-pressed="true"` |
| Login → «Create account →» | registro entero en inglés; medidor «Very weak» |
| `/forgot-password` y `/reset-password?token=…` | «Reset your password» / «New password» |
| `/reset-password` sin token | «Invalid link» → pulsar ES → «Enlace inválido» |
| Contraseña incorrecta (API local real) | EN: «Could not sign in with those credentials» · ES: «No se pudo iniciar sesión con esas credenciales» |
| Errores de JavaScript en la página | ninguno |
| Tests unitarios de la raíz | 1567 pass, 1 fail: `browser-governance isUrlSafe`, que necesita DNS real |
| `tsc --noEmit` y `pnpm --filter @semse/web lint` | 0 errores; ningún aviso en los archivos modificados |

## Notas para después

1. **Destello de español al cargar.** Al cargar cada página se ve un instante en español antes de aplicar la preferencia guardada. Pasa en toda la app porque `LanguageProvider` lee `localStorage` en un efecto. Arreglarlo para todas las pantallas (cookie de idioma o script previo a la hidratación) es un cambio aparte.
2. **CSP y Google Fonts.** En local, la consola muestra que la CSP de `next.config.ts` (`style-src 'self' 'unsafe-inline'`) bloquea la hoja de Google Fonts (Geist). No viene de este PR. Hay que decidir si se permite `fonts.googleapis.com` o se alojan las fuentes en el propio servidor.
3. **Validador i18n.** Cuando `scripts/quality/validate-critical-i18n.ts` (#1022) llegue a `main`, conviene añadir estas cuatro páginas a la lista que revisa.
