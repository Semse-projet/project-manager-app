# Prometeo Multimodal Workspace P3-A — reporte de implementación

**Fecha:** 2026-07-16

**Rama:** `agent/prometeo-p3a`
**Spec:** `docs/specs/ui/prometeo-multimodal-workspace.spec.md`

## Resultado

El chat global de Prometeo deja de ser exclusivamente textual en este slice.
Ahora permite preparar imágenes, video, audio y documentos mediante selector,
cámara, drag-and-drop o portapapeles; muestra el contexto activo; envía metadata
tipada por el contrato `PrometeoRequest`; y representa misión, bloques, acciones,
resultados y citas como componentes separados.

P3-A solo almacena el archivo y entrega metadata al runtime. No crea una entidad
`Evidence`, no ejecuta mutaciones y no afirma que una imagen, audio o video fue
analizado. Video y audio quedan marcados como `pipeline_pending`.

## Cambios aplicados

- Helper puro para clasificación, allowlist, límites, tamaño visible, transporte
  compatible con el storage y metadata remota.
- Compositor con máximo de 6 archivos, 25 MiB por archivo y 50 MiB por turno.
- Preview local para imagen/video y revocación explícita de object URLs.
- Conservación del borrador y archivos ya almacenados cuando una carga o el chat
  falla, evitando reenviar una carga exitosa en el siguiente intento.
- Bloqueo de cambio de agente, limpieza y nuevos adjuntos mientras el turno está
  subiendo/procesando, evitando carreras que pierdan o mezclen borradores.
- Envío permitido sin texto cuando existen adjuntos válidos.
- Chips de agente, ruta y proyecto/alcance general.
- Tarjetas para estado/progreso de misión, acciones, resultados de tools, errores,
  bloques y citas. Las URLs de citas se limitan a rutas internas o HTTP(S).
- El proxy PUT de archivos vuelve a derivar autorización e identidad desde la
  sesión del servidor antes de llamar a la API; el navegador no aporta roles.
- Formatos seguros no incluidos en la allowlist MIME directa del storage se
  transportan como `application/octet-stream`, conservando su MIME original en
  la metadata de Prometeo.

## Invariantes preservadas

- No se añadieron endpoints, eventos, tablas, migraciones ni variables de entorno.
- La clave de almacenamiento sigue siendo tenant-scoped y generada por backend.
- El staging no registra evidencia ni cambia readiness de job/milestone.
- No se liberan pagos, no se aprueban disputas y no se ejecutan tools desde estas
  tarjetas.
- El binario no se inserta en el body del chat; solo se envía metadata tipada.

## Research loop externo

Se ejecutaron tres búsquedas independientes sobre fuentes primarias.

### OWASP — carga segura

La [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
recomienda allowlist, límites, autorización, nombres generados por la aplicación,
validación por firma y almacenamiento controlado.

**Aplicado:** allowlist de formatos operativos; bloqueo de HTML, SVG y ejecutables;
límites por archivo/lote; clave generada por backend; PUT autenticado; uso de la
validación por magic bytes ya existente para los MIME soportados directamente.

**Backlog:** antivirus/sandbox o CDR; validación por firma para audio y Office;
cuarentena antes de hacer un objeto recuperable; expiración y limpieza de uploads
huérfanos; URLs firmadas en lugar del GET público por clave opaca.

### MDN — previews locales

La documentación de [URL.revokeObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static)
y [uso de archivos en aplicaciones web](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications)
indica que cada object URL creado dinámicamente debe liberarse cuando deja de ser
necesario.

**Aplicado:** cada preview se revoca al quitar el adjunto, limpiar el compositor o
desmontar el panel. Los object URLs nunca se incluyen en `PrometeoAttachment`.

**Backlog:** virtualización de previews y generación de thumbnails para lotes o
videos mayores cuando exista multipart/video intelligence.

### W3C/WAI — estado accesible

La técnica [ARIA25](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA25) y el
criterio [Status Messages 4.1.3](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
establecen que progreso, espera y errores deben ser anunciables sin mover el foco.

**Aplicado:** error/estado del compositor en `aria-live="polite"`, nombres
accesibles para archivo/cámara/quitar y envío por teclado.

**Backlog:** progreso porcentual real por archivo cuando el upload use streaming o
multipart; prueba manual con lector de pantalla y navegación móvil.

## Decisiones descartadas para P3-A

- Añadir LangGraph, Dify o LlamaIndex: el runtime durable nativo ya existe y este
  slice solo requería cerrar la brecha de interfaz.
- Enviar `File`, base64 o blob URLs al LLM: aumenta costo y exposición sin crear
  un pipeline de análisis verificable.
- Crear `Evidence` automáticamente al adjuntar: almacenamiento no equivale a
  evidencia contextualizada o aprobada.
- Declarar análisis visual/video: P3-A no extrae frames, OCR, ASR ni timeline.
- Convertir tarjetas de acciones en botones ejecutables: corresponde al slice de
  approvals/mutaciones, no a la presentación estructurada.

## Validación

| Comando | Resultado |
|---|---|
| `pnpm build:api` | PASS — packages, Prisma y Nest compilados |
| Suite completa tras construir API | PASS — 792 pass, 0 fail, 4 skip |
| `node --experimental-strip-types --test tests/unit/prometeo-workspace.test.ts` | PASS — 8/8 |
| `pnpm typecheck:all` | PASS — API, Web y Worker |
| ESLint focal de los cuatro archivos web afectados | PASS |
| `pnpm --filter @semse/web build` | PASS — 394 páginas estáticas generadas |
| `pnpm spec:validate:strict` | PASS — 66 specs, 0 errores, 0 warnings |
| `git diff --check` | PASS |

La suite completa requiere que `apps/api/dist` exista. El script raíz
`pnpm test:unit` solo construye `packages/*`; por ello, en un worktree limpio se
ejecutó primero `pnpm build:api` y luego el runner completo de 71 archivos. Sin
esa precondición, 14 archivos fallan al importar módulos compilados inexistentes,
no por aserciones ni por el cambio P3-A.

El comando global `pnpm --filter @semse/web lint` continúa rojo por el baseline de
`main`: 22 errores y 54 warnings en pantallas no tocadas por este slice (browser
agent, change orders, intelligence, reputation, tools, field ops, Agro, entre
otras). Ningún hallazgo focal pertenece a los archivos P3-A. Se preservó el scope
en lugar de modificar deuda ajena.

El entorno local usa Node `20.11.1` aunque el workspace declara Node `>=22`; pnpm
emitió esa advertencia, pero build, typecheck, tests y validación SDD concluyeron.

## Limitaciones reales al cierre

- No existe análisis temporal de video ni transcripción de audio.
- Los adjuntos son staging; no se asocian a proyecto, hito, job o animal como
  `Evidence` durable.
- El proxy web es autenticado para PUT, pero el storage actual conserva GET público
  por clave tenant-scoped opaca para servir visión/navegadores. Sustituirlo por URL
  firmada o un fetch de servicio es un hardening pendiente.
- Los formatos transportados como octet-stream no reciben magic-byte validation
  específica; deben pasar por scanner/signature validation antes de procesamiento.
- No hay todavía progreso real de bytes, cancelación, multipart ni limpieza de
  archivos almacenados si el usuario abandona el borrador.

## Siguiente slice recomendado

P3-B debe convertir el staging en una selección/creación explícita de evidencia:
asociar el archivo a proyecto/job/hito/animal, añadir permisos y auditoría de esa
mutación, y consumir análisis visual existente sin confundir recomendación con
aprobación. Video Intelligence permanece como P4 independiente y asíncrono.
