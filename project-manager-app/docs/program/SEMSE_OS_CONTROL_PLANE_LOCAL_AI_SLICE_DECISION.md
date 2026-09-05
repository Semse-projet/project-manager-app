# Decisión Product/Ops — Slice `local-ai-runtime`

**Estado:** ACCEPTED FOR LOCAL CANARY DESIGN
**Fecha:** 2026-07-19
**Task:** T-005
**Alcance:** diseño local; no autoriza Docker, instalación o ejecución

## Slice aceptado

El primer slice del Control Plane será exclusivamente la capability
`local-ai-runtime` sobre el profile Compose `local-ai` ya documentado para el
Dev Container. Administra el lifecycle del servicio Ollama local; no administra
modelos cloud ni convierte módulos empresariales en microservicios.

## Happy path verificable

```text
observe inactive
  -> plan/digest
  -> policy + aprobación humana
  -> grant local corto
  -> activate profile
  -> liveness + readiness
  -> ACTIVE
```

Readiness usa la API local de Ollama y debe probar que el servicio responde; no
se marca `ACTIVE` por el solo hecho de que el proceso o contenedor exista.

## Rollback obligatorio

Se inducirá un fallo de readiness controlado:

```text
VERIFYING -> DEGRADED -> ROLLING_BACK -> ROLLED_BACK
```

El rollback detiene únicamente el servicio/revisión allowlisted, conserva
receipts/audit/eventos y demuestra que el estado observado vuelve a coincidir
con la revisión anterior.

## Límites del canary

- host local y workspace de prueba sin datos productivos;
- `ollama/ollama:0.32.1` o digest inmutable posteriormente aprobado; nunca
  `latest`;
- imagen y modelo preaprovisionados bajo una autorización separada;
- sin descarga de modelos, inferencia con PII o prompts reales como criterio de
  cierre;
- sin Railway, `infra/railway/ollama.railway.json`, Kubernetes o registry no
  allowlisted;
- sin GPU/host privileges adicionales, Docker socket en agentes o UI de apply;
- kill switch OFF por defecto y límites de CPU/RAM del entorno local.

## Criterios Product/Ops

- plan p95 menor a 2 s sin provisionamiento externo;
- `ACTIVE` solo después de readiness;
- doble apply lógico = 0;
- fallo inducido termina en `ROLLED_BACK` o `BLOCKED` con owner;
- 100% de transitions materiales auditadas;
- Mission Control explica estado, target, digest, approvals y receipts;
- el canary produce un reporte local y no una afirmación de deploy.

## Resultado

Product/Ops acepta este slice como único objetivo F7. Docker/WSL ausentes
mantienen T-006 y F7 bloqueados. La aceptación no autoriza iniciar contenedores.

