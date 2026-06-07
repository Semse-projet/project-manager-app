---
name: seguimiento-pagos
description: "Gestión de pagos, escrow, liberaciones, facturas y cobros en proyectos de construcción."
version: 1.0.0
author: SEMSE OS
metadata:
  semse:
    tags: [pago, escrow, cobro, factura, payment, release, invoice, dinero]
    intents: [payment_status, budget_estimate]
    related_skills: [gestion-proyectos, resolucion-disputas]
---

# Skill: Seguimiento de Pagos y Escrow

## Cómo funciona el escrow en SEMSE

El escrow protege a ambas partes:
- **Cliente deposita** el monto acordado al inicio
- **Fondos retenidos** hasta que el cliente apruebe el hito
- **Liberación automática** 48h después de aprobación del cliente
- **En disputa**: fondos congelados hasta resolución

## Estados de pago y qué significan

| Estado | Qué significa | Acción recomendada |
|--------|-------------|-------------------|
| `escrow_funded` | Cliente depositó | Contratista puede iniciar trabajo |
| `pending_approval` | Hito submitted, esperando cliente | Cliente tiene 48h para aprobar |
| `approved` | Cliente aprobó | Pago procesándose (1-3 días) |
| `released` | Dinero enviado al contratista | Revisar cuenta bancaria |
| `disputed` | Cliente abrió disputa | Esperar resolución SEMSE |
| `refunded` | Fondos devueltos al cliente | Revisar razón de disputa |

## Calcular cuánto liberar por hito

Si el contrato total es $10,000 y la estructura de pagos es:
- 30% inicio: $3,000
- 30% fase media: $3,000
- 30% acabados: $3,000
- 10% cierre: $1,000

Cuando se aprueba "fase media", se libera $3,000 del escrow.

## Señales de problema financiero en proyecto

🚩 Contratista pide adelanto del siguiente hito sin completar el actual  
🚩 Cliente no deposita en escrow antes de inicio pactado  
🚩 Escrow insuficiente para el alcance del trabajo  
🚩 Subcontratistas o proveedores llamando directamente al cliente por pago  

## Tipos de problemas de cobro y cómo resolverlos

### "El cliente no paga el balance final"
1. Enviar mensaje formal con balance y fecha límite (3 días)
2. Documentar todo el trabajo completado (fotos, fechas)
3. Si no responde: demand letter formal
4. Si persiste: small claims court (gratis hasta $10K en la mayoría de estados)

### "El contratista no terminó y ya cobró"
1. Documentar qué falta vs. lo acordado en contrato
2. Retener el pago proporcional al trabajo faltante
3. Abrir disputa en SEMSE con evidencia
4. Dar 5 días hábiles para terminar o acordar reducción

### "Hay trabajo extra no acordado"
- Cualquier trabajo fuera del contrato original = Change Order
- Change Order debe firmarse ANTES de hacer el trabajo extra
- Si ya se hizo sin Change Order: negociar de buena fe, documentar todo

## Método de pago preferidos por contratistas EE.UU.

1. **Zelle/Venmo**: rápido, sin cargos, común para < $5,000
2. **Check**: trazabilidad, para > $2,000
3. **ACH transfer**: proyectos grandes
4. **Tarjeta de crédito**: evitar — agrega 2.5-3% al costo

## Registros que siempre mantener

- Contrato firmado (ambas partes)
- Cada pago: fecha, monto, método, quién pagó
- Fotos antes/durante/después de cada fase
- Comunicación por escrito (WhatsApp o email) de cualquier acuerdo verbal
