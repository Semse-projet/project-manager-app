---
type: "plan"
feature: "Prometeo Workspace — compositor multimodal y respuestas estructuradas"
domain: "ui"
spec: "docs/specs/ui/prometeo-multimodal-workspace.spec.md"
version: "1.0"
status: "APPROVED"
branch: "agent/prometeo-p3a"
date: "2026-07-16"
---

# Plan técnico: Prometeo Multimodal Workspace P3-A

## 1. Resumen técnico

**Spec:** [`prometeo-multimodal-workspace.spec.md`](prometeo-multimodal-workspace.spec.md)

**Estrategia:** mantener el contrato y backend actuales; aislar clasificación y
validación de adjuntos en helpers puros, usar el staging de uploads ya existente
y ampliar el panel con composición y renderers estructurados.

**Complejidad:** media.

**Riesgo principal:** representar como análisis real un archivo que solo fue
almacenado, o enviar el turno después de una carga parcial fallida.

## 2. Constitution check

- [x] Spec APPROVED antes del plan.
- [x] Evidence-first: staging no crea ni aprueba evidencia de dominio.
- [x] AuditLog: no hay transición nueva; se conservan endpoints existentes.
- [x] Privacy: no se envía binario al LLM, solo metadata y URL autenticada.
- [x] Tests antes del código definidos en T-010.
- [x] Multi-tenant: la clave de almacenamiento la crea el backend autenticado.
- [x] Payment Governance: no hay mutaciones ni liberaciones.

## 3. Stack afectado

```yaml
backend:
  changes: none
  endpoints_new: none
  prisma_changes: false
schemas:
  changes: none
frontend:
  framework: Next.js + React
  modified:
    - apps/web/components/ai/agent-chat-panel.tsx
    - apps/web/app/semse-api.ts
    - apps/web/app/api/semse/uploads/files/[...key]/route.ts
  new:
    - apps/web/components/ai/prometeo-attachments.ts
tests:
  new:
    - tests/unit/prometeo-workspace.test.ts
workers:
  changes: none
infrastructure:
  railway: no changes
  variables: []
```

## 4. Diseño de componentes

### Helpers puros

`prometeo-attachments.ts` contendrá límites, clasificación, validación del lote,
formateo de tamaño y construcción de metadata remota. No importa React ni
credenciales y puede probarse directamente con `node:test`.

### Cliente de upload

`uploadPrometeoAttachment(file, source)` en `semse-api.ts`:

1. solicita plan con el backend autenticado;
2. sube mediante el BFF existente;
3. devuelve `PrometeoAttachment` sin incluir el objeto `File`;
4. marca video/audio como `pipeline_pending` y el resto como `stored`.

El BFF reenvía autorización derivada de la sesión. Para formatos seguros que la
allowlist MIME directa del storage no reconoce, el transporte usa
`application/octet-stream` sin perder el MIME original de la metadata.

### Panel

- Estado de borradores con `File`, source, preview URL, progreso y error.
- Inputs ocultos separados para archivos y captura de cámara.
- Handlers de selección, drop y paste.
- Chips de alcance antes del composer.
- Adjuntos enviados visibles dentro del mensaje del usuario.
- Renderer para results/citations/blocks además de misión y acciones.

## 5. Flujo de envío

```text
seleccionar/pegar/drop
  -> validar lote completo
  -> mostrar drafts
  -> usuario envía
  -> marcar uploading
  -> subir todos los drafts
  -> si alguno falla: conservar borrador y no enviar chat
  -> construir PrometeoAttachment[]
  -> chatWithPrometeo
  -> limpiar texto/drafts y revocar previews al éxito
```

En modo demo se construye metadata local no durable, con `metadata.demo=true`,
sin afirmar que el archivo fue analizado o almacenado.

## 6. Cambios de base de datos, API, eventos y FSM

- Base de datos: ninguno.
- API: ningún endpoint nuevo ni contrato modificado.
- Eventos/SSE: ninguno nuevo.
- FSM: no aplica.
- ADR: no requerido; se reutiliza la arquitectura ya aprobada.

## 7. Fases de implementación

1. Escribir tests de clasificación, límites y metadata.
2. Implementar helpers puros hasta pasar tests.
3. Implementar upload client reutilizando presign + PUT.
4. Integrar drafts, drop/paste/camera y chips en el panel.
5. Integrar tarjetas de bloques/results/citations y adjuntos enviados.
6. Ejecutar tests focalizados, typecheck, lint y validación SDD.
7. Ejecutar research loop y registrar decisiones en reporte.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| BFF lee el archivo completo en memoria | Límite estricto de 25 MiB/archivo y 50 MiB/turno |
| Blob URLs retenidas | Revocarlas al eliminar, limpiar y desmontar |
| Carga parcial | No enviar el turno si cualquier upload falla |
| Video sin pipeline | Etiqueta `pipeline_pending` y mensaje explícito |
| Upload no autorizado | BFF deriva headers autorizados de la sesión y muestra 403 sin degradar permisos |
| URL de cita no confiable | Renderizar enlace solo para ruta interna o HTTP(S) |
| Doble registro de evidencia | P3-A no llama `POST /v1/evidence` |

## Checklist antes de implementar

- [x] Constitution check completo.
- [x] Sin schema o migración.
- [x] Archivos afectados identificados.
- [x] Tests antes del código incluidos.
- [x] No hay endpoint, evento ni FSM nuevo.
