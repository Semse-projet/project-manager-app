# SEMSE Mobile Infra Baseline

## Proposito

Definir la base infraestructural minima para operar la app movil contra el ecosistema canonico.

## Dependencias core

- web / BFF canonico
- API canonica
- PostgreSQL
- Redis
- MinIO o storage equivalente
- Mailhog en local

## Contrato minimo

- la app movil no corre backend propio;
- consume BFF o API canonica;
- puede ejecutarse en modo `mock`, `bff` o `api-direct`;
- la observabilidad y trazabilidad residen en el ecosistema core.

## Modo local recomendado

- `VITE_SEMSE_RUNTIME_MODE=mock` para UX y layout
- `VITE_SEMSE_RUNTIME_MODE=bff` para integracion progresiva
- `VITE_SEMSE_RUNTIME_MODE=api-direct` solo para debugging controlado
