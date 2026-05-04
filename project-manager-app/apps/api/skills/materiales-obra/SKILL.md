---
name: materiales-obra
description: "Calcular materiales para trabajos de construcción: fórmulas, desperdicio, listas por tipo de trabajo."
version: 1.0.0
author: SEMSE OS
metadata:
  semse:
    tags: [materiales, calcular, cantidad, medidas, sqft, lf, cubic yard]
    intents: [materials_list, estimate_generation]
    related_skills: [precios-materiales-eeuu, cotizacion-construccion]
---

# Skill: Cálculo de Materiales

## Conversiones importantes

- 1 pie (ft) = 0.30 metros
- 1 sqft = 0.093 m²
- 1 acre = 43,560 sqft
- 1 cubic yard = 27 cubic feet
- 1 galón = 3.78 litros

## Pintura

**Fórmula:** (Perímetro × Altura) - Puertas y ventanas = sqft de pared  
**Cobertura:** 350-400 sqft por galón (1 capa, superficie lisa)  
**Con 2 capas:** 175-200 sqft por galón  
**Agregar 10%** por bordes, retoques, desperdicio

**Ejemplo — cuarto 12' × 14' × 9' techo:**
- Perímetro: (12+14) × 2 = 52 lf
- Área de pared: 52 × 9 = 468 sqft
- Menos 1 puerta (21 sqft) + 2 ventanas (14 sqft): 468 - 35 = 433 sqft
- Con 2 capas: 433/175 = 2.47 → **3 galones**

## Drywall

**Fórmula:** sqft de pared ÷ 32 sqft por hoja = # de hojas  
**Agregar 15%** para recortes y errores

**Clavos/screws:** 1 lb por cada 500 sqft  
**Joint compound:** 1 caja (4.5 gal) por cada 200-250 sqft  
**Tape:** 1 rollo (250 ft) por cada 500 sqft  

## Pisos

**Fórmula:** Largo × Ancho = sqft total  
**Agregar:**
- Instalación recta: +10%
- Instalación diagonal: +15%
- Cuartos irregulares: +15-20%

**Ejemplo — sala 18' × 22':**
- Área: 396 sqft
- Con 10% desperdicio: 396 × 1.10 = **436 sqft a pedir**

**Adhesivo/grout para tile:** 1 saco (50 lb) por 50-75 sqft

## Concreto

**1 yard cúbico de concreto** = un área de:
- 4" de profundidad: 81 sqft
- 6" de profundidad: 54 sqft
- 8" de profundidad: 40 sqft

**Ejemplo — losa 10' × 20' × 4":**
- Volumen: 10 × 20 × (4/12) = 66.7 cubic feet
- ÷ 27 = 2.47 → **pedir 2.7 yards** (10% extra)

## Lumber (madera)

**Studs de pared:** 1 stud por cada 1.5 ft de longitud de pared + 3 extras por esquina/apertura

**Ejemplo — pared de 16 ft:**
- 16 ÷ 1.5 = 10.7 → 11 studs
- 1 esquina: +3 studs
- Total: **14 studs 2×4×8**

**Plywood subfloor:** 1 hoja 4×8 por 32 sqft + 10%

## Mulch / Landscaping

**1 yard cúbico cubre:**
- 2" de profundidad: 162 sqft
- 3" (recomendado): 108 sqft
- 4": 81 sqft

## Reglas de oro para evitar quedarse corto

1. Siempre agregar mínimo 10% de desperdicio
2. Pedir en la misma batch (dye lot) para colores consistentes
3. Guardar 5-10% como reposición para reparaciones futuras
4. Para material de fabricación exterior o discontinuo: pedir 15-20% extra
5. Mejor sobrar que quedarse corto (flete de segunda orden cuesta caro)
