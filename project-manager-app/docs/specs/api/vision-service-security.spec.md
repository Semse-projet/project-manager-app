---
id: "api.vision-service-security"
title: "Vision Service — autenticación, CORS y carga segura"
domain: "evidence"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
date: "2026-07-23"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/vision-service/app/main.py
  - apps/vision-service/app/routes/evidence.py
  - apps/vision-service/app/services/image_loader.py
  - apps/api/src/modules/vision/vision.service.ts
related_tests:
  - apps/vision-service/tests/test_analyzers.py
  - apps/api/test/vision.service.test.ts
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-07-23"
---

# Spec: Vision Service — seguridad de perímetro y carga de imágenes

## 1. Alcance

Cubre `0.10`, `0.11` y la frontera de seguridad relacionada con `0.26`.
Complementa `api-evidence-upload-review`; no redefine el scoring de evidencia.

## 2. Invariantes

- `/health` puede ser público; todo endpoint de análisis exige una credencial
  server-to-server.
- En Railway/producción, ausencia de `VISION_SERVICE_API_KEY` falla cerrado.
- La API de SEMSE envía la credencial; el navegador nunca la recibe.
- CORS no combina wildcard con credenciales y usa una allowlist explícita.
- La URL se valida por hostname parseado y por IP resuelta, no por substring.
- Se bloquean loopback, link-local, RFC1918, metadata endpoints y redirects que
  terminen en una red prohibida.
- `mock://`, `localhost` y equivalentes solo se permiten en tests/dev.
- Tamaño, content type, timeout y número de redirects tienen límites.

## 3. Escenario P1 — SSRF

```text
DADO una URL cuyo texto contiene "localhost" pero cuyo hostname es externo
CUANDO Vision intenta cargarla
ENTONCES no usa el atajo local
  Y valida DNS/IP/redirecciones antes de descargar

DADO una URL que resuelve a una IP privada o metadata
CUANDO se solicita analizarla
ENTONCES responde error seguro
  Y no realiza la conexión
```

## 4. Escenario P1 — autenticación

```text
DADO un request sin X-Vision-Api-Key válido en producción
CUANDO llama un endpoint de evidencia
ENTONCES recibe 401/403
  Y no ejecuta analizadores
```

## 5. Tests requeridos

- Health público y análisis privado.
- Producción sin key falla cerrado.
- Hostname exacto; no substring.
- IPv4/IPv6 privadas, link-local y metadata bloqueadas.
- Redirect externo→privado bloqueado.
- CORS sin wildcard+credentials.
- Content type/tamaño/timeout limitados.

## 6. Operación y rollback

La key debe existir con el mismo valor en API y Vision Service. Un rollback no
puede reabrir el servicio públicamente; ante desalineación de secretos se
prefiere indisponibilidad explícita.
