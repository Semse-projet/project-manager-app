# ADR-023 — Control Plane declarativo para capabilities de SEMSE OS

**Estado:** ACCEPTED
**Fecha:** 2026-07-19
**Spec:** `docs/specs/platform/semse-os-control-plane.spec.md`
**Alcance de aceptación:** contrato de diseño; no autoriza implementación

## Contexto

SEMSE ya cuenta con módulos de dominio, Prometeo, Forge, agentes, Event Backbone
y múltiples targets de ejecución. Exponer Docker directamente a Prometeo
mezclaría intención, autorización y ejecución, y haría imposible sustituir el
runtime sin cambiar el producto.

## Decisión propuesta

Introducir un Control Plane que conserve estado deseado y observado por
workspace. La ejecución se delega a adapters intercambiables. Docker Compose es
el primer adapter local, Railway continúa como target cloud existente y
Kubernetes queda fuera del MVP.

```text
Prometeo / UI
  -> command
  -> tenant + ownership + policy
  -> deployment plan con digest
  -> approval
  -> runtime adapter
  -> verify
  -> observed state + event + audit
```

## Consecuencias

Positivas:

- Docker deja de filtrarse a la experiencia del usuario.
- Cada operación es idempotente, explicable y reversible.
- Mission Control puede comparar intención con realidad.
- El mismo contrato sirve para local, cloud e híbrido.

Costos:

- nuevo lifecycle, reconciler, schemas y policy surface;
- necesidad de leases, receipts y observabilidad;
- mayor disciplina en versiones y compatibilidad.

## Alternativas descartadas

- Prometeo ejecutando `docker compose` directamente: autoridad excesiva.
- Kubernetes desde el inicio: complejidad no justificada para el MVP.
- Un contenedor por módulo visual: límites técnicos incorrectos.
- Segundo runtime de agentes: duplicaría `packages/agents` y Forge.

## Resultado del gate

Architecture acepta esta separación porque reutiliza los owners canónicos y no
duplica Forge, Agent Runtime ni Event Backbone:

- API conserva autoridad transaccional y multi-tenant;
- `@semse/control-plane` será puro, compartido y sin I/O;
- el worker orquesta usando únicamente `operationId` durable;
- el executor Compose local queda fuera de Prometeo y del shell abierto de
  Developer Runtime;
- Railway y Kubernetes no pertenecen al primer slice.

El spec, el plan, el threat model y los contratos canónicos satisfacen el gate
de diseño. La aceptación no crea TaskPackets, no autoriza código, Prisma,
Docker, deploy ni producción.
