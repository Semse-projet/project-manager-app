/**
 * ASR para el intake Agro (T-054) — reusa el `TranscriptionProvider` ya
 * construido para el Field Knowledge Contributor Program
 * (`docs/specs/core/knowledge-contributor-asr-openai-whisper.spec.md`), sin
 * tocar su código: mismo gate `SEMSE_ASR_PROVIDER=openai-whisper` (activación
 * explícita, no basta con `OPENAI_API_KEY`).
 *
 * Excepción de producto documentada (no un descuido): el spec de intake Agro
 * (`docs/specs/agro/agro-prometeo-intake.spec.md` §2) exige que cualquier
 * LLM/modelo agregado se enrute a Ollama local por `privacyCritical`. Hoy no
 * existe ningún proveedor de ASR local en este stack — el propio spec de
 * ASR (arriba) documenta que el servicio Ollama de producción solo corre
 * modelos de texto (qwen2.5:3b/glm4), nunca un modelo de voz, y que "local"
 * implicaría desplegar un servicio nuevo. Puesto ante esta disyuntiva, el
 * dueño del producto aprobó explícitamente en esta sesión reusar el mismo
 * proveedor hosted (OpenAI Whisper) para el audio de Agro también, en vez de
 * dejar el audio sin transcripción automática o desplegar infraestructura
 * nueva. Sigue pendiente (fuera de esta sesión, ya señalado en el spec de
 * ASR original): revisión legal/DPIA de los términos de retención de OpenAI
 * antes de activar `SEMSE_ASR_PROVIDER=openai-whisper` en producción — esa
 * activación es la misma para Contributor Program y para Agro, un solo flag.
 *
 * `TranscriptionProvider.transcribe({storageKey, mimeType})` fue diseñado
 * para leer de `StorageService` por key. La evidencia Agro (`AgroEvidenceItem
 * .fileUrl`) solo guarda la URL absoluta servible (T-053), no la key cruda,
 * y esa URL puede ser el proxy propio o —en teoría— una URL externa. En vez
 * de parsear la forma de la URL para recuperar la key (frágil), este reader
 * simplemente hace un `fetch` HTTP de la URL — funciona igual para el proxy
 * propio y para cualquier URL realmente externa sin asumir su forma.
 */
import type { TranscriptionStorageReader } from "../contributor-program/transcription-provider.js";

export class HttpUrlStorageReader implements TranscriptionStorageReader {
  async readBuffer(key: string): Promise<Buffer> {
    const response = await fetch(key);
    if (!response.ok) {
      throw new Error(`Could not fetch evidence audio (${response.status}): ${key}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}
