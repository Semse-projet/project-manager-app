# Trade Knowledge Library v2 — Reporte Técnico

**Fecha:** 2026-05-19  
**Estado:** ✅ Completado  
**Frente:** Trade Knowledge Library v2 — Expansion Pack

---

## Resumen ejecutivo

Se expandió la Trade Knowledge Library de 7 documentos (v1) a 12 documentos (v2), agregando los trades de mayor valor operacional: bathroom, kitchen, windows_doors, siding, y demolition.

El sistema opera en modo **hybrid retrieval** con embeddings reales de OpenAI. Todos los smoke tests pasaron. Zero zero-vectors.

---

## Documentos agregados (v2)

| Archivo | Trade | Chunks | Chars |
|---|---|---|---|
| bathroom-remodel.md | bathroom | 8 | 9,421 |
| kitchen-remodel.md | kitchen | 10 | 11,060 |
| windows-doors.md | windows_doors | 8 | 9,401 |
| siding-exterior.md | siding | 9 | 10,320 |
| demolition.md | demolition | 10 | 11,998 |
| **Total nuevos** | — | **45** | **52,200** |

---

## Estado acumulado de la Trade Knowledge Library

| Trade | Documento | Chunks |
|---|---|---|
| electrical | electrical.md | 7 |
| plumbing | plumbing.md | 7 |
| drywall | drywall.md | 8 |
| painting | painting.md | 9 |
| hvac | hvac.md | 9 |
| carpentry | carpentry.md | 9 |
| general | general-safety.md | 7 |
| **bathroom** | **bathroom-remodel.md** | **8** |
| **kitchen** | **kitchen-remodel.md** | **10** |
| **windows_doors** | **windows-doors.md** | **8** |
| **siding** | **siding-exterior.md** | **9** |
| **demolition** | **demolition.md** | **10** |
| **TOTAL** | **12 documentos** | **101** |

*Nota: Con duplicados por re-ingesta, la base tiene 24 documentos y 168 chunks totales — todos con embeddings reales.*

---

## Sistema de embeddings

| Parámetro | Valor |
|---|---|
| Provider | OpenAI |
| Modelo | text-embedding-3-small |
| Dimensiones | 1536 |
| Avg latency | 79ms por batch |
| Total chunks | 168 |
| Chunks con embeddings | 168 |
| Zero-vectors | **0** |
| Retrieval mode | **hybrid** |
| Fórmula hybrid | 0.70 × semantic + 0.30 × FTS |

---

## Smoke tests — 5/5 ✅

| Query | Documento devuelto | Score | Mode | Semantic |
|---|---|---|---|---|
| "What evidence is needed before closing bathroom walls?" | Bathroom Remodel | 0.542 | hybrid | 0.590 |
| "What should be checked before installing kitchen cabinets?" | Kitchen Remodel | 0.542 | hybrid | 0.590 |
| "How should a window be flashed to prevent leaks?" | Windows & Doors | **0.589** | hybrid | **0.628** |
| "What causes siding water intrusion?" | Siding & Exterior Envelope | 0.550 | hybrid | 0.529 |
| "What should be documented during demolition?" | Demolition | 0.559 | hybrid | 0.627 |

Todos los resultados apuntan al documento correcto. El retrieval semántico es preciso.

---

## Validación de queries v1 (sin regresiones)

| Query | Doc | Score |
|---|---|---|
| "Closing wall with electrical installation?" | Electrical Guide | 0.572 |
| "P-trap install + drain slope?" | Plumbing Guide | 0.622 |
| "Drywall type in garage wall?" | Drywall Guide | 0.624 |
| "HVAC refrigerant charging?" | HVAC Guide | 0.573 |

No hay regresiones en v1.

---

## Contenido por documento

### bathroom-remodel.md
- Trade dependencies y secuencia correcta (10 pasos)
- Demolition safety (shutoffs, asbestos, hidden conditions)
- Common hidden conditions con trigger de change order
- Plumbing rough-in (toilet flange, shower, vanity)
- Electrical rough-in (GFCI, dedicated circuits, exhaust fan)
- Framing y blocking (grab bars, niches, towel bars)
- Waterproofing (cement board, membranas, flood test)
- Inspection checkpoints (rough-in, pre-tile, final)
- Evidence required for approval
- Change order triggers con rangos de costo

