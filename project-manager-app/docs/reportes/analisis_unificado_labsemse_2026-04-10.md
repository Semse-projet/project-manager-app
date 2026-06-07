# Analisis Unificado de `labsemse`

- Fecha: 2026-04-10
- Alcance: lectura de `labsemse/` como si todo el ecosistema fuera un solo proyecto
- Objetivo: sintetizar identidad, capas, precedencia y rol de cada carpeta relevante

## Tesis Central

`labsemse` no debe leerse como muchos proyectos paralelos.

Debe leerse como un solo proyecto con capas distintas de autoridad:

1. capa soberana
2. capa operativa canónica
3. capa transicional
4. capa histórica
5. capa de evidencia

La plataforma unificada resultante es:

> **SEMSEproject es una infraestructura operativa-inteligente para coordinar servicios reales con contratos verificables, evidencia estructurada, pagos por hitos, supervisión operativa, confianza computable, agentes internos y futura gobernanza programable.**

## Identidad del Proyecto Unificado

Si todo `labsemse` fuera un solo proyecto, su definición ejecutiva sería esta:

- Es un sistema operativo de servicios reales.
- Tiene un núcleo comercial llamado `SEMSE Jobs`.
- Tiene una capa de control llamada `SEMSE Ops`.
- Tiene una capa reputacional y de riesgo llamada `SEMSE Trust`.
- Tiene una capa futura institucional llamada `Prometeo`.
- Tiene una arquitectura donde visión, programa, contratos, código y agentes tienen precedencia explícita.

## Capas del Ecosistema

### 1. Capa soberana

Define identidad, dirección, reglas y propósito.

- `constitution/`
- `vision/`
- `program/`
- `repository-rules/`
- `agents/`

### 2. Capa operativa canónica

Implementa el producto vivo y sus runtimes.

- `project-manager-app/`

### 3. Capa transicional

Preserva valor útil, pero no define el destino estructural.

- `src/`
- `supabase/`

### 4. Capa histórica o de laboratorio

Conserva prototipos, satélites y piezas rescatables bajo subordinación explícita.

- `app semse/`
- `archive/`
- `_governance/`
- `semse/`

### 5. Capa de evidencia

Registra diagnósticos, validaciones, cierres y trazabilidad de trabajo.

- `reportes/`

## Centro Canónico Real

El centro ejecutable y canónico del proyecto único es:

- `project-manager-app/`

Dentro de esa carpeta vive el sistema real:

- backend: `apps/api`
- frontend destino: `apps/web`
- workers: `apps/worker`
- contratos: `packages/schemas`
- datos: `packages/db`
- agentes: `packages/agents`

Si `labsemse` fuera una sola empresa y un solo producto:

- `constitution`, `vision`, `program`, `repository-rules` y `agents` serían la dirección soberana
- `project-manager-app` sería la fábrica viva
- `reportes` sería la memoria verificable
- `src`, `supabase`, `app semse`, `archive`, `_governance` y `semse` serían zonas subordinadas de transición, extracción o historia

## Matriz Formal

| Carpeta | Rol dentro del proyecto único | Autoridad | Estado | Riesgo principal | Acción recomendada |
|---|---|---|---|---|---|
| `constitution/` | constitución soberana del ecosistema | muy alta | canónica | quedar desalineada con el runtime real | mantenerla corta, normativa y sincronizada con avances estructurales |
| `vision/` | dirección de producto | muy alta | canónica | contradicción con copias operativas | preservar como única fuente de visión y evitar duplicados editables |
| `program/` | roadmap, secuencia y ejecución estratégica | muy alta | canónica | convertirse en biblioteca pasiva y no backlog vivo | endurecer trazabilidad entre fases, backlog y estado real |
| `repository-rules/` | precedencia, migración y disciplina del repo | muy alta | canónica | incumplimiento práctico aunque la regla exista | seguir usándola como árbitro de decisiones de estructura |
| `agents/` | base documental soberana del subsistema agentic | alta | canónica | separarse demasiado de la implementación viva | mantener puente explícito con `project-manager-app/packages/agents` |
| `project-manager-app/` | núcleo ejecutable del proyecto | máxima en código | canónica | deuda de integración entre módulos y documentación espejo | seguir concentrando toda lógica estructural nueva aquí |
| `reportes/` | evidencia, trazabilidad y memoria operativa | media | canónica como evidencia, no como arquitectura | que se usen como fuente de diseño en vez de evidencia | seguir separando evidencia, planning y prompts |
| `src/` | UX transitoria heredada | baja | transicional | seguir atrayendo lógica nueva y duplicar frontend | tratarla solo como referencia funcional y vaciarla por absorción |
| `supabase/` | infraestructura heredada del frente Vite | baja | transicional | confundir modelo de datos legado con el canónico | conservar solo como soporte histórico o migrarlo a archivo |
| `app semse/` | contenedor de satélites, restos y laboratorios | baja | archivada / mixta | fragmentación por reactivación accidental | extraer solo piezas puntuales útiles y no revivir satélites |
| `archive/` | archivo histórico formal | baja | archivada | reuso accidental como base viva | mantenerlo reference-only |
| `_governance/` | memoria de consolidación y gobierno histórico | media como trazabilidad | histórica | duplicar el rol de `program` o `reportes` | mantenerlo como registro de consolidación, no como canon |
| `semse/` | laboratorio técnico auxiliar `node/python` | baja | secundaria | ambigüedad de propósito frente al tronco canónico | documentar mejor su rol o archivarlo si no entra al plan vivo |
| `openai/` | snapshot técnico externo | ninguna sobre SEMSE | reference-only | ser tomado como dependencia conceptual soberana | mantenerlo como vendor snapshot y no como base de arquitectura |
| `dist/` | artefactos generados | ninguna | derivada | contaminación de lectura | ignorarlo como fuente |
| `node_modules/` | dependencias instaladas | ninguna | derivada | ruido y falsas lecturas del repo | ignorarlo como fuente |

## Lectura Ejecutiva de Conjunto

La lectura correcta de `labsemse` como proyecto único es:

- un sistema con soberanía documental clara
- un tronco de implementación bien identificado
- una capa agentic con identidad propia
- una transición todavía no completamente absorbida
- y una memoria histórica relativamente ordenada

No es un “caos de repos”.

Es un proyecto único con:

- gobierno,
- producto,
- ejecución,
- inteligencia,
- operación,
- evidencia,
- y residuo histórico todavía en proceso de domesticación.

## Síntesis Final

Si hubiera que nombrar a `labsemse` como un solo proyecto integral, la formulación más precisa sería:

> **`labsemse` es el repositorio maestro de SEMSE OS: un ecosistema de software para coordinar servicios reales con trazabilidad, evidencia, pagos por hitos, reputación verificable, supervisión operativa, memoria compartida y agentes internos, donde `project-manager-app` es el núcleo ejecutable y el resto de carpetas soberanas definen dirección, disciplina y continuidad.**

## Próximo Nivel Recomendado

1. crear una tabla de control permanente `carpeta -> clase -> autoridad -> regla de uso`
2. marcar explícitamente qué zonas están:
   - vivas
   - transicionales
   - congeladas
   - archivadas
3. reducir la ambigüedad de `semse/`, `src/` y cualquier espejo documental restante
