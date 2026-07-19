# `.semse-sdd/forge`

Kit operativo para convertir una solicitud aprobada en un run trazable.

## Carpetas recomendadas

```text
forge/
  templates/
  creator/
  runs/
    <run-id>/
      intake.json
      spec-ref.json
      task-graph.json
      approvals.json
      verification.json
      audit.jsonl
      release.json
```

Los artefactos de runtime no deben incluir secretos ni PII innecesaria.
