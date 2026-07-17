---
id: "ui.prometeo-multimodal-workspace-p3a"
title: "Prometeo Multimodal Workspace P3-A"
type: "spec"
feature: "Prometeo Workspace — compositor multimodal y respuestas estructuradas"
domain: "ui"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "medium"
branch: "agent/prometeo-p3a"
date: "2026-07-16"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - "apps/web/components/ai/agent-chat-panel.tsx"
  - "apps/web/components/ai/prometeo-attachments.ts"
  - "apps/web/app/semse-api.ts"
  - "apps/web/app/api/semse/cortex/chat/route.ts"
  - "apps/web/app/api/semse/uploads/files/[...key]/route.ts"
  - "packages/schemas/src/prometeo-runtime.schema.ts"
related_tests:
  - "tests/unit/prometeo-workspace.test.ts"
related_endpoints:
  - "v1/ai-models/prometeo/chat"
  - "v1/evidence/presign"
  - "v1/uploads/files"
related_events: []
related_agents:
  - "prometeo-chat"
  - "felix"
last_verified: "2026-07-16"
---

# Spec: Prometeo Multimodal Workspace P3-A

## 1. Qué resuelve

Prometeo ya acepta un `PrometeoRequest` multimodal y devuelve bloques, acciones,
resultados y estado de misión, pero el chat global solo permite escribir texto y
representa una fracción de la respuesta estructurada.

**Para quién:** clientes, profesionales y operaciones autenticados.

**Problema:** el usuario no puede adjuntar contenido ni verificar visualmente el
contexto y los resultados operativos que Prometeo está usando.

**Solución:** ampliar el panel global con adjuntos preparados de forma segura,
chips de contexto y tarjetas estructuradas, reutilizando exclusivamente los
contratos y endpoints existentes.

## 2. Alcance

### Incluido

- Selección múltiple desde archivo, galería o cámara.
- Drag-and-drop y pegado de archivos desde el portapapeles.
- Imágenes, video corto, audio como archivo, PDF, texto y documentos Office.
- Previsualización local, eliminación y estado de carga por adjunto.
- Envío sin texto cuando existe al menos un adjunto válido.
- Chips visibles para agente, ruta/módulo y proyecto activo.
- Tarjetas para bloques, acciones propuestas, resultados de tools, citas y misión.
- Staging mediante `POST /v1/evidence/presign` + `PUT /v1/uploads/files/:key`.
- Metadata de video marcada honestamente como pendiente de pipeline temporal.

### Fuera de alcance

- Crear un `Evidence` o asociar automáticamente el archivo a job/milestone.
- Análisis binario de imagen, audio o video desde el chat.
- Video Intelligence, extracción de frames, OCR, ASR o timeline.
- Selección generativa de tools desde texto libre.
- Mutaciones, aprobaciones, liberaciones financieras o cambios de FSM.
- Endpoints, tablas, eventos o variables de entorno nuevos.
- Grabación de audio en tiempo real.

## 3. Actores y permisos

| Actor | Puede hacer | No puede hacer |
|---|---|---|
| `CLIENT` autenticado | Adjuntar archivos si posee `evidence:write`; consultar Prometeo con sus permisos actuales | Suplantar actor, tenant u organización |
| `WORKER` autenticado | Adjuntar archivos y contexto permitido por sus permisos | Acceder a proyectos ajenos o convertir el staging en evidencia aprobada |
| `OPS_ADMIN` autenticado | Usar el mismo workspace y contexto autorizado | Saltar gobernanza financiera desde el chat |
| Plataforma | Validar tamaño/tipo, preservar contexto autenticado y enviar metadata tipada | Confiar en roles o identidad enviados por el navegador |

La identidad, `tenantId`, `orgId`, roles y permisos se resuelven en backend. No
se incorporan al `PrometeoRequest` desde el cliente.

## 4. Escenarios y criterios de aceptación

### P1 — Adjuntar y enviar contenido

```text
DADO un usuario autenticado con acceso al chat y permiso de carga
CUANDO selecciona, arrastra, pega o captura hasta seis archivos válidos
ENTONCES ve una previsualización y el tipo/tamaño antes de enviar
  Y al enviar cada archivo se almacena mediante el flujo existente
  Y Prometeo recibe `attachments[]` con metadata tipada y URL proxy tenant-scoped
  Y el borrador solo se limpia cuando la petición completa termina correctamente.
```

Casos borde:

- Máximo 6 archivos por turno.
- Máximo 25 MiB por archivo y 50 MiB por turno para P3-A.
- Un archivo sin MIME conocido se clasifica por extensión o como `file`.
- Si una carga falla, el turno no se envía y el adjunto conserva el error.
- En modo demo se permite representar el adjunto localmente sin afirmar análisis.

### P2 — Contexto visible

