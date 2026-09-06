# Addendum de integración móvil — 2026-09-05

## Cierre de sesión en vivo

La pantalla `LiveInspectionScreen` ahora escucha el endpoint SSE de la sesión y actualiza estado y versión sin refrescar manualmente. El componente LiveKit solo se monta cuando la sesión está `ACTIVE` o `CONNECTING`; esto evita pedir tokens multimedia antes de que el API autorice la conexión. El cierre envía la versión más reciente para respetar control optimista y evitar transiciones obsoletas.

## Compatibilidad conservada

El archivo legado `src/navigation/index.ts` no se eliminó: ahora funciona como puente hacia `RootNavigator`, que es el único árbol de navegación activo. La app standalone y todos sus archivos siguen en `C:/Users/SEMSEproject/semse-mobile` sin modificaciones.

## Validación de cierre

- TypeScript móvil: correcto.
- Prueba de navegación Worker/More: 2/2 correcta.
- Suite móvil completa anterior: 43 suites, 191/191 pruebas correctas.
- Configuración `app.json`, `eas.json` y `package.json`: JSON válido.
- Sin push, sin EAS build y sin cambios en Railway.
