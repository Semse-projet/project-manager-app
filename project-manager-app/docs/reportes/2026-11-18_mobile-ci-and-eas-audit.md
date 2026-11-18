# 2026-11-18 — CI del móvil y auditoría de EAS

## 1. Por qué CI no detectó que la app móvil no compilaba

**Causa raíz:** ningún workflow ejecuta nada de `apps/mobile`.
- `ci.yml` (`quality-gates`, `unit-coverage`, `e2e`) corre `test:unit` de la raíz, `verify:workspace` (API),
  `spec:preflight`, builds de API y web y Playwright de la web.
- `pnpm check` (`test:unit` + Prisma + `build:api` + `build:web`) tampoco incluye el móvil.
- Ningún workflow tiene filtros de rutas sobre `apps/mobile/**`.

Por eso `main` llegó a tener `react-native@0.87.1` con Expo SDK 57 (que exige 0.86.3): `expo export` fallaba y jest no
arrancaba en ninguna suite, sin que ningún check se pusiera en rojo. Corregido en #1162.

## 2. Workflow propuesto: `.github/workflows/mobile-checks.yml`

- **Disparadores:** PRs que tocan `apps/mobile/**`, `packages/schemas/**`, `packages/design-tokens/**`, el
  `package.json` raíz, `pnpm-lock.yaml`, `pnpm-workspace.yaml` o `.npmrc`; también `workflow_dispatch`.
  - El propio archivo del workflow **no** está en `paths`, así que el PR que lo agrega no lo ejecuta. Se activa al
    fusionarse, o a mano, con la autorización del propietario.
- **Pasos:**
  - `pnpm install --frozen-lockfile`;
  - `build:packages` (jest usa los `dist/` de `@semse/schemas` y `@semse/design-tokens`);
  - `expo install --check`;
  - `expo-doctor@1.21.8` (versión fija);
  - `tsc` (`pnpm check`);
  - jest (`--ci`);
  - `expo export` de Android e iOS.
- **Costo:** un job de `ubuntu-24.04` con caché de pnpm y timeout de 20 min. Localmente, el export tarda unos 10 s por
  plataforma. No usa EAS ni credenciales.
- **No sustituye** un build nativo con EAS ni pruebas en dispositivo: no compila código nativo (Gradle o Xcode), no
  firma, no instala y no ejercita el renderer Fabric en un teléfono.
- **Lint:** `apps/mobile` no tiene script ni configuración de lint; agregarlo queda fuera de este PR.
- **Validación local** (rama apilada sobre #1162, con los mismos comandos del workflow): `expo install --check` OK,
  expo-doctor 21/21, `tsc` OK, jest 232/232, export de Android e iOS OK. **Todavía no hay ejecución en GitHub
  Actions:** el workflow no corre en su propio PR.

## 3. Auditoría de EAS y configuración de Expo (punto 3)

| Elemento | Estado | Observación |
|---|---|---|
| `eas.json` perfiles | `development` (dev client, APK interno), `preview` (APK interno), `production` (store, app-bundle, autoIncrement) | `appVersionSource: remote`. |
| **URL de la API** | **Los 3 perfiles usan `https://api.semseproject.com`, es decir, producción** | No hay separación entre staging y producción. Además, `environment.ts` cae a la URL de producción si falta la variable. |
| Staging | No hay un staging permanente documentado | Los runbooks describen un staging aislado y temporal (T-008); no hay URL estable. |
| Variables `EXPO_PUBLIC_*` | `EXPO_PUBLIC_SEMSE_API_BASE_URL` (canónica), `EXPO_PUBLIC_SEMSE_API_URL` (legacy; si ambas difieren, la app falla al arrancar) y `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | La clave de Stripe **no** está en `eas.json`: tiene que venir de las variables de entorno de EAS. Sin ella, `StripeProvider` no se monta y el alta de método de cobro no funciona. Solo debe ser la clave **publicable**. |
| Identificadores | iOS `com.semse.mobile`, Android `com.semse.mobile`, `owner: semseproject.com`, `projectId` presente | — |
| Ubicación | Permisos Android coarse, fine, background y foreground service de ubicación; iOS `UIBackgroundModes: location`; plugin `expo-location` con textos de permiso y segundo plano habilitado | Los textos solo existen en español; falta la versión en inglés (localización de `infoPlist`). |
| Tareas en segundo plano | `expo-task-manager` como plugin; tarea `semse-proximity-location-task` | — |
| Firma y credenciales | No verificables desde aquí | No hay sesión de EAS (`eas whoami` requiere login). |

**Propuesta (no aplicada):** para el piloto, usar el perfil `preview` con un `environment` de EAS, por ejemplo
`"environment": "preview"`, para que `EXPO_PUBLIC_SEMSE_API_BASE_URL` y `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` vengan de las
variables de EAS de ese entorno, apuntando a un staging real. **No se cambió `eas.json`:** sin un staging existente,
cambiar `preview` lo rompería o, peor, lo dejaría apuntando en silencio a producción por la URL por defecto.

**Requiere al propietario:**
- definir el entorno del piloto: un staging existente o producción con datos piloto;
- cargar las variables de EAS;
- iniciar sesión con `eas login`;
- dar acceso a Apple Developer para iOS.
