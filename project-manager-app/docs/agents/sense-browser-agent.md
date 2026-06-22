# Sense Browser Agent

El **Sense Browser Agent** (también parte de la capa **Sense Web Intelligence**) otorga a SEMSEproject la capacidad de explorar visual y técnicamente sitios web y aplicaciones web a través de un navegador automatizado controlado por IA.

Esta capacidad permite al sistema auditar interfaces públicas y privadas de manera segura, recolectar evidencias técnicas, identificar incidentes en tiempo de ejecución, resumir hallazgos con IA y generar recomendaciones accionables o reportes de errores.

---

## Arquitectura del Agente

El agente opera en una estructura de 4 capas:

```
Sense Web UI (Admin Browser Agent Panel)
  ↓
SEMSE API (BrowserAgentController & BrowserAgentService)
  ↓
SEMSE Worker (BullMQ specialized worker runner + Playwright Chromium)
  ↓
AI Layer (AiModelGatewayService / OpenAI / Anthropic)
```

1. **Browser Runtime**: Controla la instancia de Chromium a través de Playwright en un entorno `headless` aislado (sandbox) dentro del worker.
2. **Extraction Layer**: Extrae títulos, URLs finales (resolviendo redirecciones), registros de consola (errores), peticiones de red fallidas, muestra de texto DOM y capturas de pantalla (screenshots).
3. **Interpretation Layer**: Analiza el resultado técnico de la extracción con un modelo de IA (por ejemplo, Claude o GPT) para producir resúmenes amigables para el usuario (español) y técnicos (inglés), clasificar severidades y proponer acciones de reparación.
4. **Memory / Evidence Gateway**: Almacena el reporte completo y la captura de pantalla dentro del Gateway de Evidencias de SEMSE, asociando los hallazgos directamente a hitos de proyectos.

---

## API Endpoints

### 1. Iniciar Inspección
* **Ruta**: `POST /v1/browser-agent/inspect`
* **Permiso requerido**: `agents:run:create`
* **Cuerpo**:
```json
{
  "url": "https://example.com",
  "projectId": "proj_123",
  "milestoneId": "mil_456",
  "includeScreenshot": true,
  "includeText": true,
  "includeAiSummary": true
}
```
* **Respuesta**:
```json
{
  "requestId": "rid_...",
  "data": {
    "runId": "run_789",
    "status": "queued",
    "correlationId": "browser-inspect-..."
  }
}
```

### 2. Obtener Resultados
* **Ruta**: `GET /v1/browser-agent/inspect/:runId`
* **Permiso requerido**: `agents:run:create`
* **Respuesta**:
```json
{
  "requestId": "rid_...",
  "data": {
    "runId": "run_789",
    "status": "completed",
    "url": "https://example.com",
    "success": true,
    "finalUrl": "https://example.com/",
    "title": "Example Domain",
    "pageStatus": "healthy",
    "severity": "low",
    "loadTimeMs": 240,
    "consoleErrors": [],
    "networkFailures": [],
    "visibleTextSample": "Example Domain...",
    "screenshotBase64": "iVBORw0KGgoAAAANSU...",
    "aiSummary": {
      "summary_es": "La página carga correctamente y no se detectaron fallos.",
      "summary_en": "Successful inspection, zero console errors, zero network failures.",
      "severity": "low",
      "recommendations": ["No required actions."],
      "github_issue_body": "...",
      "claude_fix_prompt": "..."
    },
    "createdAt": "2026-06-11T13:40:00.000Z",
    "completedAt": "2026-06-11T13:40:05.000Z"
  }
}
```

---

## Seguridad y Aislamiento

Para prevenir vulnerabilidades del lado del servidor (SSRF) y ataques a redes internas, el servicio valida rigurosamente cada URL mediante un analizador de red:
* **Protocolos permitidos**: Únicamente `http:` y `https:`.
* **Bloqueos estrictos**: 
  * Loopback local: `localhost`, `127.0.0.1`, `::1`.
  * Redes privadas (Clases A, B y C): `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
  * Direcciones link-local y metadatos: `169.254.169.254`, `fe80::/10`.
  * Esquemas locales: `file://`, `ftp://`.
* **Tiempo límite (Timeout)**: 30 segundos por carga de página para evitar bloqueos del worker.
* **Control de salida**: El agente corre en modo de solo lectura; no ejecuta comandos arbitrarios del navegador ni interactúa de manera destructiva sin aprobación humana explícita.
