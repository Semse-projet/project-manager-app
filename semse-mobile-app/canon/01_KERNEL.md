# SEMSE Mobile Kernel

- Fecha: 2026-04-23
- Estado: activo

## Identidad

`semse-mobile-app` es la superficie movil oficial en evolucion de `SEMSEproject`.

No es un prototipo descartable.
No es un repo paralelo soberano.
No es una app aislada del sistema.

Es una expresion movil del ecosistema `SEMSE OS`.

## Proposito

Su objetivo es operar las capas moviles de:

- trabajo en campo;
- seguimiento operativo;
- captura de evidencia;
- viajes y gastos;
- pagos y disputas;
- experiencia cliente resumida;
- exploracion tecnica y operativa desde un portal dev.

## Mision

Convertir la potencia operativa de `SEMSEproject` en una interfaz movil clara, util y alineada con el backend canonico.

## Resultado esperado

La app movil debe:

- hablar el lenguaje canonico del producto;
- consumir entidades reales del backend;
- respetar auth, permisos y trazabilidad;
- convivir con la capa agentica y la memoria organizacional;
- servir como nodo de operacion y no solo como vitrina.

## Principios no negociables

1. la app movil no define el dominio; lo expresa;
2. ningun tipo local prevalece sobre `@semse/schemas`;
3. ningun endpoint movil vive fuera del mapa canonico de `apps/api`;
4. toda accion sensible debe dejar rastro auditable;
5. toda automatizacion agentica debe ser explicable;
6. toda memoria debe tener retencion y limites;
7. toda experiencia movil debe degradar con seguridad si falla IA;
8. lo movil debe priorizar tareas de campo y claridad;
9. la UX no puede inventar estados de negocio no soportados;
10. la app debe ser integrable, medible y reversible.
