---
type: checklist
feature: "chat-actions"
domain: "prometeo"
spec: "docs/specs/prometeo/chat-actions.spec.md"
version: "1.0"
status: "PENDING"
date: "2026-10-06"
---

# Checklist: Prometeo actúa desde el chat

## Seguridad y datos
- [ ] Ninguna acción se ejecuta sin un clic o confirmación humana explícita
- [ ] `tenantId/orgId/userId` solo del contexto autenticado
- [ ] Rutas propuestas solo del catálogo cerrado y filtradas por permiso en el servidor
- [ ] Crear trabajo solo vía `confirm-draft` (con `jobs:create`)
- [ ] Texto del usuario no elige herramienta, ruta ni parámetros
- [ ] Auditoría sin el texto del mensaje
- [ ] Sin migración ni cambio de esquema

## Calidad
- [ ] Tests escritos antes del código en cada ola
- [ ] Frases reales de la evidencia cubiertas
- [ ] Idempotencia de la confirmación (doble clic)
- [ ] Aislamiento tenant/org probado
- [ ] Modo `off` idéntico al comportamiento actual

## Entrega
- [ ] `spec:validate:strict` verde
- [ ] CI PASS
- [ ] Merge SHA registrado
- [ ] Deployment terminal
- [ ] `shadow` sin divergencias materiales
- [ ] Canary autenticado con la conversación de la evidencia
- [ ] Evidencia sin secretos
- [ ] Spec a VERIFIED solo después de todos los gates
