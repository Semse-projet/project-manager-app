# 2026-11-18 — Alinear apps/mobile con Expo SDK 57 (la app no compilaba)

## Problema
En `main`, la app móvil **no se podía empaquetar**:
- `expo export` fallaba con `Cannot find module 'react-native/rn-get-polyfills'`.
- jest no arrancaba en ninguna suite: faltaba `@react-native/assets-registry`.

Causa: `react-native@0.87.1` cuando Expo SDK 57 exige `0.86.3`, más otras 16 dependencias desalineadas según
`expo install --check`. CI no ejecuta pruebas del móvil, por eso no se había detectado.

## Cambios
- **`apps/mobile/package.json`**: versiones que pide Expo SDK 57.
  - `react-native` 0.86.3.
  - `expo` ~57.0.33 y los módulos `expo-*`.
  - `react-native-screens`, `react-native-safe-area-context`, `react-native-webview` y `jest-expo`.
  - `@stripe/stripe-react-native` 0.64.0. El código solo usa `StripeProvider`, `CardField`, `useStripe` y
    `createToken`; el typecheck pasa.
- **Fuera de la validación de Expo** (`expo.install.exclude`): `react-dom` y `@types/react` (además de `react`).
  Los comparte `apps/web` con el `node-linker=hoisted`, así que se mantienen en 19.3.0. RN 0.86.3 acepta
  `react ^19.2.3`.
- **`packages/knowledge/package.json`**: declara `zod ^3.24.2`. Usaba `zod` sin declararlo y recibía el que quedaba en
  la raíz; al actualizar `@expo/cli`, la raíz pasó a `zod` 4 y el build de la web falló. Con la declaración, la raíz
  vuelve a 3.25.76.

## Verificación (local)
- `expo install --check`: «Dependencies are up to date».
- `expo export`: Android OK (1253 módulos) e iOS OK (1256 módulos).
- Móvil: `tsc` limpio; **jest 50 suites y 232 tests en verde** (antes no arrancaba ninguna).
- Web: `pnpm build:web` OK.
- API: `@semse/api` 4016 pass / 0 fail.
- Raíz: `test:unit` 1720 pass / 0 fail.

## No verificado
Build nativo con EAS e instalación en dispositivos (Motorola y dos iPhone): es el paso siguiente. Tampoco el flujo de
Stripe en un teléfono.
