# SEMSE Mobile Execution Roadmap

## Fase 0

- estabilizar la app dentro de `labsemse`
- corregir runtime base
- inventariar pantallas y dominios
- definir canon movil

## Fase 1

- alinear tipos locales con `@semse/schemas`
- introducir capa `src/lib/api`
- introducir `src/lib/auth`
- clasificar pantallas por dominio y madurez

## Fase 2

- integrar worker flows:
  - jobs
  - evidence
  - tasks
  - materials
  - incidents
  - tracker
  - travel

## Fase 3

- integrar client flows:
  - publish job
  - compare / match
  - project active
  - milestone approval
  - disputes
  - ratings

## Fase 4

- integrar dev portal con fuentes reales
- documentacion viva
- ops traces
- domain events
- agents visibility

## Fase 5

- activar capa agentica movil
- memoria organizacional
- semantic search
- RAG
- feedback loops
- maturity metrics

## Fase 6

- decidir convergencia estructural:
  - mantener `semse-mobile-app` como app separada
  - o migrar progresivamente a futura `apps/mobile`
