# Remediación de seguridad de Vision Service

**Fecha:** 2026-07-23

**Rama:** `fix/audit-money-security-batch-v2`

**Plan:** `0.10`, `0.11`, `0.26`

**Spec:** `api.vision-service-security` v1.1 (`VERIFIED`)

## Resultado

Se completó el contrato de seguridad que el fix original dejaba parcialmente
cubierto:

- autenticación server-to-server con fallo cerrado en producción;
- CORS sin wildcard y con métodos/headers acotados;
- allowlist de host + validación de todas las IPs resueltas;
- redirects manuales y revalidados;
- una sola descarga protegida para OpenCV y EXIF;
- límites de content type, bytes, píxeles, timeout, puertos y redirects;
- fuentes mock/local deshabilitadas en producción;
- configuración de entorno documentada para API y Vision Service.

## Regresiones agregadas

- health público y endpoints de análisis privados;
- producción sin key falla cerrado;
- key incorrecta/correcta;
- CORS allowlist y wildcard ignorado;
- hostname exacto frente a tokens `localhost` en filenames;
- resoluciones DNS mixtas y rangos link-local IPv4/IPv6;
- redirect de host externo a IP privada;
- content type y tamaño de streaming;
- descarga única reutilizada para bytes EXIF;
- mock/local bloqueado en producción;
- header `X-Vision-Api-Key` enviado por `apps/api`;
- penalización de subject/trade mismatch.

La ejecución de la suite también reveló y permitió corregir dos fallos
preexistentes del servicio: la forma de retorno de `HoughLinesP` en OpenCV 5 y
la traducción snake_case→camelCase del endpoint `safety-check`.

## Validación local

- `python -m unittest discover -s tests -v`: 49/49 pasan.
- `pnpm --filter @semse/api build`: pasa.
- `pnpm --filter @semse/api lint`: pasa.
- tests focalizados API/Vision: 11/11 pasan.
- `node scripts/spec-validate.mjs --strict`: 103 specs, 0 errores, 0 warnings.
- `git diff --check`: pasa.

## Gate operativo

Antes de verificar en vivo:

1. configurar el mismo `VISION_SERVICE_API_KEY` en API y Vision Service;
2. configurar en `VISION_ALLOWED_HOSTS` el hostname público exacto usado por
   las URLs de evidencia;
3. mantener `VISION_CORS_ALLOWED_ORIGINS` vacío salvo necesidad revisada;
4. comprobar `/health` sin key y un `/v1/evidence/analyze` con y sin key.

## Rollback

No se debe revertir a redirects automáticos ni a la segunda descarga de EXIF.
Ante desalineación del secreto se prefiere indisponibilidad explícita a
reapertura anónima.
