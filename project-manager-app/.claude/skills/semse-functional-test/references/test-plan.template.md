<!-- Adaptado de replica-skill/replica-test/test-plan.md (MIT, commit 77c9436). -->
# Plan de pruebas: {{módulo / flujo}}

SHA: {{commit}} · Fecha: {{YYYY-MM-DD}} · Entorno: {{local | preview | staging}} · testRunId: {{TEST_<runId>}} · Spec: {{docs/specs/...}}

Casos: `H` camino feliz, `E` límite, `N` negativo. `auto`: `e2e` (Playwright en `tests/e2e-semse/`), `unit`, `manual`.

| caso | flujo (F01–F36) | rol | org | idioma | tipo | pasos | esperado | auto | resultado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F07-H1 | hito BuildOps con evidencia | profesional | A | ES | feliz | crear tarea, adjuntar foto, enviar a aprobación | tarea en estado de revisión, evidencia visible, AuditLog creado | e2e | |
| F07-H2 | | cliente | A | EN | feliz | abrir el hito, aprobar | hito aprobado, textos en inglés, sin claves crudas | e2e | |
| F07-E1 | | profesional | A | ES | límite: doble clic en enviar | | una sola solicitud de aprobación (idempotencia) | e2e | |
| F07-N1 | | cliente | B | ES | negativo: otra organización | abrir la URL del hito de la org A | 403/404, sin datos de A en la respuesta | e2e | |
| F07-N2 | | profesional | A | ES | negativo: transición inválida | aprobar su propio hito | rechazado según STATE_MACHINES.md | unit | |
