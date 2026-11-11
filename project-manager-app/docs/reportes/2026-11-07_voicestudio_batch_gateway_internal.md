# VoiceStudio batch ASR/TTS — evidencia de validación de adaptador interno

**Fecha:** 2026-11-07 (GitHub UTC: 2026-11-08).  
**Repo:** [SEMSEproject](https://github.com/Semse-projet/project-manager-app).  
**PR:** [#1126](https://github.com/Semse-projet/project-manager-app/pull/1126).  
**Base validada:** `main@99d06d02fb8498d2b8e4e824abde6c0b0bc561e5`.  
**Commit de código validado:** `4b13d3a58ba3048bfc812b8efac71eb54ecaf5a5`.  
**Autorización:** propietario del proyecto aprueba D1–D3 (ASR/TTS batch, servicio separado y privado, clonación/doblaje OFF); **D4 y D5 abiertos, prohibida activación comercial**.

## Código probado

- `apps/api/src/modules/contributor-program/voicestudio-batch.client.ts`: cliente ASR multipart y TTS WAV; motor y voz explícitos del servidor, redirecciones bloqueadas, rechazo de URL insegura, error sanitizado, contenido/tamaño verificados. Rechaza entornos productivos incluso ante construcción directa.
- `transcription-provider.ts`: selector `unset`, `openai-whisper`, `voicestudio` opcional. La ampliación de `TranscriptionStorageReader.createReadStream?` no altera el contrato de `readBuffer` del proveedor antiguo.
- La lectura VoiceStudio requiere stream y limita su acumulación a **15 MiB antes** de convertir a Blob/FormData; no usa `readBuffer` sin límite. Tests garantizan que archivo grande, lector sin stream y fallo de lectura resultan en cero egress.
- Pruebas HTTP con dobles controlados; **no se ejecutó inferencia de voz real, ni una prueba autenticada de usuario final**.

## Evidencia GitHub Actions

| Gate | Resultado para `4b13d3a5` |
| --- | --- |
| quality-gates | PASS |
| unit-coverage | PASS |
| e2e | PASS |
| integration | PASS |
| autonomy-staged-smoke | PASS |
| verify-operacion-asistida-api | PASS |
| isolated-hydra-postgres | PASS |
| resource-scope-inventory (informativo) | PASS |
| CodeQL JavaScript/TypeScript | PASS |
| CodeQL Python | PASS |
| conditional jobs | 3 SKIPPED (no FAIL) |

CI run: [42434718652](https://github.com/Semse-projet/project-manager-app/actions/runs/42434718652). El run certifica sólo ese SHA/base; este reporte se agregó después y el HEAD final deberá verificarse de nuevo antes de merge.

## Blockers independientes

1. **Sin aprobación humana de revisión de código**. CODEOWNERS configura por defecto al propietario `@Samuelcastella`; esta revisión técnica no sustituye la firma humana.
2. **No se autoriza transmisión por usuario/recurso**. La API y el BFF de Prometeo no tienen aún las rutas autenticadas de voz; el adaptador de bajo nivel no vincula por sí solo actor, tenant, organización, conversación y fuente de audio. La actual ruta Contributor almacena un `storageKey` opcional recibido como referencia sin receipt server-side; antes de voz real exigir registro autoritativo de origen, autorización en tiempo de lectura y pruebas cross-tenant y cross-org.
3. **D4**: no hay modelo/voz/tokens/pesos y uso comercial de outputs certificados. Alias OpenAI-compatible no acreditan licencia del motor VoiceStudio. **D5**: política de consentimiento, retención, revocación y borrado no aprobada.
4. **Agro Issue #911**: P0 fail-closed fusionado y desplegado; la custodia de audio de la fase P1 sigue abierta.
5. No se desplegó VoiceStudio ni se tocaron variables Railway; la rama no cambia producción ni permite usar voz a clientes.

## Veredicto por capa

- Adaptadores internos: **código y pruebas disponibles, CI del código PASS**.
- Revisión: **READY_FOR_HUMAN_REVIEW**, sin aprobación registrada.
- Fusión: **UNMERGED**.
- Despliegue: **NOT_DEPLOYED**.
- Activación: **INACTIVE**.
- Funcionalidad de voz de Prometeo: **NO IMPLEMENTADA**.

## Complemento: tests negativos de alcance multi-tenant (commit posterior)

El proveedor `voicestudio` aplica ahora una barrera adicional en `ContributorProgramService.processPendingExtractions` **antes de construir cualquier cliente ASR**. Exige coincidencia entre el tenant y submission de la extracción y el asset unido, además de formato `tenants/{tenantId}/knowledge_contribution/...` normalizado. Dos nuevas pruebas PostgreSQL dentro de `contributor-program-extraction.test.ts` introducen (a) un `assetId` procedente de otro tenant, y (b) una key fuera del tenant, y exigen estado FAILED, código `VOICE_ASSET_SCOPE_NOT_VERIFIED` y cero segmentos. No modifica la ruta `openai-whisper` existente.

**Límite de evidencia:** confirmar tenant/submission y prefijo no sustituye un receipt de subida ni prueba organización, actor, autorización al momento de leer, consentimiento o derechos sobre el audio. D5 permanece abierto. Los tests PostgreSQL y CI de este cambio requieren ejecución en el HEAD nuevo; no se reclaman resultados hasta observarlos.
