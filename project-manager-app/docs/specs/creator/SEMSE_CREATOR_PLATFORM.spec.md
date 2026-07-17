---
id: semse-creator-platform
title: "SEMSE Creator Platform for Professors and Experts"
domain: creator
status: APPROVED
owner: semse-creator
risk: high
related_files:
  - packages/forge/src/creator.ts
  - .semse-sdd/forge/templates/creator-app-blueprint.template.json
  - docs/agents/forge-agent-registry.md
related_tests:
  - tests/unit/forge-harness.test.mjs
related_endpoints: []
related_events:
  - CREATOR_BLUEPRINT_CREATED
  - CREATOR_APP_PUBLICATION_PROPOSED
related_agents:
  - prometeo
  - creator-mentor
  - spec-architect
  - ux-composer
  - backend-builder
  - qa-verifier
last_verified: 2026-07-17
---

# SPEC: SEMSE Creator Platform

## 1. Visión

Permitir que profesores, técnicos, agricultores, médicos, abogados, ingenieros y otros expertos conviertan su conocimiento en aplicaciones y herramientas sin comenzar desde cero ni depender de saber programar.

El activo principal no es el código: es el conocimiento estructurado, verificable y ejecutable.

## 2. Resultados que puede crear un profesor

- aplicación educativa;
- curso interactivo;
- calculadora;
- simulador;
- herramienta de campo;
- evaluación;
- certificación;
- agente especializado;
- workflow;
- biblioteca de conocimiento;
- componente reutilizable;
- paquete híbrido.

## 3. Modos de creación

### Conversacional

El Creator Mentor entrevista al experto y genera un blueprint.

### Visual

El profesor organiza módulos, pantallas, evaluaciones, herramientas y reglas.

### Pro-code

Un desarrollador amplía componentes con APIs y código, bajo el mismo SDD.

## 4. Flujo del creador

```text
CREATOR ONBOARDING
 -> KNOWLEDGE INTAKE
 -> RIGHTS CONFIRMATION
 -> BLUEPRINT
 -> CREATOR REVIEW
 -> SPEC DRAFT
 -> SPEC APPROVAL
 -> BUILD
 -> PREVIEW
 -> PILOT
 -> QUALITY REVIEW
 -> PUBLICATION PROPOSAL
 -> MARKETPLACE
 -> VERSIONING
```

## 5. Entidades conceptuales

- CreatorProfile
- CreatorOrganization
- KnowledgeSource
- KnowledgeUnit
- AppBlueprint
- AppModule
- ToolDefinition
- AssessmentDefinition
- CertificationRule
- AppVersion
- Publication
- License
- RevenueShare
- Review
- Installation
- UsageMetric

## 6. Blueprint mínimo

- identidad del creador;
- título y dominio;
- audiencia;
- tipo de app;
- objetivos;
- fuentes y derechos;
- módulos;
- evaluaciones;
- monetización;
- visibilidad;
- clasificación de datos;
- idiomas.

## 7. Derechos y propiedad

SEMSE debe registrar:

- quién aportó el conocimiento;
- derecho de uso;
- licencia;
- atribución;
- restricciones;
- ingresos;
- versiones derivadas.

No se publica contenido sin confirmación de derechos.

## 8. Seguridad educativa

- el profesor controla contenido;
- SEMSE controla seguridad de plataforma;
- las recomendaciones de alto riesgo deben incluir límites y revisión;
- salud, legal, finanzas y seguridad industrial requieren revisión especializada;
- menores requieren controles de privacidad y consentimiento aplicables.

## 9. Multi-tenancy

Cada app debe estar aislada por:

- creator;
- organización;
- tenant;
- versión;
- permisos;
- clasificación de datos.

Los componentes compartidos no pueden filtrar datos entre apps.

## 10. Publicación

La publicación es siempre una propuesta. Requiere:

- aprobación del creador;
- QA;
- seguridad según riesgo;
- gobernanza;
- términos/licencia;
- política de datos;
- versión;
- changelog;
- soporte y despublicación.

## 11. Marketplace

Modelos:

- gratis;
- pago único;
- suscripción;
- institucional;
- revenue share.

El profesor puede monetizar:

- app completa;
- curso;
- agente;
- simulador;
- plantilla;
- componente;
- certificación.

## 12. Reutilización

Los componentes reutilizables deben declarar:

- API;
- entradas y salidas;
- compatibilidad;
- versión;
- licencia;
- test suite;
- clasificación de datos;
- dependencias;
- owner.

## 13. Integración con SEMSEproject

Una app educativa puede activar módulos operativos:

- ProTools para cálculos;
- BuildOps para práctica de proyectos;
- Evidence para portafolio y prueba;
- Marketplace para oportunidades;
- Trust para reputación;
- Crowd para pagos;
- Agro para formación de campo;
- Prometeo para tutoría.

La activación usa permisos explícitos y contratos.

## 14. Experiencia del estudiante

- aprendizaje por proyecto;
- simulaciones;
- feedback;
- evidencias;
- progreso;
- competencias;
- certificaciones;
- portafolio;
- conexión con trabajo real.

## 15. Analítica

El creador ve:

- activaciones;
- estudiantes;
- finalización;
- desempeño;
- dificultad;
- abandono;
- satisfacción;
- ingresos;
- errores;
- reutilización de componentes.

No se exponen datos personales innecesarios.

## 16. Versionado

- draft;
- preview;
- pilot;
- published;
- deprecated;
- retired.

Las instalaciones conservan compatibilidad o migración explícita.

## 17. Criterios de aceptación

1. Blueprint validable.
2. Derechos confirmados.
3. Spec generado con digest.
4. Task graph para knowledge, UX, backend y QA.
5. Preview antes de publicación.
6. Publicación no automática.
7. Multi-tenant y permisos definidos.
8. Monetización y licencia explícitas.
9. Apps bilingües soportadas.
10. Integración opcional con módulos SEMSE mediante contratos.
