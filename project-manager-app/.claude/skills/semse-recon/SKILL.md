---
name: semse-recon
description: Analizar funcionalidades de una plataforma de referencia o de un módulo SEMSE existente y convertirlas en mapa de pantallas, flujos, modelo inferido, matriz de funcionalidades y quejas reales de usuarios con cita enlazada, como insumo de un spec SDD. Sólo fuentes públicas o cuentas propias autorizadas; nunca genera código ni copia código, textos o assets de terceros.
routing:
  version: 1
  category: domain
  scope:
    - competitive_research
    - functional_reconnaissance
    - user_review_research
  triggers:
    - plataforma de referencia
    - analizar funcionalidades
    - benchmark de producto
    - benchmark funcional
    - competidor
    - competidores
    - recon
    - ingeniería inversa
    - reverse engineer
    - qué hacen otros
    - reseñas de usuarios
    - user reviews
  excludes:
    - prisma migration
    - deploy
    - design token
  phases:
    - discovery
    - spec
  precedence:
    subordinate_to: [semseproject, semse-spec-kit-flow]
  specificity: 65
  status: experimental
  notes: Parte del kit de calidad SEMSE (docs/semse-kit/). Adaptada de replica-skill (replica-recon + replica-entrepreneur). Su salida alimenta semse-parity-audit y un spec; nunca implementación directa.
---

# semse-recon — reconocimiento funcional con reglas SEMSE

Primera pieza del **kit de calidad SEMSE** (`docs/semse-kit/README.md`). Adaptada de `replica-recon` y `replica-entrepreneur` del pack MIT `Jakeschincariol/replica-skill` (commit `77c9436`). Se conservaron el método y la herramienta `reviews.py`. Se eliminó todo lo que llevaba a construir o lanzar una copia.

## Autoridad y límites

- Antes de actuar, leer `project-manager-app/AGENTS.md`, la constitución, `docs/SPEC_INDEX.md`, `docs/SOURCE_OF_TRUTH.md` y la spec del dominio afectado. Reglas comunes del kit: `docs/semse-kit/security-rules.md`.
- `semseproject` y `semse-spec-kit-flow` gobiernan aprobaciones y secuencia SDD. Esta skill es **READ_ONLY + PROPOSE**: produce investigación, no código, migraciones ni cambios de producción.
- **Clean room.** Se estudia qué hace la plataforma y cómo se mueve el usuario. Nunca se guardan ni se leen bundles JS, binarios decompilados ni llamadas de red para copiar endpoints. Nunca se copian textos, logos, iconos, ilustraciones ni fuentes con licencia.
- **Fuentes.** Páginas públicas, documentación pública de ayuda y API, fichas de tiendas, vídeos públicos y la cuenta propia del usuario si los términos de servicio lo permiten. Si los términos prohíben usar la cuenta para construir un producto competidor, se dice y se trabaja sólo con fuentes públicas.
- **Leer, no raspar.** Nada de crawlers, descargas masivas ni bucles contra sitios de terceros. Las APIs/feeds oficiales (RSS de reseñas de Apple, API de Algolia de Hacker News) sólo dentro de sus términos.
- **Nunca inventar.** Ni reseñas, ni citas, ni conteos, ni fuentes. Una cifra sin URL no existe. Las muestras pequeñas se marcan como tales.
- **Privacidad.** No se recogen datos personales de reseñadores más allá del texto público y su URL. No se usan datos de clientes de SEMSE como “reseñas”.

## Cuándo usarla

- Antes de especificar una mejora de un módulo (BuildOps, Labor Engine, Marketplace, ProTools…) inspirada en cómo lo resuelve otra plataforma.
- Para inventariar un módulo SEMSE propio cuya superficie real no está documentada (mismas fases, con el código como fuente).
- Para reunir evidencia de quejas de usuarios de una categoría antes de priorizar.

No usarla para implementar (→ `semse-spec-kit-flow` y la skill de dominio), para comparar contra SEMSE (→ `semse-parity-audit`) ni para probar (→ `semse-functional-test`).

## Procedimiento

