# Live Backend Wiring Status

Fecha: 2026-04-23

## Dominios con cableado vivo inicial

- `jobs`
  Usa `/api/semse/jobs` y `/api/semse/jobs/:jobId`.
- `payments`
  Usa `/api/semse/jobs/:jobId/payments` y agrega resultados por job.
- `travel`
  Usa `/api/semse/travel`, `/api/semse/travel/:travelId/expenses`, `/lodging` y `/advances`.
- `profile`
  Usa `/api/semse/users/me`, nueva ruta BFF que deriva a `/v1/users/:userId`.

## Infra aplicada

- `semse-mobile-app` ya no compite con el BFF en `3000`; su puerto canonico de desarrollo es `4174`.
- El router principal usa `React.lazy` + `Suspense`.
- Vite ya genera chunks separados y `manualChunks`.

## Limites actuales

- Algunos contratos visibles del core no entregan todos los campos que la UX movil espera.
- Por eso los mappers completan ciertos valores con defaults de presentacion.
- Los repositories todavia pueden caer a `mock` si `VITE_SEMSE_ALLOW_MOCK_FALLBACK=true`.
- `users/me` hoy puede devolver `404` en local si el `userId` operativo del runtime no existe en `v1/users`.
- `jobs/:jobId/payments` puede devolver `404` si el job todavia no tiene proyecto/escrow asociado.

## Smoke real ejecutado

- `http://127.0.0.1:4174/` responde `200 OK` para la app movil.
- `http://127.0.0.1:3000/api/semse/jobs` responde datos vivos.
- `http://127.0.0.1:3000/api/semse/travel` responde datos vivos.
- `http://127.0.0.1:3000/api/semse/travel/:travelId` responde datos vivos.
- `http://127.0.0.1:3000/api/semse/users/me` hoy responde `404` para `usr_demo`.

## Siguiente fase recomendada

- Reducir defaults de presentacion moviendo mas datos al contrato visible del backend.
- Ejecutar smoke real en modo `bff` con la app movil corriendo en `4174`.
- Expandir el mismo patron a `incidents`, `disputes`, `materials`, `field-ops` y `milestones`.