### kitchen-remodel.md
- Trade dependencies y secuencia (14 pasos)
- Demolition and protection
- Hidden conditions (subfloor, mold, structural)
- Plumbing rough-in (sink, dishwasher, disposal, ice maker)
- Electrical rough-in (NEC requirements, dedicated circuits, heights)
- Range hood / makeup air requirements
- Cabinet installation sequence
- Countertop readiness checklist
- Flooring transitions
- Inspection checkpoints + evidence
- Change order triggers con rangos

### windows-doors.md
- Measuring rough openings (existing replacement, new construction)
- Door rough openings + ADA requirements
- Flashing sequence completo ("I" method): pan → jamb → head → drip cap
- WRB integration
- Unit installation shimming
- Insulation around frames (low-expansion foam)
- Egress requirements (IRC R310)
- Interior trim (casing, stool, apron)
- Water intrusion failure modes table

### siding-exterior.md
- Water management principle
- Wall preparation + sheathing repair
- WRB types (standard, drainage mat, felt, fluid-applied)
- WRB installation
- Flashing integration: windows, step flashing, kickout flashing, penetrations, grade
- Starter strip and corners (vinyl, fiber cement, wood)
- Fastening rules por material
- Moisture management (weep screeds, rainscreen gap)
- Common failures and dispute prevention table

### demolition.md
- Pre-demo safety: utility shutoffs, hazardous materials assessment, PPE
- Site protection: dust containment, air filtration
- Structural vs non-structural distinction (load-bearing identification)
- Shoring requirements
- Selective demo procedures (drywall, tile, flooring, cabinets, concrete)
- Debris handling + hazardous waste disposal
- Photo documentation protocol
- Change order triggers (8 items con cost ranges)
- Safety checklist (daily)

---

## Validaciones ejecutadas

- [x] `API build OK` — sin cambios en código TypeScript
- [x] `TypeScript 0 errores` — no se modificó código fuente
- [x] `Railway deploy OK` — API en SUCCESS, embeddings latency 79ms
- [x] `retrievalMode: hybrid` — confirmado post-ingesta
- [x] `zero-vectors: 0` — 168/168 chunks con embeddings reales
- [x] `smoke semántico 5/5` — todos los documentos nuevos consultables
- [x] `v1 sin regresiones` — 4 queries v1 probadas y correctas
- [x] `repo limpio` — no hay secretos en archivos

---

## Limitaciones actuales

1. **Trade filter por chunk no implementado**: el filtro `trade` en búsqueda usa `metadataJson` del chunk, pero actualmente la metadata de trade está en el documento, no en cada chunk. Las queries sin filtro de trade funcionan correctamente; el filtro por trade solo funciona si los chunks heredan el trade del documento (futuro trabajo).

2. **Duplicados por re-ingesta**: el script re-ingesta todos los documentos en cada ejecución. Para producción continua, agregar deduplicación por `sourceRef` o título.

3. **Chunks pueden no capturar todas las tables**: las tablas Markdown de los documentos a veces se parten en chunks de texto plano, perdiendo la estructura de la tabla. Esto es aceptable para RAG pero podría mejorarse con un chunker consciente de Markdown.

4. **Scores en rango 0.54–0.63**: para queries cortas y muy genéricas. Queries más específicas (con terminología técnica del dominio) producen scores más altos.

---

## Siguiente frente recomendado

**Prometeo RAG Phase 5 — Human Feedback Memory Loop**

- Contractors confirman o corrigen chunks citados en respuestas.
- Feedback alimenta un score de confianza por chunk.
- Chunks con feedback positivo reciben boost en el scoring hybrid.
- System Observer mide impacto del RAG en decisiones de agentes.

Esto requiere:
1. `FeedbackEntry` model en DB (chunkId, userId, type: confirm/correct, note, score).
2. Endpoint `POST /v1/prometeo/chunks/:id/feedback`.
3. Integración del feedback score en PrometeoService.search() como tercer componente del scoring.
4. Dashboard de feedback en Mission Control.
