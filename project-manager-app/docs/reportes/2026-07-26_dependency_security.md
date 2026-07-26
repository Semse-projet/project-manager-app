# Reporte de remediación de dependencias

Fecha: 2026-07-26  
Rama: `codex/semse-account-center`

## Resultado

Se corrigieron las alertas abiertas de Dependabot y las alertas adicionales
detectadas por `pnpm audit`, actualizando los lockfiles principal y aislado de
`apps/assistant-portal`.

| Dependencia | Versión segura aplicada |
|---|---:|
| `@fastify/static` | 10.1.2 |
| `@hono/node-server` | 2.0.10 |
| `brace-expansion` | 5.0.8 en todas las rutas |
| `body-parser` | 1.20.6 |
| `dompurify` | 3.4.12 |
| `fast-uri` | 3.1.4 y 4.1.1 |
| `find-my-way` | 9.7.0 |
| `js-yaml` | 4.3.0 |
| `sharp` | 0.35.0 |
| `tar` | 7.5.21 |

Los cambios son de dependencias; no modifican lógica de negocio, esquema de
base de datos, migraciones, variables de entorno ni despliegues.

## Verificación

- Auditoría del workspace: `No known vulnerabilities found`.
- Auditoría aislada de `assistant-portal`: `No known vulnerabilities found`.
- Build API: pass.
- Lint web: pass, 0 errores y 54 advertencias preexistentes.
- Build web: pass, 403 páginas generadas.
- Build assistant-portal: pass.
- `git diff --check`: pass.

El primer `tsc --noEmit` aislado de assistant-portal mostró incompatibilidades
preexistentes entre dos copias de `@types/express`; el build productivo sí pasó.
La remediación no añade una excepción de auditoría ni ignora vulnerabilidades.
