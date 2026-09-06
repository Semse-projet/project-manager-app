# Manifiesto de archivos móviles — 2026-09-05

## Resultado

La app canónica es `project-manager-app/apps/mobile`. La app original `C:/Users/SEMSEproject/semse-mobile` permanece completa y sin modificaciones como respaldo recuperable.

## Matriz de cobertura

| Área de la app standalone | Estado en la app canónica |
|---|---|
| Login y sesión segura | Fusionado y reutiliza `src/context/AuthContext` y `src/api/client` |
| Jobs | Cubierto por `WorkerJobsStackNavigator` y `ClientJobsStackNavigator` |
| Profile | Cubierto por `SettingsScreen` y perfiles por rol |
| Tasks | Fusionado en `src/screens/TasksScreen.tsx` |
| Notifications | Fusionado en `src/screens/NotificationsScreen.tsx`, además de push nativo existente |
| Prometeo | Fusionado en `src/screens/PrometeoScreen.tsx` |
| LiveKit/WebRTC | Fusionado en `src/components/LiveKitCall.native.tsx` y fallback web |
| Sesiones SSE | Fusionado en `src/api/liveSessionEvents.ts` |
| Evidencia y fotos | Ya existía; se corrigió carga autenticada y tipado FormData |
| Navegación Expo Router | Conservada en la app standalone; la canónica usa un único React Navigation |
| Assets y configuración standalone | Conservados en su ubicación original; no se duplican innecesariamente |

## Archivos añadidos en la fusión

- `apps/mobile/src/api/liveSessions.ts`
- `apps/mobile/src/api/liveSessionEvents.ts`
- `apps/mobile/src/components/LiveKitCall.native.tsx`
- `apps/mobile/src/components/LiveKitCall.tsx`
- `apps/mobile/src/screens/PrometeoScreen.tsx`
- `apps/mobile/src/screens/LiveInspectionScreen.tsx`
- `apps/mobile/src/screens/TasksScreen.tsx`
- `apps/mobile/src/screens/NotificationsScreen.tsx`

## Validación

TypeScript móvil pasa sin errores. La suite propia de Jest pasa con 43 suites y 191 pruebas. La configuración Expo/EAS es JSON válido. No se eliminaron archivos de ninguna de las dos apps, no se hizo push y no se ejecutó un build EAS.
