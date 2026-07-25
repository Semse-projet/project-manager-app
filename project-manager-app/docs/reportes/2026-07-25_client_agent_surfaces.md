# Remediación de superficies IA del cliente — 2026-07-25

## Resultado

- `/agents` describe la topología real del producto: 6 chats directos, 10
  capacidades canalizadas y 8 automatizaciones backend sin chat directo.
- Las tarjetas conversacionales seleccionan el agente efectivo y comunican su
  estado con `aria-pressed`.
- Las automatizaciones ya no muestran “Backend activo” ni sugieren telemetría
  que la pantalla no consulta.
- El layout autenticado monta solo `AgentChatPanel`. El widget global
  `PrometeoCopilot`, que exponía errores internos y éxitos ficticios, fue
  retirado del layout.

## Límite explícito

El API, BFF y componente de Prometeo Copilot permanecen en el repositorio. Este
lote no afirma que su autenticación o sus acciones rápidas estén corregidas;
solo elimina su exposición global hasta que exista un contrato end-to-end
verdadero y probado.

## Validación

- [x] Regresión focal de catálogo y layout.
- [x] TypeScript del paquete web.
- [x] Lint del paquete web: 0 errores; 54 advertencias preexistentes fuera de este lote.
- [x] Validación estricta de specs: 105 specs, 0 errores, 0 advertencias; índice regenerado.
- [x] Cobertura integral del plan: 159/159 ítems mapeados.

No se hizo deploy ni verificación en producción.
