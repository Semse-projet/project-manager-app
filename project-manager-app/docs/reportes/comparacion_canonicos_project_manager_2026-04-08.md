# Comparación de canónicos `project-manager-app` vs `project-manager-copi`

Fecha: 2026-04-08
Base: `/home/yoni/labsemse`

## Objetivo

Determinar cuál de los dos repositorios con apariencia de canónico es el correcto:

- `project-manager-app/`
- `app semse/_satellites-archive/project-manager-copi/`

## Resultado

El canónico correcto es:

- `/home/yoni/labsemse/project-manager-app`

`project-manager-copi` no es canónico. Es una copia histórica congelada.

## Evidencia usada

### 1. Regla oficial de canonicidad

En:

- `/home/yoni/labsemse/repository-rules/CANONICITY.md`

la decisión oficial dice explícitamente:

- el tronco canónico definitivo de `SEMSEproject` es `project-manager-app`

No aparece `project-manager-copi` como fuente de verdad.

### 2. Estado operacional del ecosistema

En:

- `/home/yoni/labsemse/_governance/status/ECOSYSTEM_STATUS.md`

el único repositorio clasificado como `CANONICAL:ACTIVE` es `project-manager-app`.

### 3. Estado del satellite espejo

En:

- `/home/yoni/labsemse/app semse/_satellites-archive/project-manager-copi/STATUS.md`

quedó formalizado como:

- `SATELLITE:FROZEN`
- `REFERENCE_ONLY`

Eso lo descarta como canónico activo.

### 4. Señal de confusión detectada

La única razón por la que podía parecer canónico era documental:

- su `README.md` seguía usando el encabezado `CANONICAL — Tronco oficial de SEMSEproject`

Eso ya fue corregido.

## Correcciones aplicadas

Se actualizaron:

- `/home/yoni/labsemse/app semse/_satellites-archive/project-manager-copi/README.md`
- `/home/yoni/labsemse/_governance/status/ECOSYSTEM_STATUS.md`
- `/home/yoni/labsemse/README.md`

## Decisión operativa

Regla práctica desde ahora:

- todo desarrollo real va a `project-manager-app/`
- `project-manager-copi/` solo puede usarse como referencia histórica o recuperación puntual
- si ambos difieren, manda `project-manager-app/`

## Resultado

La ambigüedad quedó resuelta y la documentación principal ya no presenta dos “canónicos” en paralelo.
