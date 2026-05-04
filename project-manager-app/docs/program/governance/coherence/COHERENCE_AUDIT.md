# Coherence Audit

## Objetivo

Registrar la auditoria de coherencia entre:

- [vision](/home/yoni/labsemse/vision)
- [program](/home/yoni/labsemse/program)
- [docs/foundation](/home/yoni/labsemse/project-manager-app/docs/foundation)

## Contradicciones detectadas

### 1. Ownership poco explicitado en `program`

Problema:

- la vision ya exige ownership real
- `program` no hacia suficientemente visible que el MVP requiere ownership por organizacion y no solo por tenant

Correccion:

- se actualizo `program/ARCHITECTURE_TARGET.md`
- se actualizo `program/PHASE_01_MVP.md`
- se actualizo `program/README.md`

### 2. `Organization` y `Membership` aparecian como posteriores en arquitectura

Problema:

- la seguridad actual del dominio necesita ownership por organizacion
- por lo tanto esas entidades son parte del MVP tecnico, no solo fase posterior

Correccion:

- se movieron a entidades MVP en `ARCHITECTURE_TARGET.md`
- se reflejo en `DOMAIN_MODEL_MVP.md`

### 3. `DOMAIN_MODEL_MVP.md` estaba demasiado centrado en usuario individual

Problema:

- el ownership real hoy se resuelve mejor por organizacion

Correccion:

- se actualizaron `Job`, `JobReservation`, `Contract`, `ProfessionalProfile`, `ClientProfile`
- se agregaron `Organization` y `Membership`
- se documento ownership por organizacion

## Huecos detectados

### 1. `Project` sigue existiendo como agregado tecnico heredado

Estado:

- documentado como transicion
- aun no resuelto del todo en implementacion

### 2. Auth real sigue pendiente

Estado:

- la vision y foundation ya dejan claro que headers son bootstrap tecnico
- sigue siendo una deuda estructural abierta

### 3. `docs/vision` y `vision` requieren sincronizacion continua

Estado:

- la precedencia ya esta fijada
- el riesgo queda controlado con `VISION_CHANGE_PROTOCOL.md`

## Decision resultante

La vision no cambia.

Lo que cambia es la traduccion operativa y tecnica:

- `program` debe hacer visible ownership del MVP
- `foundation` debe asumir ownership por organizacion
- auth real sigue fuera del MVP inicial, pero no se debe confundir bootstrap con seguridad

## Proximo paso recomendado

Usar esta auditoria para revisar:

- `packages/schemas`
- `schema.prisma`
- modulo `jobs`
- modulo `reservations`
- modulo `contracts`

contra el dominio MVP alineado.
