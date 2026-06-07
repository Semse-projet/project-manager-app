---
name: contratos-obra
description: "Contratos de construcción: qué incluir, cláusulas críticas, lien waiver, change orders."
version: 1.0.0
author: SEMSE OS
metadata:
  semse:
    tags: [contrato, contract, lien, change order, clausula, legal, obra]
    intents: [legal_compliance]
    related_skills: [resolucion-disputas, evaluacion-contratistas]
---

# Skill: Contratos de Obra

## Elementos obligatorios en un contrato de construcción

Todo contrato válido debe tener:

1. **Partes**: nombre completo, dirección, contacto de ambas partes
2. **Descripción del trabajo**: específica, no "pintar la casa" sino "pintar 4 cuartos con 2 capas de Behr Ultra eggshell"
3. **Materiales**: quién los provee, qué marca/calidad
4. **Precio total**: desglosado por fases si es grande
5. **Estructura de pago**: montos y condiciones de cada pago
6. **Fechas**: inicio, hitos intermedios, terminación estimada
7. **Garantía**: período de garantía de mano de obra
8. **Change Order clause**: cómo se manejan cambios de alcance
9. **Dispute resolution**: cómo se resuelven problemas
10. **Firma de ambas partes con fecha**

## Cláusulas críticas para proteger al contratista

```
CHANGE ORDERS: Cualquier trabajo no especificado en este contrato 
requiere un Change Order escrito y firmado por ambas partes 
ANTES de realizarse. El contratista no está obligado a realizar 
trabajo adicional sin Change Order autorizado.

MATERIALES DEL CLIENTE: Si el cliente provee materiales, el 
contratista no es responsable por defectos en dichos materiales 
ni por retrasos causados por entrega tardía.

ACCESO: El cliente garantiza acceso al lugar de trabajo durante 
las horas acordadas. Retrasos por falta de acceso extienden la 
fecha de terminación proporcionalmente.
```

## Cláusulas críticas para proteger al cliente

```
LIEN WAIVER: Al recibir cada pago, el contratista entregará un 
Lien Waiver (parcial hasta terminación, final al último pago) 
liberando al propietario de cualquier mechanic's lien.

GARANTÍA: El contratista garantiza mano de obra por [X] meses 
desde terminación. Defectos cubiertos: [descripción].

SUBCONTRATISTAS: El contratista es responsable por todos los 
subcontratistas que emplee. El cliente no tiene relación 
contractual directa con subcontratistas.
```

## Mechanic's Lien (Gravamen de mecánico)

**¿Qué es?** Un gravamen legal que un contratista, subcontratista o proveedor puede poner sobre la propiedad si no se les paga.

**Cómo protegerse:**
1. Pedir **Lien Waiver** (parcial) con cada pago
2. Pedir **Final Lien Waiver** con el último pago
3. En proyectos grandes: usar **Joint Check** para pagar directamente a subcontratistas/proveedores

**Si te ponen un lien:**
- Tienes derecho a disputa (30-60 días según estado)
- Afecta la venta o refinanciamiento de la propiedad
- Contratar attorney especializado en construction law ($200-500/hr)

## Change Order template

```
CHANGE ORDER #___

Proyecto: [dirección]
Fecha: [fecha]

TRABAJO ADICIONAL:
[Descripción detallada del trabajo extra]

PRECIO ADICIONAL: $[monto]
Tiempo adicional al cronograma: [X] días

Este Change Order modifica el contrato original de [fecha] por 
el monto indicado. Las demás condiciones permanecen iguales.

Cliente: _____________ Fecha: _______
Contratista: _________ Fecha: _______
```

## Contratos para diferentes tamaños de trabajo

| Trabajo | Tipo de contrato |
|---------|-----------------|
| < $500 (handyman) | Propuesta simple por escrito (email está bien) |
| $500-$5,000 | Contrato simple de 1-2 páginas |
| $5,000-$50,000 | Contrato detallado con todos los elementos |
| > $50,000 | AIA Standard Contract o attorney-drafted |

## Errores comunes en contratos

❌ "Y todo lo necesario para completar el proyecto" (scope creep infinito)  
❌ Sin fecha de terminación (el trabajo no tiene urgencia)  
❌ Sin penalidades por incumplimiento  
❌ Pago por mano de obra sola, sin especificar materiales  
❌ Sin especificar quién obtiene los permisos  
❌ Sin cláusula de disputa  
