# Fusión de aplicaciones móviles SEMSE — 2026-09-05

## Decisión

La aplicación canónica será `project-manager-app/apps/mobile`, porque pertenece al workspace integrado de GitHub y comparte contratos, autenticación y API con SEMSE. La app independiente `C:/Users/SEMSEproject/semse-mobile` se conserva intacta como respaldo y fuente de capacidades; no se elimina.

## Capacidades preservadas

La app canónica mantiene sus flujos existentes: login, roles Worker/Client/Admin, Jobs, propuestas, Labor/Timer, geolocalización en segundo plano, evidencia, disputas, incidentes, viajes, pagos, confianza, reputación y notificaciones.

De la app independiente se integraron:

- Cliente API para sesiones Prometeo/LiveKit.
- Pantalla de consulta a Prometeo.
- Pantalla de creación y cierre de inspecciones en vivo por Job.
- Componente nativo LiveKit con cámara, micrófono y controles.
- Fallback web que informa la necesidad de un development build nativo.
- Plugins Expo para WebRTC y permisos de cámara/micrófono.

## Acceso dentro de la app

En el navegador Worker, abrir `Más` y seleccionar `Prometeo` o `Inspección en vivo`. La inspección solicita el ID del Job, crea una sesión gobernada y obtiene el token multimedia desde el API; no se guardan secretos LiveKit en el cliente.

## Configuración

La variable móvil requerida es:

```text
EXPO_PUBLIC_SEMSE_API_BASE_URL=https://api.semseproject.com
```

LiveKit requiere un development build o un build EAS nativo. Expo Go no incluye las dependencias WebRTC necesarias.

## Dependencias alineadas

Se agregaron al workspace móvil las dependencias LiveKit/WebRTC, `expo-local-authentication`, `@react-native-community/netinfo` y `zustand`, y se actualizó `pnpm-lock.yaml`. También se corrigieron tipos de carga de fotos, notificaciones y navegación heredada.

## Validación

- TypeScript `apps/mobile/tsconfig.json`: correcto.
- Jest móvil con `apps/mobile/jest.config.js`: 43 suites, 191 pruebas aprobadas.
- Jest quedó limitado a `apps/mobile/src/**/*.test.*`; las pruebas `node:test` de `apps/mobile/test` se conservan para su runner correspondiente.
- No se hizo push a GitHub ni build EAS; esas acciones requieren autorización explícita.
