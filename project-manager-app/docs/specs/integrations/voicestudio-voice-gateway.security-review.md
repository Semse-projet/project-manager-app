# Auditoría estática — riesgo SSRF en Agro ASR y límites del Voice Gateway

**Fecha:** 2026-10-13. **Tipo:** revisión de código / no prueba de explotación. **Estado:** acción correctiva pendiente. **Ámbito:** main de SEMSE y contrato de VoiceStudio; no se modificó backend ni Railway.

## Ruta de datos verificada

1. `POST /v1/agro/farms/:farmId/evidence` acepta `fileUrl: z.string().url().optional()` (AgroEvidenceController). La política autoriza crear evidencia en la finca, pero la validación del parámetro no define destinos permitidos ni exige que apunte a un archivo de SEMSE.
2. `AgroEvidenceService.recordEvidence` persiste `input.fileUrl` sin comprobar que corresponda a un objeto del storage propio; `updateEvidence` permite reemplazar `fileUrl` con el mismo tipo de URL.
3. `AgroIntakeService.propose` valida acceso al farm y recupera evidenceIds del mismo farm. Si no hay texto, `resolveText` lee las filas `AUDIO` con `fileUrl` y llama `resolveTranscriptionProvider(new HttpUrlStorageReader())`.
4. `HttpUrlStorageReader.readBuffer(key)` ejecuta `fetch(key)` sobre la URL almacenada, sigue la respuesta y devuelve `Buffer.from(await response.arrayBuffer())`; no se observa allowlist, denylist de IP, control de redirects ni límite de bytes en este método.
5. Con `SEMSE_ASR_PROVIDER=openai-whisper`, el proveedor abre el buffer y lo envía a la API externa de transcripción. Sin flag ASR, el flujo se detiene antes de `fetch` por proveedor no configurado.

**Diagnóstico:** existe un origen controlable de URL y un fetch desde el servidor condicionado a que el actor esté autorizado a crear/referenciar evidencia y a que un proveedor ASR esté activo. Es un **riesgo SSRF verificable por análisis estático**, no una explotación de red confirmada. No tenemos evidencias de que el flag esté habilitado en Railway ni de acceso real a destinos internos. Aun si el transcriptor no devuelve texto inteligible, el servidor podría haber leído bytes de un destino no deseado y reenviarlos a un tercero cuando el proveedor cloud esté activo.

## Requisitos correctivos

- Preferencia 1: abandonar URLs como entrada de los readers y almacenar `storageKey`/referencia firmada interna, ligada a `tenantId`/`farmId` y permisos del propietario; leer el objeto por `StorageService` tras autorización.
- Compatibilidad legacy: si hay `fileUrl` histórica, resolver únicamente orígenes internos permitidos y llaves reconocidas mediante una migración/puente auditado. No tratar cualquier URL válida como media propia.
- Si existe un caso de negocio legítimo de medios externos: ingestión explícita por pipeline separado y restringido, DNS/IP/puerto/esquema, bloqueos loopback/link-local/private/metadata y redirecciones, límites de tamaño y duración, aislamiento de red y prueba de resolución/rebinding.
- Aplicar comprobación a **cada salto** de redirección, y mantener límites de bytes y de tiempo en todos los readers/descargas.
- No filtrar detalles de conectividad interna, cabeceras, tokens ni fragmentos de contenido a usuarios o logs; pruebas de side effects con upstream falso.
- La corrección de base debe seguir spec independiente de seguridad y pruebas previas a código; no reutilizar este PR documental para un hotfix no aprobado.

## Escenarios mínimos de test

| Caso | Resultado esperado |
| --- | --- |
| Usuario con permiso crea evidencia AUDIO apuntando a storage externo no aprobado | Rechazo al crear o al consumir, cero peticiones salientes |
| Actualización de `fileUrl` a host no aprobado | Rechazo |
| URL localhost/127.0.0.1, IPv6 ::1, RFC1918, link-local o metadata | Rechazo sin seguir conexión |
| URL allowlisted redirige a host o IP privada | Rechazo antes de segundo salto |
| DNS cambia entre comprobación y conexión | Conexión no permitida por control de resolución y red |
| HTTP 200 con stream infinito, content-length incorrecto o volumen grande | Límite y cancelación |
| Evidencia de otra finca/tenant y actor no autorizado | Denegación antes de cualquier fetch |
| `SEMSE_ASR_PROVIDER` deshabilitado | Ninguna descarga o llamada externa |
| Archivo autorizado, MIME/bytes válidos, proveedor operativo | Transcripción producida con trazabilidad y revisión humana |
| Upstream devuelve 401/429/500 o timeout | Error explícito, sin texto fabricado ni reintento inseguro |

## Archivos consultados

- `apps/api/src/modules/agro/agro-evidence.controller.ts`
- `apps/api/src/modules/agro/agro-evidence.service.ts`
- `apps/api/src/modules/agro/agro-intake.service.ts`
- `apps/api/src/modules/agro/agro-asr.ts`
- `apps/api/src/modules/contributor-program/transcription-provider.ts`

**Conclusión:** no activar `voicestudio` como proveedor de Agro ni activar un nuevo flujo de medios mientras exista entrada por URL sin contención efectiva. La verificación en runtime y la autorización de remediación corresponden a un trabajo independiente.
