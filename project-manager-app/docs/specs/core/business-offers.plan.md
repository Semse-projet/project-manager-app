# Plan — BO-05 business-offers (PROPUESTO)
- Base: main tras BO-01. Aditivo: tablas `BusinessOffer` y `BusinessEngagement`; sin tocar `Membership` salvo al activar engagement.
- Reutiliza verificación de destinatario de BO-01 y el patrón de token/aceptación idempotente.
- Servicio con guards de estado vía `updateMany`; términos en JSON versionado e inmutable.
- Todo tras `SEMSE_BUSINESS_OFFERS_ENABLED` (apagado → 404).
- Rollback: apagar flag; tablas nuevas pueden quedar sin uso.
- Implementado con supuestos conservadores (ver spec); activación real bloqueada hasta ratificar OPEN-03/04/06/14.
