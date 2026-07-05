# Railway — No Changes in Phase 2

En esta fase no se debe modificar Railway.

## Razón

El objetivo es frontend Admin modular. Cambiar Railway, Dockerfile, Nixpacks, variables o servicios al mismo tiempo aumenta el riesgo de romper producción.

## Permitido

- Documentar si el build web falla por configuración existente.
- Documentar comandos necesarios para validar.

## No permitido

- Cambiar `railway.json`.
- Cambiar Dockerfile.
- Cambiar variables de entorno.
- Cambiar healthchecks.
- Cambiar puertos.
- Cambiar servicios.
