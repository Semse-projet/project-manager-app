# Síntesis de la conversación — SEMSE Pro Tools

## Contexto general

El usuario está desarrollando SEMSE Project / SEMSE OS / Sunset Project como una plataforma para servicios profesionales, especialmente construcción, remodelación y mantenimiento. El ecosistema contempla clientes, profesionales y admins, con herramientas operativas, cotizaciones, hitos, escrow, evidencia, inspección y asistencia de IA mediante Prometeo.

## Línea de trabajo desarrollada

1. Se empezó con una herramienta para concreto/fundición basada en una pregunta de obra: cuántas bolsas de cemento se requieren para una fundición de 15 m².
2. A partir de esa lógica, se creó una herramienta HTML para calcular volumen de concreto, cemento, arena, grava, agua y desperdicio.
3. Después se pidió una herramienta para carpintería, con cálculo de madera, volumen, tableros, costos y referencias de herramientas.
4. Luego se pidió una herramienta para electricista, con cálculos eléctricos: Ley de Ohm, corriente, potencia, caída de tensión, calibre, breaker, consumo y motores.
5. Después el usuario pidió “las otras herramientas”, y se propuso completar la suite para contratistas.
6. Se crearon herramientas adicionales para plomería, pintura, drywall, pisos, roofing, HVAC, cotizador/escrow e inspección.
7. Finalmente el usuario pidió endurecer y refinar todas las herramientas con mejores prácticas, operabilidad, algoritmos y más iteraciones.

## Cambio estratégico definido

Se decidió que las herramientas no deben quedarse como calculadoras sueltas. Deben evolucionar hacia SEMSE Pro Tools v2:

- Trade Engines por oficio.
- Core Engines compartidos.
- Risk Engine.
- Cost Engine.
- Labor Engine.
- Material Engine.
- Milestone Engine.
- Evidence Engine.
- Quote Engine.
- Escrow Engine.
- Change Order Engine.
- Dispute Prevention Engine.
- Prometeo AI Advisor.

## Herramientas actuales

- Concrete / Fundición Tool.
- Carpentry Tool.
- Electrical Tool.
- Plumbing Tool.
- Painting Tool.
- Drywall Tool.
- Flooring Tool.
- Roofing Tool.
- HVAC Tool.
- Quote + Escrow Tool.
- Inspection / Evidence Tool.

## Objetivo de SEMSE Pro Tools v2

Cada herramienta debe recibir datos, validar, calcular materiales, calcular mano de obra, calcular costo, detectar riesgos, generar advertencias, crear cotización, dividir en hitos, definir evidencia y preparar escrow.

## Resultado esperado

SEMSE debe poder convertir una solicitud como “necesito reparar mi techo” en:

1. Cálculo técnico.
2. Materiales estimados.
3. Mano de obra estimada.
4. Riesgo.
5. Cotización.
6. Hitos.
7. Evidencia requerida.
8. Escrow.
9. Reporte.
10. Análisis de Prometeo.

