# Auditoría de mantenimiento — 2026-08-30

## Alcance

Revisión de continuidad del monorepo SEMSEproject después de la reparación del
servicio API en Railway y la preparación de la aplicación móvil.

## Validaciones ejecutadas

- `pnpm validate:workspace`: OK.
- `pnpm spec:validate:strict`: OK; 108 especificaciones, 0 errores y 0 avisos.
- `pnpm --filter @semse/mobile check`: OK.
- `pnpm check:toolchain`: OK.
- `pnpm check:dockerfiles`: OK.
- `pnpm verify:prisma-contract`: OK; sin drift entre código, schema y migraciones.
- `pnpm build:api`: OK.
- `pnpm build:web`: OK; 403 páginas generadas.
- `pnpm test:unit`: OK; 1.008 aprobadas, 0 fallos y 4 omitidas.
- Prueba específica de Browser Agent: OK; 15/15.
- Mobile Jest: OK; 35 suites y 156 pruebas aprobadas.

## Corrección realizada

Se corrigió `tests/unit/browser-agent.service.test.ts`: el test de inspección
completada estaba colocando el mock del gateway IA en el argumento de evidencia.
Por eso el test pasaba únicamente gracias al fallback, mientras el runtime
registraba `aiGateway.generate is not a function`. Ahora el test inyecta el
gateway y `EvidenceGatewayService` en sus posiciones correctas y valida el
resumen JSON generado.

## Estado móvil

`apps/mobile/eas.json` apunta temporalmente al endpoint Railway saludable:

`https://project-manager-app-production-977f.up.railway.app`

Los builds `preview` terminaron correctamente en EAS:

- Android APK: build `ce25ce8a-5cca-4b63-877a-a9d7d782c629`.
- iOS IPA: build `c0de9605-b125-4f31-94f2-c411a38c6ec0`.

Las credenciales iOS y un iPhone están registrados en el proyecto EAS. Después
de esos builds se limpió la declaración duplicada de permisos Android en
`app.json`; el siguiente build debe regenerarse para incluir ese ajuste de
manifiesto.

## Pendientes controlados

- Integrar el cambio de `eas.json` en la rama fuente que despliega móvil.
- Confirmar que el dominio canónico `api.semseproject.com` vuelva a responder
  antes de sustituir el endpoint Railway en los perfiles EAS.
- Mantener separado el cambio local de la reparación API hasta que se decida
  qué rama debe convertirse en fuente de despliegue.

## Time Tracker móvil

La pantalla ahora muestra un contador `HH:MM:SS` calculado desde
`accumulatedSeconds` y `startedAt`/`resumedAt`, y permite pausar, reanudar y
detener la sesión mediante los endpoints del Labor Engine. La batería móvil
completa pasa 35 suites y 157 pruebas.

El nuevo build iOS `preview` (`e9e60606-b79d-47de-8aeb-e8de3c87df22`) fue
aceptado por EAS y está en progreso. El nuevo build Android no pudo enviarse
porque la cuenta EAS agotó la cuota gratuita mensual; el código queda listo
para reintentarlo cuando se restablezca la cuota.
