---
name: cotizacion-construccion
description: "Crear estimados profesionales de construcción: materiales, mano de obra, overhead, formato envío."
version: 1.0.0
author: SEMSE OS
metadata:
  semse:
    tags: [cotizacion, estimado, presupuesto, quote, estimate, construction, obra]
    intents: [estimate_generation, price_suggestion, budget_estimate]
    related_skills: [precios-materiales-eeuu, comunicacion-clientes]
---

# Skill: Crear Estimados de Construcción

## Cuándo usar este skill

Cuando el usuario pida:
- "hazme un estimado para..."
- "cuánto costaría..."
- "crea un quote para..."
- "necesito un presupuesto para..."

## Estructura del estimado

Un estimado profesional SIEMPRE incluye estas secciones:

```
ESTIMADO DE TRABAJO
Cliente: [Nombre]
Fecha: [fecha]
Válido por: 14 días
---
MATERIALES
Item | Cantidad | Precio unit | Subtotal
[desglose línea por línea]
SUBTOTAL MATERIALES: $X

MANO DE OBRA
Descripción | Horas/Unidad | Tarifa | Subtotal
[desglose]
SUBTOTAL MANO DE OBRA: $X

OVERHEAD Y MISCELÁNEOS (12%): $X

TOTAL: $X
---
CONDICIONES:
- 50% depósito al inicio
- 50% al completar
- No incluye: permisos, dumpster, trabajo extra de albañilería
- Precio válido 14 días desde la fecha
```

## Factores de ajuste de precio

**Subir precio cuando:**
- Zona de alta demanda (Miami, LA, NYC: +20-40%)
- Trabajo urgente (<72h disponibilidad): +25-50%
- Acceso difícil (piso 3+, sótano sin salida): +15-25%
- Materiales los provee el contratista: usar markup 15-20%

**Bajar precio cuando:**
- Cliente recurrente o referido: -5-10%
- Trabajo en temporada baja: -5-10%
- Pago completo al inicio: -5%
- Múltiples trabajos en la misma visita: -10-15%

## Reglas de oro

1. Si no hay medidas específicas → usa medidas típicas y especifica cuáles
2. Siempre separar materiales de mano de obra (el cliente quiere ver ambos)
3. Siempre incluir lo que NO está incluido (evita malentendidos)
4. Terminar con texto listo para copiar y enviar al cliente
5. Para trabajos >$2,000: sugerir contrato escrito

## Trabajos comunes y rangos (USD, mercado general EE.UU. 2024-2025)

| Trabajo | Rango bajo | Rango medio | Rango alto |
|---------|-----------|-------------|-----------|
| Pintura interior (por cuarto 12x12) | $200-300 | $350-500 | $600-900 |
| Drywall instalado (por sqft) | $2.00 | $3.50 | $5.50 |
| LVP flooring (por sqft instalado) | $3.50 | $5.00 | $8.00 |
| Tile bathroom (por sqft) | $8 | $12 | $18 |
| Remodel baño básico | $3,500 | $7,000 | $15,000 |
| Remodel cocina básica | $8,000 | $18,000 | $45,000 |
| Roof repair (parcial) | $400 | $900 | $1,800 |
| Fence (por pie lineal) | $20 | $35 | $65 |
| Deck (por sqft) | $15 | $25 | $45 |

## Ejemplo de respuesta

Usuario: "Hazme un estimado para pintar una sala de 15x20"

```
ESTIMADO - PINTURA INTERIOR
Sala: 15' x 20' (aprox. 700 sqft de pared)

MATERIALES:
- Pintura interior (2 galones premium) × $45 = $90
- Primer (1 galón) × $30 = $30
- Rodillos, charola, cinta, plástico = $35
SUBTOTAL MATERIALES: $155

MANO DE OBRA:
- Preparación y tapado: 2h × $50 = $100
- Aplicación 2 capas (pintor x 1 día): $350
SUBTOTAL MANO DE OBRA: $450

MISCELÁNEOS (10%): $60

TOTAL: $665

Condiciones: 50% depósito al inicio. Precio válido 14 días.
No incluye: reparación de agujeros, trabajo en techo, muebles (cliente los mueve).
```
