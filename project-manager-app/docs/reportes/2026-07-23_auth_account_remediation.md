# Remediación de autenticación y recuperación de cuenta

**Fecha:** 2026-07-23

**Rama:** `fix/audit-money-security-batch-v2`

**Plan ejecutable:** `0.1`, `0.2`, `0.32`

**Spec:** `api.auth-account-session-remediation` v1.1 (`VERIFIED`)

**Decisión pendiente:** `0.3`, gobernada por
`auth.session-revocation-architecture` (`REVIEW`)

## Resultado

Se cerró y verificó el boundary de identidad entre navegador y BFF:

- los cuatro headers de identidad `x-semse-*` aportados por el cliente se
  eliminan;
- una sesión firmada vuelve a fijar la identidad confiable;
- bootstrap productivo falla cerrado si el secreto falta o es incorrecto;
- recuperación de contraseña normaliza el email y no enumera cuentas;
- producción nunca devuelve el token raw de recuperación;
- solo el hash SHA-256 del token se persiste;
- confirmar el reset consume el token una sola vez y revoca las sesiones
  persistidas;
- la validación BFF quedó alineada con la policy API de 12 caracteres;
- `RESEND_API_KEY` y `EMAIL_FROM` quedaron documentadas en las plantillas de
  entorno.

## Separación de `0.3`

La revocación inmediata de access tokens no se declaró resuelta. El plan
registra una decisión explícita del 2026-07-21 de no restaurar la consulta
síncrona a PostgreSQL por cada request, porque ya causó timeouts reales de
15 segundos en Railway.

El riesgo residual —access tokens ya emitidos válidos hasta 8 horas— quedó
aislado en una spec de arquitectura que exige aprobar SLO y estrategia antes
de implementar: denylist rápida, access tokens cortos o versión de
sesión/usuario. Logout y reset sí revocan las sesiones y refresh tokens
persistidos.

## Regresiones agregadas

- headers falsificados eliminados sin sesión;
- headers falsificados sobrescritos desde sesión firmada;
- bootstrap productivo sin secreto, con secreto incorrecto y correcto;
- logout de la sesión actual y exclusión de sesiones revocadas al refrescar;
- respuesta serializada idéntica para email existente/inexistente;
- fallo del proveedor de correo sin filtración pública;
- destinatario canónico y link con token raw solo para el proveedor;
- persistencia exclusiva del hash del token;
- consumo único, expiración y revocación de sesiones;
- confirmación que entrega al repositorio el hash y no el token raw.

## Validación local

- tests focalizados API/Auth: 17/17 pasan.
- tests de política BFF: 6/6 pasan.
- `pnpm --filter @semse/api build`: pasa.
- `pnpm --filter @semse/api lint`: pasa.
- `pnpm --filter @semse/web build`: pasa; compilación y tipos válidos, 402
  páginas estáticas generadas.
- `pnpm --filter @semse/web lint`: 0 errores; 54 warnings preexistentes fuera
  del lote.
- `node scripts/spec-validate.mjs --strict`: 104 specs, 0 errores, 0 warnings.
- `pnpm spec:audit-plan-coverage`: 157/157 items mapeados.
- `git diff --check`: pasa.

## Gate operativo

Antes de declarar el envío de correo verificado en vivo:

1. configurar `RESEND_API_KEY` en el servicio API;
2. configurar `EMAIL_FROM` con un remitente verificado;
3. solicitar reset para una cuenta controlada y comprobar recepción;
4. confirmar que el link funciona una sola vez y que el refresh token anterior
   ya no rota;
5. revisar logs de proveedor sin copiar el token raw.

Este lote no fue desplegado ni se probó contra producción.

## Rollback

Un rollback no puede volver a confiar en headers del cliente, exponer tokens
de recuperación ni quitar la revocación persistida de refresh tokens.
