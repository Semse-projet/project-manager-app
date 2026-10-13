# PR #898 — reparación de la regresión CI (2026-10-13)

## Alcance autorizado
Corregir los checks del PR #898. Base inspeccionada: `6b0af0d4582cf0551a98909937a3425b28d413e9`.
Cambio limitado al montaje de la prueba y a este registro. No modifica runtime, flags, secretos, workflows, permisos, producción ni main.

## Contrato y diagnóstico
Contrato existente: `docs/specs/api/auth-account-session-remediation.spec.md`; Constitución artículos II y IX.
Los jobs `quality-gates` (115069012693) y `unit-coverage` (115069012674), run 38305236633, fallaron en:
`production denies persisted seeded demo admin credentials before DB lookup`.

El test construía AuthService con tres dependencias; su constructor necesita además SemseLoggerService.
La rama de denegación llama a logger.warn antes de lanzar UnauthorizedException.
Por eso el test recibía TypeError, no el rechazo contractual. Se añade el doble de logger como cuarto argumento.
Se conservan la aserción de UnauthorizedException, la comprobación de cero consultas y el fallo explícito si se intenta auditar emisión de sesión.
No se cambia ningún control de autenticación ni se reduce la cobertura exigida.

## Validación y límites
- Evidencia previa: https://github.com/Semse-projet/project-manager-app/actions/runs/38305236633
- Validación local completa: no ejecutada; el checkout git requiere credenciales no disponibles en el shell. Se usa la conexión GitHub autorizada.
- CI del nuevo commit: pendiente al escribir este registro; consultar checks asociados al SHA de este cambio y la descripción del PR.
- Los análisis históricos de GitHub no tenían steps y sus logs devolvían BlobNotFound; no se atribuye su causa a código ni facturación sin evidencia.
- Merge, deploy y verificación autenticada en producción: no ejecutados por esta reparación.
- No usar credenciales demo contra producción. Sigue pendiente demostrar acceso OPS_ADMIN legítimo no ligado a usr_admin_001.

## Cierre requerido
CI completo satisfactorio sobre el HEAD; no marcar E2E omitido como aprobado.
La descripción del PR debe reflejar que las identidades legacy demo están bloqueadas en producción incluso con SEMSE_DEMO_MODE o contraseña privada.