1. **Alcance.** Plataforma(s), plataforma técnica (web, iOS, Android) y **un recorte**: el flujo central por el que pagan sus usuarios. Proponer el alcance y obtener un sí.
2. **Fuentes.** Tabla con URL en cada fila, ordenada por valor: centro de ayuda → precios → changelog → ficha de tienda → vídeos públicos → web de marketing → cuenta propia → docs públicas de API.
3. **Inventario de pantallas.** `ID | pantalla | cómo se llega | propósito | componentes | estados vistos` con IDs estables `S01…`. Registrar estados: vacío, carga, lleno, error, sin permiso, móvil.
4. **Flujos.** `F-REF-01…`, cada uno con objetivo, pantallas por las que pasa, clics del camino feliz y casos límite. **Mapear cada flujo a los journeys SEMSE F01–F36** (ver `semse-business-flow-e2e`) cuando exista equivalente; si no existe, decirlo.
5. **Modelo inferido.** Entidades, campos y relaciones con su evidencia y confianza. Compararlo con `packages/db/prisma/schema.prisma` y `packages/schemas/src/`: qué ya existe, qué no. **No proponer modelos Prisma aquí**; eso es trabajo del spec y de `semse-prisma-workflow`.
6. **Matriz de funcionalidades.** Copiar `semse-parity-audit/references/features.template.csv` (columnas `feature, area, priority, original, clone, notes`). `clone` es el estado **en SEMSE** y empieza en `no` hasta que `semse-parity-audit` lo evalúe con evidencia.
7. **Lo que no se adopta.** Filas `skip` con motivo: red de terceros, contenido con licencia, alianzas, hardware, licencias reguladas.
8. **Voz de los usuarios (opcional).** Leer reseñas como persona (App Store, Google Play, G2, Capterra, Trustpilot, Reddit, HN, el tablero público de peticiones y el changelog). Mínimo 100 filas de 3+ fuentes si se pretende sacar tendencias. Cada fila en `reviews.csv` tiene `source,url,date,rating,text` con el texto copiado literalmente. Después:
   ```bash
   python3 .claude/skills/semse-recon/scripts/reviews.py <carpeta>/reviews.csv --out <carpeta>/feedback.md
   ```
   `reviews.py` descarta filas sin URL, pondera ratings bajos y recientes, y marca como *thin* los temas con menos de 3 reseñas o una sola fuente. Las categorías están en `scripts/themes.json`; si se adaptan a otro sector, copiar el archivo junto a los datos en lugar de editar el del repo.
9. **Tamaño y entrega.** Contar pantallas, flujos y entidades, señalar las partes difíciles (realtime, offline, pagos, integraciones) y entregar a `semse-parity-audit` y, si procede, a un spec nuevo vía `semse-spec-kit-flow`.

## Dónde se guarda

`docs/semse-kit/recon/<YYYY-MM-DD>_<referencia>/` con `recon.md`, `features.csv`, `reviews.csv` y `feedback.md`. **Las capturas de terceros no se versionan.** Se quedan en la máquina de quien investiga y en el repo sólo se cita su descripción.

## Criterios de aprobación

- [ ] Cada afirmación sobre la referencia tiene URL o se marca como inferencia.
- [ ] Cada flujo está mapeado a F01–F36 o marcado como sin equivalente.
- [ ] El modelo inferido distingue “ya existe en Prisma/Zod” de “no existe”.
- [ ] La matriz pasa `parity.py` sin problemas de formato.
- [ ] Ninguna cita de reseña sin enlace; tamaño de muestra declarado.
- [ ] No se versionó código, texto, asset ni captura de un tercero.

## Ejemplo — BuildOps

Para mejorar BuildOps se mira cómo una plataforma de gestión de obra organiza tareas, estimaciones, fotos de avance y aprobaciones. El recon produce, por ejemplo, `F-REF-03 Subcontratista sube foto de avance → supervisor aprueba hito`, mapeado a los journeys de hitos de BuildOps (`tests/e2e-semse/buildops-milestones.spec.ts`), y una matriz donde “aprobación de hito con evidencia fotográfica” es `must`. `semse-parity-audit` decide después si SEMSE ya lo hace.

## Notas para futuros agentes

- Esta skill no se ha ejecutado aún contra una plataforma real. La primera ejecución debe revisar si las columnas de la matriz bastan para SEMSE (por ejemplo, si hace falta una columna `flowId`; `parity.py` ignora columnas extra).
- `themes.json` viene orientado a apps SaaS genéricas (precio, soporte, bugs, UX…). Para obra/servicios de campo probablemente falten temas como “offline en obra” o “control de horas”.
