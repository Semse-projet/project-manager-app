---
type: checklist
feature: "conversation-intelligence-foundation"
spec: "docs/specs/prometeo/conversation-intelligence-foundation.spec.md"
version: "1.0"
date: "2026-10-02"
---

# Checklist: Conversation Intelligence Foundation

## Arquitectura
- [ ] Usa `CommunicationThread` / `Communication`; no crea otra familia de mensajes.
- [ ] `ConversationSession` se conserva solo como compatibilidad temporal.
- [ ] El rollout es expand/contract y reversible por flag.
- [ ] No introduce embeddings ni graph DB como requisito V1.

## Seguridad / gobernanza
- [ ] `tenantId` es obligatorio en toda operación.
- [ ] Prometeo hereda scope del actor; no eleva permisos.
- [ ] Cross-tenant y cross-org están cubiertos por tests negativos.
- [ ] Logs/telemetría no contienen bodies completos ni secretos.
- [ ] Flags están OFF por defecto.
- [ ] Conversation Intelligence no autoriza ni ejecuta acciones críticas.

## Provenance / Decision Intelligence readiness
- [ ] Findings siempre incluyen `SourceRef[]` no vacío.
- [ ] `SourceRef` llega hasta `Communication.id` / `CommunicationThread.id`.
- [ ] `correlationId` se propaga cuando existe y nunca se fabrica.
- [ ] IDs/timestamps desconocidos permanecen `null`.
- [ ] Fact y finding están diferenciados estructuralmente.
- [ ] Proposal/Decision/Action/Outcome no se persisten desde esta prioridad.
- [ ] Un futuro motor puede reconstruir conversación -> finding -> decisión usando provenance.

## Datos / migración
- [ ] Migración aditiva y nullable.
- [ ] Índice `(tenantId, threadId, sequence)`.
- [ ] Backfill idempotente comprobado.
- [ ] Retry dual-write no duplica.
- [ ] Rollback no borra datos canónicos.

## Retrieval
- [ ] Conteo respeta scope.
- [ ] Search devuelve threadId/messageId/snippet/provenance.
- [ ] Get reconstruye orden estable.
- [ ] Audit/compare devuelve findings estructurados y no muta estado.
- [ ] Búsqueda vacía no inventa fallback.

## Entrega
- [ ] Spec APPROVED antes de código.
- [ ] Plan/tasks/checklist coherentes.
- [ ] Tests escritos antes o junto al código.
- [ ] `spec:validate:strict` verde.
- [ ] Typecheck/build/tests relevantes verdes.
- [ ] CI PASS.
- [ ] Merge SHA registrado.
- [ ] Deployment terminal.
- [ ] Canary autenticado.
- [ ] Evidencia sin secretos.
- [ ] Solo entonces VERIFIED.
