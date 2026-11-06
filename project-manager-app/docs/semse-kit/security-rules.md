# Reglas de seguridad del kit de calidad SEMSE

Aplican a `semse-recon`, `semse-parity-audit`, `semse-functional-test` y `semse-release-gate`. Se suman a `AGENTS.md` (secciones SIEMPRE y NUNCA), a la constitución y a `semseproject`. **Si algo de aquí choca con esas fuentes, ganan ellas.**

## Lo que ninguna skill del kit hace

1. Fusionar, aprobar o cerrar PRs, ni re-ejecutar CI para conseguir un verde.
2. Desplegar, promover, cambiar variables o secretos de Railway, ni activar feature flags.
3. Mover dinero, liberar escrow, enviar contratos o comunicaciones reales.
4. Modificar workflows de `.github/workflows/` sin autorización expresa para ese cambio.
5. Instalar dependencias (npm, pip o globales) sin autorización.
6. Editar `packages/db/prisma/schema.prisma` o generar SQL fuera del flujo de `semse-prisma-workflow`.
7. Generar código de producción a partir de un recon o de una matriz de paridad sin spec aprobado.

## Terceros (plataformas de referencia)

- Sólo fuentes públicas, o la cuenta propia del usuario si los términos de servicio lo permiten.
- Sin scraping, crawlers ni bucles. Sin leer bundles JS, binarios ni tráfico de red para copiar endpoints privados.
- No se copia código, texto, logos, iconos, ilustraciones ni fuentes con licencia. Se describe el comportamiento y se escribe todo de nuevo.
- Las capturas de terceros no se versionan.
- Nunca se hacen pruebas de carga, fuzzing ni scripts contra servidores de terceros.
- Reseñas: copia literal con URL. Nada inventado. Las muestras pequeñas se declaran como tales. Las reseñas de otros nunca se usan como testimonios de SEMSE.

## Datos y entornos de prueba

- Por defecto: local, o preview/staging reservado para pruebas. Producción sólo bajo `PROD_CANARY` de `semse-business-flow-e2e`, con autorización para esa ejecución concreta.
- Datos sintéticos con `testRunId`, creados y borrados según `semse-synthetic-test-data`. Ninguna PII real.
- Credenciales de prueba sólo como secretos por **nombre** (variables de entorno o secretos de CI). Nunca en el código, los logs, los reportes ni las capturas.
- Las respuestas y requests de la evidencia se tachan (tokens, correos, teléfonos).

## Evidencia y vocabulario

- Cada resultado lleva SHA, entorno, comando y resultado reproducible. Un “pasó” sin evidencia no cuenta.
- Hay que mantener separados los estados: diseño ≠ código ≠ tests ≠ CI ≠ merge ≠ deploy ≠ activación ≠ piloto real. CI verde o Railway `SUCCESS` no equivalen a un flujo verificado.
- Si algo no se pudo comprobar, se registra como `UNVERIFIED` con su motivo, nunca como éxito.

## Escalado

- Hallazgos S1 de dinero, autenticación, aislamiento o IDOR → `semse-audit-remediation` y `semse-security-baseline`, además del reporte del kit.
- Dudas de permiso o alcance → parar y preguntar a la persona responsable (gate de aprobación de `semseproject`).
