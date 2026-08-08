# Env Strategy

Fecha: 2026-04-23

## Principios

- El frontend movil no debe compartir puerto con el BFF web.
- `runtimeMode=bff` es el modo recomendado para integracion local.
- `runtimeMode=api-direct` solo debe usarse cuando la app pueda inyectar identidad o bearer token de forma controlada.
- El fallback `mock` debe poder apagarse para validacion preproduccion.

## Variables

- `VITE_SEMSE_MOBILE_PORT`
  Puerto del dev server movil. Canon: `4174`.
- `VITE_SEMSE_BFF_BASE_URL`
  Canon local: `http://127.0.0.1:3000/api/semse`
- `VITE_SEMSE_API_BASE_URL`
  Canon local: `http://127.0.0.1:4122`
- `VITE_SEMSE_RUNTIME_MODE`
  `mock | bff | api-direct`
- `VITE_SEMSE_ALLOW_MOCK_FALLBACK`
  `true` en desarrollo exploratorio, `false` en validacion de integracion.

## Modo recomendado hoy

- `VITE_SEMSE_MOBILE_PORT=4174`
- `VITE_SEMSE_RUNTIME_MODE=bff`
- `VITE_SEMSE_ALLOW_MOCK_FALLBACK=true`
