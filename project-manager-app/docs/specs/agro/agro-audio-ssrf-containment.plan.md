# Plan — Contención SSRF en ASR Agro

**Estado:** propuesta, no ejecutar. Origen: [Issue #911](https://github.com/Semse-projet/project-manager-app/issues/911). Respeta AGENTS.md y la constitución SDD 2.0.

## Secuencia de dos carriles

**Carril P0 (prioridad de seguridad, post-aprobación)**
1. Crear prueba que construye evidencia AUDIO con fileUrl arbitraria desde un usuario autorizado y un provider stub que registra llamadas. Demostrar en test aislado el flujo inseguro sin conectarse a hosts externos.
2. Hacer que resolveText NO use HttpUrlStorageReader/fetch para AUDIO. Si no existe asset verificado, responder 'AUDIO_SOURCE_NOT_VERIFIED', manteniendo la opción de enviar texto manual; no ocultar error ni caer a proveedor cloud alternativo.
3. Instrumentar tests de regresión del ASR OFF, silencio, fallos provider, evidenceIds ajenas, farm sin acceso, URL maliciosa, redirects y sobrelectura. No introducir captura de bytes no confiables.
4. Revisar todas las rutas que aceptan/actualizan fileUrl y confirmar que **ninguna** alimenta un reader HTTP sin guardas. Preservar EXTERNAL_URL sólo como enlace.

**Carril P1 (fuente verificada, posterior)**
1. Inventariar receipts/ownership ya existentes para el flujo presign→PUT (incluye BFF y UploadsController). Evaluar si prueban org/farm, no sólo tenant y key de alta entropía.
2. Diseñar el menor contrato nuevo necesario: reference/receipt de upload con tenant, org, farm, actor, key, estado de custodia y caducidad. Firmar/verificar en API, bloquear manipulación de cliente.
3. Migración aditiva si se necesita columna assetId/storageKey. AgroFarm.tenantId nullable: exigir asociación explícita o deshabilitar ASR en legacy sin tenant, con vía segura de regularización.
4. Resolver el asset y permiso antes de StorageService.stat/readBuffer. Limitar bytes, duración y MIME real. Revalidar membresía y autorización al momento de consumo.
5. En UI, aceptar key/receipt del uploader en vez de derivar trust de window.location.origin; conservar fileUrl legacy sólo para representación.
6. Backfill solo con pruebas verificables; no reconstituir llaves desde URLs arbitrarias sin validación de origen y binding.
7. Pruebas por unidad, API/Postgres, E2E con 2 tenants / 2 org mismo tenant y revocación, restauración original SHA-256.
8. Release bajo flag/canary, comparar respuestas/errores con T-053, verificar cada SHA y rollback. No activar ASR de Agro hasta cumplir gates.

**Peligros concretos**: usar URL firmada de lectura como prueba de ownership, permitir key del mismo tenant sin relación con la finca, leer por HTTP localhost a modo de “validación”, migrar silenciosamente fincas tenantless o reclasificar EXTERNAL_URL a AUDIO procesable.

**No hacer en este PR:** tocar API/Prisma, activar SEMSE_ASR_PROVIDER, publicar TTS/MCP ni modificar Railway.
