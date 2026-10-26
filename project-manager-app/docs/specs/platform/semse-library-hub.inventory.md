# SEMSE Library Hub — inventario preliminar de dependencias (2026-10-25)

**Alcance de la auditoría:** lectura de los archivos declarativos presentes en `main` de `Semse-projet/project-manager-app` (antes de abrir la rama documental). **No** se inspeccionó Railway en vivo, `node_modules`, las imágenes desplegadas, el SBOM transitorio completo ni el uso en ejecución. «Declarada» no significa «instalada», «en producción», «cargada», «segura» o «licenciada». Este es el **primer corte de inventario**, no una certificación del repositorio entero.

## 1. Fuentes inspeccionadas y SHA blob

| Fuente relativa a `project-manager-app/` | Git blob SHA | Hecho acreditado |
|---|---|---|
| `apps/web/package.json` | `4cee98a4e5357e1c62ff19d844fe6063d70989ae` | React, Next, Tailwind, Lucide, Three |
| `apps/api/package.json` | `0a633f6c0c277fa6eeb7a2e1ac894308f453fc91` | NestJS, BullMQ, OpenAI y Anthropic, Zod, PDFKit |
| `apps/worker/package.json` | `05cf5647ef315b6fed3ed641a1e8d1793f3238fe` | BullMQ, ioredis, Pino, Playwright |
| `apps/assistant-portal/package.json` | `722ee76e67c940427b136ef1732743f12f5d21de` | TanStack Query, Recharts, Tiptap, React Hook Form |
| `apps/vision-service/requirements.txt` | `182b537c50a7dd4678396194bbfa78ba0da7a7c1` | FastAPI, OpenCV, NumPy, Pillow |
| `packages/schemas/package.json` | `5600372f3678dd080d01ff2c002b6a143acad613` | Zod |
| `packages/tools/package.json` | `fbdbd0b6b61923f9851f1e7aa916c7af136c4e45` | Motor SEMSE interno, sin dependencias runtime directas declaradas |
| `pnpm-workspace.yaml` | `3ff5faaaf5f139c707e338e7e89e51606e9e0ace` | Workspace `apps/*`, `packages/*` |
| `pnpm-lock.yaml` | `846e7ada22825b2f00cb1568c1f871788f716978` | Lockfile v9 existente; inventario transitorio NO extraído |
| `package.json` raíz | `7f9d7728e7b683bfe09e63c5383d82b170c31829` | Scripts de validación, Playwright tests y pnpm 10.33 |

Documentos que **no** equivalen a librerías software: `ConstructionLibraryItem` / Sense Vision son vocabulario de materiales; `SEMSE Knowledge` y TENANT_CURATED son conocimiento; `prometeo-tool-registry.ts` rige herramientas/acciones; `capability-registry` rige evidencia del estado de capacidades. Deben conservar autoridades independientes.

## 2. Las 30 entradas evaluadas en la conversación

**Leyenda:** `DECLARADA` = presente como dependencia directa en manifiesto inspeccionado; `NO_DECLARADA_EN_MUESTRA` = no figura como dependencia directa en los manifiestos citados (no prueba ausencia global ni transitiva); `REFERENCIA` = aparece en ideas/docs, no prueba instalación; `PLATAFORMA` = API de navegador, no paquete a instalar.

| # | Entrada | Estado probado | Ubicación o decisión F1 |
|---|---|---|---|
| 1 | React | DECLARADA | apps/web; apps/assistant-portal |
| 2 | Next.js | DECLARADA | apps/web |
| 3 | Tailwind CSS | DECLARADA | apps/web (devDependency) |
| 4 | Lucide React | DECLARADA | apps/web; apps/assistant-portal |
| 5 | Recharts | DECLARADA | apps/assistant-portal; NO declarar como dependencia de apps/web |
| 6 | Meyda | NO_DECLARADA_EN_MUESTRA | evaluar solo para objetivo DSP probado |
| 7 | Tone.js | NO_DECLARADA_EN_MUESTRA | audio web condicional, no añadir por defecto |
| 8 | Anthropic SDK | DECLARADA | apps/api; uso API externo con facturación |
| 9 | Zod | DECLARADA | packages/schemas; apps/api; assistant-portal (distintas major) |
| 10 | BullMQ | DECLARADA | apps/api; apps/worker |
| 11 | OpenTelemetry | NO_DECLARADA_EN_MUESTRA | comprobar antes de implantar; existe otra observabilidad |
| 12 | Playwright | DECLARADA | apps/worker y @playwright/test raíz |
| 13 | Three.js | DECLARADA | apps/web |
| 14 | Librosa | REFERENCIA | aparece en documentación de assistant-portal; no en requirements inspeccionado |
| 15 | NumPy + SciPy | PARCIAL | NumPy en vision-service; SciPy no declarado allí |
| 16 | TanStack Query | DECLARADA | apps/assistant-portal, no en apps/web |
| 17 | Zustand | REFERENCIA | mencionada en planificación; no declarada en manifiestos muestra |
| 18 | React Hook Form | DECLARADA | apps/assistant-portal |
| 19 | D3.js | NO_DECLARADA_EN_MUESTRA | priorizar Recharts existente; D3 solo con necesidad |
| 20 | Yjs | NO_DECLARADA_EN_MUESTRA | evitar colaboración CRDT sin caso |
| 21 | Tiptap | DECLARADA | apps/assistant-portal; verificar plan/licencia de extensiones |
| 22 | PDF.js | NO_DECLARADA_EN_MUESTRA | API ya tiene pdf-parse y PDFKit, que son productos distintos |
| 23 | React Three Fiber | NO_DECLARADA_EN_MUESTRA | Three.js existente; revisar integración UI |
| 24 | React Three Rapier | NO_DECLARADA_EN_MUESTRA | motor física 3D bajo demanda |
| 25 | Transformers.js | NO_DECLARADA_EN_MUESTRA | alto costo/compatibilidad; sin activación |
| 26 | ONNX Runtime Web | NO_DECLARADA_EN_MUESTRA | modelo y consumo deben probarse |
| 27 | fast-check | NO_DECLARADA_EN_MUESTRA | candidata a devDependency de pruebas |
| 28 | axe-core Playwright | NO_DECLARADA_EN_MUESTRA | candidata a devDependency de accesibilidad |
| 29 | MSW | NO_DECLARADA_EN_MUESTRA | candidata a tests; mocks nunca reemplazan smoke real |
| 30 | Pino | DECLARADA | apps/worker |

