# SEMSE Demo QA Pass

Pasada rápida previa a presentación. Objetivo: detectar fallos visibles en menos de 5 minutos.

## 1. Boot QA

- [ ] Ejecutar `bash ./scripts/start-demo.sh`
- [ ] Confirmar mensaje `demo:ready`
- [ ] Abrir la web
- [ ] Confirmar que la home carga sin error overlay

## 2. Home QA

- [ ] Se ve al menos un entrypoint hacia job detail
- [ ] No hay textos rotos ni placeholders absurdos
- [ ] La UI responde al click sin pantalla blanca

## 3. Job detail QA

Entrar a `Kitchen Remodel — Orlando`.

- [ ] Job detail carga
- [ ] La lista de milestones aparece
- [ ] Inputs para nuevo milestone funcionan
- [ ] Crear milestone no rompe la UI
- [ ] Estado del milestone cambia tras `Submit`
- [ ] Estado del milestone cambia tras `Approve`
- [ ] Estado del milestone cambia tras `Release`

## 4. Evidence QA

- [ ] Navegar a `Evidence`
- [ ] Registrar evidencia nueva
- [ ] El registro aparece en pantalla
- [ ] No hay error visible de fetch ni hydration

## 5. Escrow QA

- [ ] Navegar a `Escrow`
- [ ] Ingresar monto demo
- [ ] Fondear sin error
- [ ] El monto actualizado queda visible

## 6. Dispute QA

- [ ] Volver al job con excepción o crear disputa nueva
- [ ] La disputa aparece en lista
- [ ] `Resolve` funciona
- [ ] El estado cambia a `resolved`

## 7. Presentación QA

- [ ] La secuencia completa cabe en 5-8 minutos
- [ ] Existe una frase clara para cada pantalla
- [ ] No se depende de backend real ni datos externos
- [ ] Si algo falla, reiniciar devuelve a estado limpio

## Criterio de aprobación

Si todos los checks críticos pasan, la demo se considera apta para presentar.

Críticos:
- boot
- home
- job detail
- evidence
- escrow
- dispute
