# Domain Glossary

## Objetivo

Congelar el lenguaje del sistema para evitar ambiguedad entre marketplace, operacion, pagos y governance futura.

## Terminos Canonicos

### Job

Unidad comercial principal.

Representa:

- un trabajo publicado por un cliente;
- con alcance, categoria, ubicacion, presupuesto y condiciones;
- disponible para reserva o aceptacion segun el flujo.

No significa:

- proyecto interno generico;
- tarea aislada;
- contrato ya ejecutado.

Nota de implementacion:

Mientras el repo siga usando `Project` para parte de la ejecucion, esa entidad debe
leerse como derivada o secundaria respecto de `Job`.
La vision canonica no cambia por la herencia tecnica actual.

## Job Reservation

Bloqueo temporal de un `Job` por parte de un profesional.

Sirve para:

- evitar sniping;
- dar una ventana de analisis;
- controlar concurrencia.

## Contract

Acuerdo formal entre cliente y profesional para un `Job`.

Incluye:

- terminos;
- precio;
- hitos;
- firmas;
- clausulas;
- referencia documental.

## Milestone

Unidad verificable de avance y pago dentro de un `Job`.

Tiene:

- orden;
- monto;
- evidencia;
- revision;
- estado.

## Milestone Evidence

Prueba estructurada del avance de un `Milestone`.

Puede incluir:

- fotos;
- video;
- documentos;
- checklist;
- notas;
- metadata de captura;
- hashes y referencias de storage.

## Milestone Review

Revision formal del entregable de un `Milestone`.

Acciones:

- aprobar;
- rechazar;
- pedir cambios;
- abrir disputa.

## Escrow Account

Contenedor logico del dinero retenido para un `Job`.

No es un pago individual.
Es la vista de saldo y estado financiero retenido.

## Escrow Transaction

Movimiento financiero dentro del `Escrow Account`.

Tipos tipicos:

- fund;
- release;
- holdback;
- fee;
- refund.

Nota de transicion:

Si el schema o la API actual usan `deposit`, debe mapearse a la semantica de
fondeo del escrow hasta completar la convergencia de nombres.

## Payment

Evento de proveedor o movimiento monetario externo/interno que debe reconciliarse.

## Dispute

Excepcion formal sobre calidad, dinero, alcance, incumplimiento o aprobacion.

Debe tener:

- actor que abre;
- motivo;
- evidencia asociada;
- estado;
- resolucion.

## Rating

Valoracion final entre participantes al cierre de un `Job`.

No es la unica senal de confianza.

## Trust Signal

Senal calculada o recolectada del comportamiento real.

Ejemplos:

- first-pass approval;
- dispute rate;
- completion rate;
- evidence completeness;
- response time.

## Timeline Event

Evento de negocio visible para usuarios o para ops.

Ejemplos:

- job publicado;
- job reservado;
- contrato firmado;
- hito enviado;
- pago liberado.

## Audit Log

Registro append-only de accion, actor, entidad, cambio y contexto.

Es la fuente oficial de auditoria.

## Agent

Unidad automatizada o asistida que ejecuta una funcion concreta.

Tipos:

- user-facing;
- operational;
- trust/risk;
- governance futura.

## Governance

Capa futura para politicas, propuestas, votacion, treasury e identidad soberana.

No pertenece al MVP comercial, pero el dominio actual no debe bloquearla.

## Mapeo Practico

Relaciones correctas:

- `Job` -> oportunidad comercial y flujo principal.
- `Contract` -> formalizacion del `Job`.
- `Milestone` -> entregable y pago parcial.
- `EscrowAccount` -> fondos retenidos para el `Job`.
- `Dispute` -> excepcion sobre entrega, dinero o cumplimiento.
- `AuditLog` -> evidencia institucional de acciones.
- `TrustSignal` -> reputacion basada en comportamiento.

## Regla de Nomenclatura

Dentro del producto objetivo:

- evitar usar `Project` como entidad principal de negocio;
- preferir `Job` como canon del marketplace;
- usar `WorkOrder` solo si mas adelante se necesita separar oportunidad comercial de orden ejecutiva;
- no mezclar estados de negocio con estados financieros.