```text
DADO que el usuario abrió Prometeo desde una ruta o proyecto
CUANDO compone un turno
ENTONCES ve chips de agente, módulo/ruta y proyecto activo
  Y el proyecto se envía como `selectedEntities`
  Y Prometeo muestra alcance general cuando no existe proyecto seleccionado.
```

### P3 — Respuesta estructurada

```text
DADO que el backend devuelve bloques, misión, acciones, resultados o citas
CUANDO finaliza el turno
ENTONCES la UI representa cada categoría sin depender de texto libre
  Y diferencia éxito, bloqueo, fallo y aprobación pendiente
  Y no presenta video como analizado cuando su pipeline está pendiente.
```

## 5. Contratos reutilizados

### `POST /api/semse/cortex/chat` → `POST /v1/ai-models/prometeo/chat`

- Input canónico: `PrometeoRequest`.
- Output canónico: `PrometeoResponse` legacy-compatible.
- Auth: requerida; conserva el contexto autenticado del BFF.
- `privacyCritical`: sin cambio. P3-A envía metadata, no el contenido binario al LLM.
- Errores visibles: validación, carga, red y runtime no configurado.

### Staging de adjuntos

1. `POST /api/semse/evidence/presign` con `source: project_copilot` o
   `camera_capture`.
2. `PUT /api/semse/uploads/files/:key` con el binario.
3. Construcción de `PrometeoAttachment` con `fileId`, nombre, MIME, tamaño, URL
   autenticada y estado de análisis.

El staging no registra una entidad `Evidence`; por tanto no cambia FSM, no emite
eventos de dominio y no declara readiness de hitos.

El proxy de carga deriva identidad y autorización desde la sesión del servidor.
Los formatos seguros que el storage no representa con un MIME específico se
transportan como `application/octet-stream`, conservando el MIME original solo
como metadata del adjunto.

## 6. Reglas de archivos y UX

```yaml
limits:
  max_files: 6
  max_file_bytes: 26214400
  max_turn_bytes: 52428800
accepted:
  - image/*
  - video/*
  - audio/*
  - application/pdf
  - text/plain
  - text/markdown
  - application/msword
  - application/vnd.openxmlformats-officedocument.wordprocessingml.document
behavior:
  images: local_preview
  video: local_preview_and_pipeline_pending
  audio: filename_and_metadata_only
  documents: filename_and_metadata_only
  object_urls: revoke_on_remove_or_unmount
accessibility:
  - controles con nombre accesible
  - estado de carga anunciado con aria-live
  - envío disponible por teclado
```

## 7. FSM, eventos y efectos

- FSM: no aplica; no cambia estados de dominio.
- AuditLog: no se introduce uno nuevo; los endpoints existentes conservan su
  trazabilidad y request IDs.
- Eventos: ninguno nuevo. P3-A no inventa eventos fuera de `EVENT_CATALOG.md`.
- SSE: sin cambios; la misión existente sigue usando el bus actual.
- Payment Governance: sin impacto; solo se muestran propuestas, nunca se ejecutan.

## 8. Tests requeridos

- Clasifica imagen, video, audio, documento y archivo desconocido.
- Rechaza tipo no permitido, archivo mayor a 25 MiB, más de seis archivos y
  total mayor a 50 MiB.
- Construye metadata remota sin exponer `File` ni URL `blob:`.
- Conserva `camera` y `clipboard` como fuente del attachment.
- El panel contiene controles accesibles para archivo/cámara y soporta drop/paste.
- Typecheck y lint focal de Web pasan; el baseline global se registra por separado.

## 9. Criterios de éxito

| Métrica | Objetivo |
|---|---|
| Adjuntos válidos representados antes de enviar | 100% |
| Turnos enviados con carga fallida | 0 |
| Videos presentados falsamente como analizados | 0 |
| Identidad o roles aceptados desde el body del navegador | 0 |
| Tests focalizados | 100% verdes |
| Typecheck y lint focal Web | Verdes |

## 10. Dependencias y aprobación

- Depende del contrato P0 de `docs/specs/api/prometeo.spec.md`.
- Depende del BFF `/api/semse/cortex/chat` y del flujo de upload existentes.
- No depende de LangGraph, Dify, LlamaIndex, MCP o A2A para este slice.
- Aprobado por instrucción del usuario de continuar con P3-A el 2026-07-16.

## Checklist de aprobación

- [x] Escenarios P1–P3 definidos con criterios verificables.
- [x] Contratos existentes identificados; no se crean endpoints.
- [x] FSM, auditoría, SSE y Payment Governance declarados.
- [x] Tests requeridos listados antes de implementación.
- [x] Invariantes de tenant, evidencia y pagos preservadas.
- [x] Estado `APPROVED` antes del plan; `IMPLEMENTED` tras evidencia local.
