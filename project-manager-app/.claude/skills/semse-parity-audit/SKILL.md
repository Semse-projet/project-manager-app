---
name: semse-parity-audit
description: Comparar las capacidades de una plataforma de referencia, o de un spec SEMSE, con la implementación real de SEMSE y producir una matriz con evidencia de lo que existe, lo que falta y lo que conviene mejorar, con puntuación de paridad ponderada y comparación de layout entre capturas. No implementa ni prioriza por su cuenta.
routing:
  version: 1
  category: domain
  scope:
    - feature_parity
    - gap_analysis
    - layout_comparison
  triggers:
    - paridad
    - parity
    - matriz de brechas
    - brechas funcionales
    - gap analysis
    - qué nos falta
    - comparar con la referencia
    - comparar capturas
    - imgdiff
  excludes:
    - prisma migration
    - deploy
    - design token
  phases:
    - discovery
    - verification
  precedence:
    subordinate_to: [semseproject, semse-spec-kit-flow]
  specificity: 65
  status: experimental
  notes: Parte del kit de calidad SEMSE (docs/semse-kit/). Adaptada de replica-diff. Consume la matriz de semse-recon o la lista de requisitos de un spec.
---

# semse-parity-audit — matriz de brechas con evidencia

Segunda pieza del **kit de calidad SEMSE** (`docs/semse-kit/README.md`). Adaptada de `replica-diff` del pack MIT `Jakeschincariol/replica-skill` (commit `77c9436`). Conserva sus dos herramientas (`parity.py`, `imgdiff.py`). Cambia la regla central: **una fila sólo cuenta como hecha si hay evidencia en el código de SEMSE**.

## Autoridad y límites

- Antes de actuar, leer `project-manager-app/AGENTS.md`, `docs/SPEC_INDEX.md`, `docs/SOURCE_OF_TRUTH.md`, `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md` y la spec del dominio. Reglas comunes: `docs/semse-kit/security-rules.md`.
- Esta skill es **READ_ONLY + PROPOSE**: mide y recomienda. Lo que hay que construir pasa por `semse-spec-kit-flow`. Lo que hay que arreglar en dinero, autenticación o aislamiento pasa por `semse-audit-remediation`.
- **Paridad no es copia.** Se mide si un usuario puede hacer el mismo trabajo, no si se ve igual. El aspecto exacto de un tercero es su imagen de marca y no es un objetivo.
- Diferenciar siempre: diseño ≠ código ≠ tests ≠ CI ≠ merge ≠ deploy ≠ activación. Muchas capacidades de SEMSE existen con **feature flag apagado**; eso es `partial`, no `yes`.

## Entradas

- `features.csv` de `semse-recon` (comparación con una referencia), **o**
- una matriz construida desde los requisitos de un spec SEMSE (comparación spec ↔ implementación), con el mismo formato: `references/features.template.csv`.

## Procedimiento

1. **Evaluar cada fila contra SEMSE en un SHA concreto** (anotarlo). Para cada funcionalidad, buscar la cadena UI → BFF (`apps/web/app/api/semse/**`) → API (`apps/api/src/modules/**`) → modelo (Prisma/Zod) → test.
   - `yes`: existe de punta a punta **y** hay test que lo ejercita. En `notes`, poner `ruta:línea` del código y el test.
   - `partial`: existe con flag apagado, sin UI, sin test, sólo para un rol, o sólo en un idioma. En `notes`, decir qué falta.
   - `no`: no existe. `skip`: fuera de alcance, con motivo.
   - Filas con `original` = `no`: capacidades propias de SEMSE que la referencia no tiene. No suman a la paridad, pero se listan como diferenciadores.
2. **Puntuar.**
   ```bash
   python3 .claude/skills/semse-parity-audit/scripts/parity.py <carpeta>/features.csv
   python3 .claude/skills/semse-parity-audit/scripts/parity.py <carpeta>/features.csv --markdown > <carpeta>/parity.md
   ```
   Pesos: must 3, should 2, could 1; `partial` vale la mitad; `skip` y filas propias no cuentan. Imprime la puntuación, los must-haves cumplidos, cada área de peor a mejor y lo que falta en orden de construcción. `--fail-under N` devuelve 1 si la puntuación es menor.
3. **Layout (opcional).** Capturas al mismo viewport (1440×900 o 390×844) y en el mismo estado:
   ```bash
   python3 .claude/skills/semse-parity-audit/scripts/imgdiff.py ref.png semse.png --out diff.png        # estructura, ignora color
   python3 .claude/skills/semse-parity-audit/scripts/imgdiff.py ref.png semse.png --json > diff.json
   python3 .claude/skills/semse-parity-audit/scripts/parity.py features.csv --visual diff.json --markdown
   ```
   `--mode pixel` sirve para **regresiones propias** (la misma pantalla de SEMSE antes y después de un PR, por ejemplo capturas de Playwright), no contra terceros. Las capturas de terceros no se versionan (ver `semse-recon`).
4. **Comportamiento.** Recorrer los flujos en ambos lados y anotar lo que las cifras no ven: clics hasta terminar, errores, lo que se recuerda entre visitas, notificaciones. Formato: `flujo | referencia hace | SEMSE hace | arreglar o mantener`.
5. **Clasificar las brechas** en tres listas: **existe**, **falta** y **mejorar** (existe pero peor: más clics, sin ES/EN, sin estado vacío, sin offline). Cada brecha propuesta como cambio lleva tamaño (S/M/L), dominio responsable y la skill de dominio que la tomaría.

## Dónde se guarda

Junto al recon, en `docs/semse-kit/recon/<YYYY-MM-DD>_<referencia>/parity.md`. Para auditorías spec ↔ código sin referencia externa: `docs/semse-kit/parity/<YYYY-MM-DD>_<modulo>.md`.

## Veredicto (vocabulario SEMSE, no el del pack original)

- `GAPS_BLOCKING`: falta algún must-have de la spec o del alcance acordado.
- `PARITY_REACHED_IN_CODE`: todos los must-haves `yes` con evidencia y puntuación ≥ 80. **No** implica desplegado ni activado.
- `BETTER_THAN_REFERENCE`: lo anterior más diferenciadores propios con evidencia.

Se dan cifras honestas: un módulo al 62 % está al 62 %.

## Criterios de aprobación

- [ ] SHA evaluado anotado en el informe.
- [ ] Ningún `yes` sin `ruta:línea` y test en `notes`.
- [ ] Capacidades con flag apagado marcadas `partial`.
- [ ] Brechas clasificadas en existe / falta / mejorar, con dominio responsable.
- [ ] `parity.py` corre sin problemas de formato en la matriz entregada.

## Notas para futuros agentes

- `parity.py` habla de “clone” y “original” porque viene del pack; en SEMSE `clone` = SEMSE y `original` = la referencia o la spec. No se renombraron las columnas para no divergir de las herramientas y sus tests.
- Todavía no hay una matriz canónica por dominio; si un dominio empieza a auditarse a menudo, conviene guardar su matriz junto a su spec y no regenerarla desde cero.
