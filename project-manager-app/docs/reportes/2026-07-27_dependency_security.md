# Reporte de remediación de dependencias

Fecha: 2026-07-27
Rama: `codex/dependabot-remediation`

## Alcance

Esta remediación parte de `main` actualizado y corrige las tres alertas de
Dependabot que seguían abiertas en el lockfile principal:

| Dependencia | Versión vulnerable | Versión aplicada |
|---|---:|---:|
| `@hono/node-server` | 1.19.14 | 2.0.10 |
| `brace-expansion` | rutas anteriores a 5.0.8 | 5.0.8 |
| `tar` | 7.5.20 | 7.5.21 |

Las versiones se fijan mediante `pnpm.overrides` en el manifiesto raíz y el
lockfile se regeneró con `pnpm install --lockfile-only --ignore-scripts`.

## Verificación

- `pnpm audit`: `No known vulnerabilities found`.
- El diff está limitado al manifiesto raíz y `pnpm-lock.yaml`, más este
  informe.
- `@nestjs/platform-fastify` muestra una advertencia de peer preexistente:
  espera `@fastify/static` 8.x/9.x y el workspace usa 10.1.2. No es una alerta
  de seguridad ni se modifica en este parche.

No se modifican lógica de negocio, esquema de base de datos, migraciones,
variables de entorno ni despliegues.
