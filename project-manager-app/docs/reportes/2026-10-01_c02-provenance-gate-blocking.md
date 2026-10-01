# C02 — Provenance en runtime: de informativo a gate bloqueante (2026-10-01)

## Autorización (constancia)
`AGENTS.md` prohíbe tocar CI/CD sin autorización. El dueño autorizó explícitamente este cambio en sesión el 2026-10-01 con esta condición exacta: un ciclo informativo adicional en verde que vuelva a demostrar `gitSha === DEPLOY_SHA`, y entonces un PR independiente que convierta provenance en gate bloqueante, sin modificar branch protections, sin cambiar secretos, sin mezclar cambios funcionales. La condición se cumplió: ciclos en `7c9df29` (deploys API `26d406f8`, web `5c55ddb9`) y `f59d1b0` (API `73e1c27d`, web `04b5473a`), ambos `gitSha === DEPLOY_SHA`.

## Contrato del gate (`railway-deploy.yml`, job `health-check`)
| Condición | Resultado |
|---|---|
| Health sin respuesta, caído o no 2xx tras 6 reintentos | **falla** |
| Plazo por intento de 15 s (cabeceras **y** cuerpo) — un health colgado no bloquea la cola | cuenta como intento fallido |
| `gitSha` ausente/`unknown` o distinto del `DEPLOY_SHA` (igualdad exacta, sin prefijos) | **falla** |
| `deploymentId` o `environment` ausentes | **falla** |
| `imageDigest: unknown` | **warning** (`🟡` + `::warning`), no falla |
| El checkout del verificador falla | **falla** (no se puede verificar) |

El resumen del job muestra `⚠️` con el motivo en cualquier fallo (incluido HTTP no 2xx aunque el cuerpo coincida) y conserva el `🟡` del digest aunque haya otro fallo.

## Pruebas
13 tests (`tests/unit/c02-verify-deploy-provenance.test.mjs`): exactitud del sha, unknown/digest, markdown (HTTP 503, digest con sha distinto) y CLI contra servidores HTTP locales reales (coincide, sha distinto, `deploymentId` ausente, 503, sin respuesta, **cuerpo colgado**). Los tests nuevos fallan con el verificador anterior y pasan con el actual.

## Alcance / límites
- No modifica branch protections ni secretos; sin cambios funcionales.
- `imageDigest` sigue `unknown` hasta que el build inyecte un digest verificable.
- Rollback: `git revert` del commit; el gate solo marca el workflow en rojo, no revierte nada en Railway.
- El reporte `2026-10-01_c02-ci-provenance-informational.md` documenta la fase informativa previa.
