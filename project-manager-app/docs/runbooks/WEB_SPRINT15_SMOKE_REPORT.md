# Sprint 1.5 Smoke Report

Fecha: 2026-03-16

## Alcance ejecutado

- visión y programa sintetizados contra el repo canónico
- intento real de `npm run smoke:web:sprint15`
- validación de `npm run build:web`
- validación de `npm run build:api`
- validación de `npm run test:unit`

## Resultado actual de T001

- `smoke:web:sprint15`: bloqueado por entorno
- `build:web`: pass
- `build:api`: pass
- `test:unit`: pass

## Hallazgo principal

El harness de smoke falla en este sandbox antes de tocar el flujo visible porque no puede abrir el stub HTTP local:

- error observado: `listen EPERM: operation not permitted 127.0.0.1:4301`

Esto bloquea:

- dashboard real contra stub
- navegación browser del circuito visible
- create milestone
- evidence
- escrow
- release
- dispute create/resolve

## Fix aplicado en este bloque

Se endurecieron:

- `scripts/web-sprint15-smoke.mjs`
- `scripts/demo-web-runtime.mjs`

Ahora reportan explícitamente que el bloqueo es de puertos locales/entorno cuando aparece `EPERM`, en lugar de parecer una caída opaca del producto.

## Priorización de hallazgos

### P0

- correr `npm run smoke:web:sprint15` fuera del sandbox actual para obtener el pass/fail funcional real del circuito visible

### P1

- si el smoke externo encuentra fallos de UX o runtime, convertirlos en fixes de `Job detail`, `release feedback` y `disputes visible flow`

## Siguiente paso recomendado

1. repetir el smoke visible en un entorno con loopback habilitado
2. si pasa, avanzar con `S1.5-T002`
3. si falla, usar ese resultado como backlog real de fixes P0/P1
