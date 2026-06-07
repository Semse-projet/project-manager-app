# Phase 01 MVP

## 1. Alcance

Esta fase solo busca probar el flujo canonico comercial.

No busca lanzar Prometeo.
No busca lanzar una red abierta masiva.
No busca resolver todos los casos legales complejos.

## 2. Vertical Recomendado

Empezar con trabajos:

- visualmente auditables;
- de ticket medio controlado;
- con hitos simples;
- con baja complejidad regulatoria relativa.

Ejemplos:

- paint;
- drywall ligero;
- trim;
- punch list;
- maintenance turns.

## 3. Flujo Objetivo

1. cliente crea job;
2. job se publica;
3. profesional reserva;
4. profesional acepta;
5. ambas partes firman contrato;
6. cliente fondea escrow;
7. profesional ejecuta milestone;
8. sube evidencia;
9. cliente aprueba o rechaza;
10. si aprueba, se libera pago;
11. cierre y rating;
12. si falla, entra dispute.

## 4. Definition of Done

La fase esta completa cuando:

- el flujo anterior funciona de punta a punta;
- las transiciones quedan auditadas;
- el dinero y el avance no se mezclan en estados ambiguos;
- existe evidencia por milestone;
- las disputas pueden abrirse;
- el sistema soporta un caso real o demo completa.

## 5. Modulos Minimos

- auth
- users
- organizations
- jobs
- reservations
- contracts
- milestones
- evidence
- escrow
- payments
- disputes
- ratings
- audit

## 6. Riesgos a Vigilar

- auth incompleta;
- estado de reserva mal definido;
- acoplamiento entre UI y proveedor de datos;
- falta de auditabilidad;
- evidencia sin estructura;
- pagos sin ledger claro.

## 7. Regla de Implementacion

Toda decision de esta fase debe favorecer:

- claridad de dominio;
- trazabilidad;
- simplicidad operativa;
- compatibilidad con las siguientes fases.

Ownership minimo requerido en esta fase:

- `CLIENT` ve y opera recursos de su organizacion
- `PRO` ve recursos asignados a su organizacion
- `OPS_ADMIN` puede operar dentro del tenant

No se acepta acceso sensible solo por `tenantId`.
