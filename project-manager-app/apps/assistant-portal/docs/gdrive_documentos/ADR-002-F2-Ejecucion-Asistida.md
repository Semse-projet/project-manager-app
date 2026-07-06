# ADR-002 — F2 Ejecución Asistida
## Contexto
Durante la ejecución se requieren comunicación confiable, evidencia y control de cambios.

## Decisión
Canal SSE/WS unificado, locks Redis + idempotencia, colas BullMQ para PDF/recordatorios, cambios versionados.

## Estado
Propuesto

## Consecuencias
Mejora fiabilidad; añade complejidad operativa (monitorización de colas y canal).
