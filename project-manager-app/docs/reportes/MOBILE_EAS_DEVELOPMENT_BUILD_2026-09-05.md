# Cierre de preparación móvil y EAS — 2026-09-05

## Alcance

Se trabajó únicamente sobre la app móvil canónica integrada en
`apps/mobile`. La app standalone `C:/Users/SEMSEproject/semse-mobile` no fue
modificada. No se hizo push a GitHub ni deploy a Railway.

## Cambios

- Se añadió `expo-dev-client` a `apps/mobile/package.json`, necesario para el
  perfil EAS `development`.
- Se alinearon las dependencias nativas de Expo SDK 57 y React Native 0.86.3.
- Se añadió un `moduleNameMapper` en `apps/mobile/jest.config.js` para que las
  pruebas móviles usen una sola instancia de React y no fallen con `Invalid hook
  call` dentro del workspace.
- Se actualizó el README móvil con la instalación del APK interno.
- Se actualizó `pnpm-lock.yaml` sin eliminar archivos ni funcionalidades.

## Validación

- `tsc --noEmit` de `@semse/mobile`: correcto.
- Jest con `apps/mobile/jest.config.js`: 44 suites y 195 pruebas correctas.
- `app.json` y `eas.json`: JSON válido.
- Expo Doctor: 20/21. La única alerta es la duplicidad de React del monorepo:
  otra app web/assistant conserva React 19.2.7 y la app móvil usa React 19.2.3.
  El bundle móvil aislado resuelve sus dependencias SDK 57; no se cambió la
  versión web para evitar una regresión fuera del alcance móvil.

## Build Android

Se inició el build EAS development interno:

- ID: `515222d2-c731-48fd-bf2a-c4a7b8061850`
- Estado al cierre de este documento: `in progress`
- Logs: https://expo.dev/accounts/semseproject.com/projects/semse-mobile/builds/515222d2-c731-48fd-bf2a-c4a7b8061850

Cuando el estado sea `finished`, descargar el APK desde la página del build y
abrirlo en el teléfono Android. El perfil no publica en tiendas. Para iPhone se
requiere un build iOS firmado por EAS y la instalación correspondiente mediante
TestFlight o distribución interna; este entorno Windows no puede compilar Xcode
localmente.