**Corrección del conteo:** hay 30 entradas y 31 nombres en el listado porque NumPy y SciPy se agruparon en una entrada.

## 3. Hallazgos de seguridad y economía

1. **Duplicación evitada:** Web y assistant-portal son aplicaciones diferentes. Tener Recharts, Tiptap o TanStack Query en el segundo NO los hace importables desde el primero sin declarar explícitamente dependencia compatible. La reutilización requiere confirmar restricciones de bundling, versiones y UX.
2. **Distintas majors:** en manifiestos muestreados, Zod 3 aparece en `@semse/schemas` y API, mientras assistant-portal declara Zod 4; no unificar hasta pruebas de contratos/API.
3. **Python no es sinónimo de microservicio nuevo:** NumPy está declarado en el servicio de visión existente, pero este componente no debe asumir que la API Node puede importar NumPy ni que vision-service tiene capacidad disponible para simulaciones de otro dominio.
4. **Lockfile no es un SBOM validado:** versionado sí, pero la lista completa de dependencias transitivas, hashes, licencias y vulnerabilidades no se acreditó en esta revisión.
5. **Consumo sin servicio adicional:** ejecutar código dentro del Worker ya existente puede elevar consumo total y afectar jobs críticos; asignar límites, métricas y corte antes de activar.
6. **Catálogo no es auto-instalador:** los paquetes sólo se incorporan mediante PR, revisión, lockfile y deploy controlado. La solicitud runtime selecciona adapters preaprobados.
7. **Proveniencia e integridad:** para cada paquete se requieren origen verificable, checksum del artefacto, licencia (SPDX cuando aplique), mantenimiento y consultas de advisories. Un Scorecard favorable no sustituye revisión de código ni de licencia.

## 4. Prioridad inicial para piloto

| Categoría | Propuesta | Motivo |
|---|---|---|
| Reutilización inmediata a evaluar | Zod; BullMQ; Pino; Playwright; React/Next/Three ya declaradas | Sin nueva dependencia solo por catálogo |
| Reutilización entre apps (requiere test) | Recharts; TanStack Query; React Hook Form; Tiptap | Están declaradas en assistant-portal, pero no automáticamente en Web |
| Solo ante requisito medible | Meyda; Tone.js; PDF.js; D3; Three Fiber; fast-check; axe; MSW | Comparar bundle, performance y alternativas |
| Postergar hasta benchmark y control | Librosa, SciPy pesado, Transformers.js, ONNX Web, React Three Rapier, Yjs | Recursos y/o integración potencialmente altos |
| No ejecutar en F0 | DSP "consciousness" / "quantumCoherence" del prototipo Omega | Nombres demostrativos, **no** validación científica de consciencia o entrelazamiento |

## 5. Cómo completar la auditoría F1 (pendiente, sin declarar completado)

- Recorrer **todos** los `apps/*/package.json` y `packages/*/package.json`, y archivos de dependencia Python de cada app; inventario determinista de directas/dev/optional + lockfile.
- Identificar la versión resuelta en lockfile, integridad, dependencias transitivas, árbol y origen, con PURL y SBOM máquina-legible (CycloneDX o SPDX).
- Comprobar qué paquete se *importa*, se empaqueta realmente y se incluye en el despliegue actual. Registrar ambiente/commit; confirmar con imágenes reales antes de decir «runtime verificado».
- Obtener evidencias de licencia y vulnerabilidades desde fuentes de confianza, con alertas para CVE crítica.
- Identificar ownership por dominio, revisión trimestral, fecha de caducidad, revocación y alternativa.
- Ejecución F1 de sólo lectura, sin autoinstalar, sin cambiar lockfile, sin conexión a datos privados y sin activar feature.

**Referencias:** OWASP SCVS https://scvs.owasp.org/scvs/v1-inventory/ ; OpenSSF Scorecard https://openssf.org/projects/scorecard/ ; CISA SBOM https://www.cisa.gov/sbom .

**Conclusión auditada:** el repositorio ya contiene piezas esenciales para un Library Hub gobernado. **Aún NO existe evidencia de un catálogo central de dependencias completo y operativo**, ni de un benchmark de rentabilidad. F1 debe probarlo, no presumirlo.
