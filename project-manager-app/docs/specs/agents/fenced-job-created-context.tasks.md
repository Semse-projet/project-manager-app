# Tasks — AgentRun #1161

| ID | Tarea | Estado de trabajo | Evidencia/gate |
|---|---|---|---|
| FJC-01 | Reproducir 403 en entorno efímero real | demostrado | Actions 43764752468 |
| FJC-02 | Contrato API ligado al claim HMAC y generación | implementado, falta revisión | agents.controller.ts |
| FJC-03 | Verificar run + evento + tenant/org originadora + Job | implementado, falta revisión | agents.repository.ts |
| FJC-04 | Lector acotado en Worker, sin token a handlers | implementado, falta revisión | job-created-context-reader.mjs |
| FJC-05 | Pruebas unitarias deny-by-default | implementado, falta CI final | tests/unit + API tests |
| FJC-06 | E2E firmado pricing/risk COMPLETED | demostrado en ejecución previa | Actions 43765877708 |
| FJC-07 | HTTP negativos de claim, rol y estado | implementado, pendiente CI final | qa-1149-disposable-agentrun-e2e.mjs |
| FJC-08 | SDD y spec index | preparado, pendiente validación | spec, plan, checklist |
| FJC-09 | Auditoría independiente fencing/tenant/org | pendiente | revisión humana |
| FJC-10 | CI completo en HEAD final | pendiente | GitHub Actions + CodeQL |
| FJC-11 | Merge/producción/canary | no ejecutar hasta autorización | gate humano |
| FJC-12 | Decisión sobre runs históricos | pendiente e independiente | issue #1147 |

Orden: FJC-01 → FJC-02/03/04 → FJC-05/06/07/08 → FJC-09/10 → FJC-11.
FJC-12 no depende de ni autoriza replay automático.
