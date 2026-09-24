---
type: plan
feature: "sense-vision-field-library"
domain: "vision"
spec: "docs/specs/vision/sense-vision-field-library.spec.md"
version: "2.0"
status: "APPROVED"
branch: "claude/google-docs-link-f39dr2"
date: "2026-09-24"
---

# Plan técnico: Sense Vision — Live Camera + Construction Library + Mi Diccionario

## 1. Snapshot de verdad

- `origin/main` SHA base: `c6a367d` (rama creada desde ese HEAD, sin commits previos).
- Deploy de producción: no verificado ni tocado en esta sesión (no se despliega).
- Migraciones: toda la cadena (`prisma migrate deploy`) aplicada contra un Postgres 16
  local vacío, sin drift (`prisma migrate diff --exit-code` = 0).

## 2. Arquitectura

```
Web (cámara, 1 frame / 1.5 s, single-flight, JPEG ≤ 1024 px)
  → BFF /api/semse/vision/recognize         (sesión → identidad)
  → API POST /v1/vision/recognize           (Zod + validación de frame + throttle 60/min)
      → vision-service POST /v1/objects/recognize  (X-Vision-Api-Key)
          → proveedor multimodal (ollama | openai, opt-in)  → candidatos
      ← candidatos
  → matching contra ConstructionLibraryItem (slug / nombre / alias exactos)
  → política de confianza (0.80 / 0.50)
← objeto canónico bilingüe + alternativas
```

El modelo reconoce; la librería normaliza y enriquece. La librería se cachea
5 min en memoria del API (cambia solo por migración).

## 3. Decisiones

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Proveedor enchufable detrás de `VISION_OBJECT_PROVIDER` (sin valor = apagado) | Activarlo con la sola presencia de `OPENAI_API_KEY` | Mismo precedente que PR-11 (ASR): la key ya existe en producción por otras razones; mandar frames a un tercero debe ser un paso deliberado. |
| Vocabulario cerrado enviado por el API | Dejar que el modelo invente etiquetas libres | Reduce alucinaciones y hace el matching determinístico. |
| Matching sin fuzzy | `contains` sobre nombres | Un "coupling" genérico no puede convertirse en "EMT coupling" (hallazgo real en test: los `searchTerms` genéricos se excluyeron del matching). |
| Seed dentro de la migración (`ON CONFLICT DO NOTHING`), generado desde TS | Script de seed manual | El seed demo no corre en producción; precedente `capability_reality_registry`. Test de drift entre fuente y migración. |
| `searchText` desnormalizado | Búsqueda sobre arrays / FTS | 1 `contains` indexable, ranking en memoria; volumen pequeño. |
| Rutas bajo `v1/vision/*` | `v1/professionals/me/*` | No existe ese controller; el módulo vision es el dueño y reutiliza permisos. |
| `camera=(self)` solo en `/worker/sense-vision` + recarga única si el documento llegó por navegación cliente | Relajar `camera` para todo el sitio | Mantiene la postura de seguridad global; Permissions-Policy es por documento. |

## 4. Riesgos

- **Privacidad (proveedor `openai`)**: frames de obra salen a un tercero → requiere DPIA antes de activar. Ollama local es la opción preferida.
- **Capacidad del servicio `ollama`**: un modelo de visión (qwen2.5vl:3b) necesita más RAM que los modelos de texto actuales; validar en Railway antes de activar.
- **Latencia**: timeouts de 10 s (servicio) / 12 s (API) / 15 s (cliente); el muestreo descarta frames mientras hay uno en vuelo.
- **Calidad del reconocimiento**: no medida con un modelo real en esta sesión; `VisionCorrection` existe para medirla después.
