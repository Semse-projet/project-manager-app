---
type: checklist
feature: "chat-evidence"
domain: "prometeo"
spec: "docs/specs/prometeo/chat-evidence.spec.md"
version: "1.0"
status: "PENDING"
date: "2026-10-07"
---

# Checklist: Evidencias en el chat de Prometeo

## Seguridad y datos
- [ ] El modelo recibe solo texto derivado y validado; **nunca** imágenes, bytes, URLs ni URLs firmadas
- [ ] Todo texto persistido de evidencias/análisis/metadatos es dato no confiable: allowlist de campos, longitudes acotadas, sin URLs, caracteres de control eliminados, bloque delimitado con cierre escapado
- [ ] `fileUrl`, `bucketKey`, `rawResult` y `canAutoApprove` no llegan al modelo ni al cliente
- [ ] `tenantId/orgId/userId/roles` solo del contexto autenticado
- [ ] Alcance: la misma fuente que el contexto operativo; otro tenant/inexistente ⇒ 404, otra organización ⇒ 403; el listado que falla ⇒ vacío
- [ ] El chat no cambia nunca `validationStatus` ni aprueba/rechaza una evidencia
- [ ] El análisis solo se lanza con un clic; tope de 20 por usuario y día; la auditoría se escribe antes y, si falla, no se analiza
- [ ] Toda valoración del modelo lleva "opinión asistida, no es una aprobación"
- [ ] Auditoría con `correlationId` y sin el texto del mensaje ni contenido de evidencias
- [ ] Sin migración ni cambio de esquema

## Calidad
- [ ] Tests antes del código en cada ola
- [ ] Cargas de inyección hostiles cubiertas (instrucciones, etiqueta de cierre, URLs, control, textos enormes)
- [ ] Aislamiento con dos tenants y dos organizaciones
- [ ] Idempotencia del análisis (doble clic)
- [ ] Modo `off` idéntico al comportamiento actual; `shadow` no cambia la respuesta

## Entrega
- [ ] `spec:validate:strict` verde
- [ ] CI PASS
- [ ] Merge SHA registrado
- [ ] Deployment terminal
- [ ] **D6** verificado en producción (aislamiento por tenant y organización; excepción de `OPS_ADMIN`) antes de `live`
- [ ] `shadow` sin divergencias materiales
- [ ] Canary autenticado con evidencias reales
- [ ] Evidencia sin secretos
- [ ] Spec a VERIFIED solo después de todos los gates
