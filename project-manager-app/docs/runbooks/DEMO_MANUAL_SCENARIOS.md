# SEMSE Demo Manual Scenarios

Objetivo: ejecutar una demo clara, reproducible y corta del flujo principal sin depender de backend real ni datos vivos.

## Escenario 0 — Preflight

1. Entrar al repo:
   ```bash
   cd /home/yoni/labsemse/project-manager-app
   ```
2. Arrancar la demo:
   ```bash
   bash ./scripts/start-demo.sh
   ```
3. Esperar el mensaje `Open http://127.0.0.1:3301 and run the demo checklist`.
4. Abrir `http://127.0.0.1:3301`.

---

## Escenario 1 — Executive overview

Objetivo: abrir con contexto de negocio.

Narrativa sugerida:
- SEMSE no es solo marketplace; une intake comercial, ejecución, escrow, evidencia y gestión de excepciones.
- La demo está sembrada con jobs consistentes para mostrar happy path y edge case.

Validar:
- Carga el dashboard.
- Se ve al menos un job demo operativo.
- El entrypoint permite navegar al job detail.

---

## Escenario 2 — Happy path job-first

Objetivo: demostrar el circuito principal.

Pasos:
1. Entrar a `Kitchen Remodel — Orlando`.
2. Confirmar milestones existentes.
3. Crear un nuevo milestone corto, por ejemplo:
   - title: `QA final walkthrough`
   - amount: `900`
   - sequence: `3`
4. Ejecutar el lifecycle visible:
   - `Submit`
   - `Approve`
   - `Release`

Resultado esperado:
- El milestone cambia de estado en la UI.
- Se hace visible el cierre de la parte operativa + financiera del milestone.

Narrativa sugerida:
- El flujo canónico arranca en job, no en project abstracto.
- Cada milestone puede pasar por revisión y liberar dinero de forma controlada.

---

## Escenario 3 — Evidence por milestone

Objetivo: mostrar trazabilidad.

Pasos:
1. Desde el job, ir a `Evidence`.
2. Registrar una evidencia nueva con un nombre fácil de reconocer, por ejemplo `demo-closeout.pdf`.
3. Confirmar que aparece en la lista.

Resultado esperado:
- La evidencia queda visible en el job.
- Se refuerza el concepto de paquete verificable antes de aprobación/release.

Narrativa sugerida:
- SEMSE amarra trabajo ejecutado con evidencia auditable.
- Esto baja riesgo de disputa y acelera aprobación.

---

## Escenario 4 — Escrow funding

Objetivo: mostrar control financiero mínimo.

Pasos:
1. Ir a `Escrow`.
2. Fondear un monto demo, por ejemplo `1500`.
3. Confirmar actualización visual.

Resultado esperado:
- Se actualiza el estado de escrow.
- Se mantiene coherencia con el flujo release por milestone.

Narrativa sugerida:
- El dinero no vive suelto; sigue reglas del job y del milestone.
- El release no es una acción aislada: está conectado con evidencia y revisión.

---

## Escenario 5 — Excepción: dispute

Objetivo: demostrar que SEMSE no solo sirve cuando todo sale bien.

Pasos:
1. Volver al job `Roof Repair — Miami`.
2. Mostrar que ya existe una disputa abierta en la seed.
3. Si conviene, crear otra disputa breve desde la UI.
4. Resolver una disputa.

Resultado esperado:
- La disputa cambia a `resolved`.
- El job vuelve a estado operativo normal.

Narrativa sugerida:
- El sistema contempla excepciones de forma visible y operable.
- Esto es clave para confianza, gobernanza y escalabilidad operativa.

---

## Escenario 6 — Cierre de demo

Resumen sugerido en 20-30 segundos:
- Intake comercial y ejecución unidos por job.
- Milestones con revisión.
- Evidencia trazable.
- Escrow con funding y release.
- Disputes como excepción operable.

Mensaje final:
- Esta build no intenta enseñar todo SEMSE.
- Enseña una secuencia clara, reproducible y presentable del flujo principal.
