# Reservations and Contracts Policy

## Objetivo

Fijar `reservations + contracts` como flujo canonico preferido para la
formalizacion del trabajo antes de ejecucion.

Fuente canonica:

- [`/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md`](/home/yoni/labsemse/vision/VISION_FUSIONADA_SEMSE_PROMETEO.md)

## Regla de Dominio

El flujo preferido es:

1. `Job` en `POSTED`
2. reserva activa por profesional
3. aceptacion de reserva
4. contrato actual del job
5. firmas
6. ejecucion

`bids` puede seguir existiendo como compatibilidad o alternativa de mercado,
pero no debe ser tratado como unica puerta de entrada conceptual al trabajo.
Si un `Job` ya tiene reserva activa/aceptada o contrato actual, `bids` no debe
seguir avanzando ese mismo flujo.

## Reservations

### Lectura

Puede leer:

- `OPS_ADMIN`
- org cliente dueña del job
- org profesional involucrada en la reserva

### Creacion

Puede crear:

- `PRO`
- `OPS_ADMIN`

No puede crear:

- la org cliente dueña del job

### Aceptacion

Puede aceptar:

- org cliente dueña
- `OPS_ADMIN`

### Release

Puede liberar:

- org cliente dueña
- org profesional involucrada
- `OPS_ADMIN`

### Expire

Puede expirar forzadamente:

- `OPS_ADMIN`

## Contracts

### Creacion

Puede crear:

- org cliente dueña
- `OPS_ADMIN`

Solo si existe una reserva aceptada para el job.

### Lectura

Puede leer:

- org cliente dueña
- org profesional de la reserva aceptada
- `OPS_ADMIN`

### Firma

Puede firmar:

- cliente correspondiente
- profesional correspondiente
- `OPS_ADMIN` solo como override operativo actual

Reglas:

- la primera firma canoniza `documentHash` y `pdfUrl`
- firmas posteriores no deben mutar el documento
- `OPS_ADMIN` debe declarar explicitamente a que lado representa al firmar

## Estados

Lenguaje preferido:

- `POSTED`
- `RESERVED`
- `ACCEPTED`

Estados historicos como `PUBLISHED` deben leerse como compatibilidad temporal.
