# SEMSE AI Logic Model

## 1. Tesis central

SEMSE no debe usar IA como un chat ornamental.
Debe usar IA como una capa de decision asistida que opera sobre el ciclo real del trabajo:

- antes del job, para estructurar mejor la demanda;
- durante la ejecucion, para elevar calidad de evidencia y prevenir riesgo;
- antes del pago, para reducir error, fraude y conflicto;
- despues del cierre, para construir reputacion y memoria util.

La logica correcta no es "un agente que responde preguntas".
La logica correcta es "un sistema que observa eventos del dominio, evalua contexto, propone acciones y escala cuando hace falta".

---

## 2. Principio rector

La IA en SEMSE debe cumplir esta regla:

> Ningun agente decide fuera del dominio. Toda inteligencia debe estar anclada a eventos, entidades, permisos, evidencia y auditoria.

Eso implica 6 principios:

1. La IA no reemplaza estados de negocio. Los interpreta y ayuda a moverlos.
2. Toda recomendacion debe nacer de un evento concreto del sistema.
3. Toda accion sensible requiere score de confianza y trazabilidad.
4. Las decisiones irreversibles usan HITL.
5. El valor principal de la IA es reducir friccion, riesgo y ambiguedad.
6. La memoria no es conversacional solamente; es memoria operativa del ecosistema.

---

## 3. Donde vive la inteligencia

La capa de IA debe quedar distribuida asi:

### 3.1 IA de interfaz

Agentes nombrados que ayudan a usuarios y operadores.
Su trabajo no es "hablar bonito", sino traducir complejidad del sistema en proximas acciones claras.

Ejemplos:

- `Planner` convierte una idea vaga en scope, milestones y presupuesto estimado.
- `Marta` ayuda a ejecutar el contrato y mantener salud del proyecto.
- `Evidence Coach` mejora la calidad de la evidencia antes de revision.
- `Escrow` explica estados de fondeo, retencion y liberacion.
- `Vesper` explica riesgo, confiabilidad y señales de disputa.

### 3.2 IA de backend

Agentes especializados que escuchan eventos y producen salidas estructuradas JSON.

Ejemplos:

- `job-planner`
- `pricing`
- `trust-match`
- `evidence-coach`
- `risk`
- `dispute`
- `orchestrator`
- `ecv`

### 3.3 IA constitucional

La IA no solo recomienda; tambien valida a otras IAs.
El `ecv` debe actuar como guardrail para revisar:

- cumplimiento de politicas;
- sesgos operativos evidentes;
- lenguaje legal o financiero demasiado concluyente;
- intentos de automatizar decisiones que debieron escalarse.

---

## 4. Logica operativa por capa del ecosistema

## 4.1 SEMSE Jobs

Objetivo: convertir trabajos ambiguos en operaciones ejecutables.

Lugares donde la IA agrega logica real:

- al crear un job:
  - limpia alcance;
  - identifica vacios;
  - propone milestones;
  - estima rango de precio;
  - detecta complejidad y riesgo temprano.
- al hacer matching:
  - prioriza profesionales por historial, evidencia pasada y compatibilidad;
  - explica por que un match es mejor que otro.
- al iniciar contrato:
  - valida consistencia entre scope, presupuesto, entregables y fechas.

Salida esperada:

- menos jobs mal definidos;
- menos retrabajo;
- menos discrepancia entre expectativa y ejecucion.

## 4.2 SEMSE Ops

Objetivo: hacer visible lo que normalmente se rompe tarde.

La IA aqui debe funcionar como sistema nervioso operativo:

- detectar jobs estancados;
- detectar milestones con evidencia debil;
- priorizar alertas por riesgo real;
- resumir timelines largos para operadores;
- recomendar runbooks;
- clasificar incidentes y derivaciones.

Salida esperada:

- menos tiempo de deteccion;
- menos backlog ciego para ops;
- mejores escalaciones.

## 4.3 SEMSE Trust

Objetivo: construir confianza desde comportamiento verificable.

La IA no debe inventar reputacion; debe sintetizar senales reales:

- cumplimiento de hitos;
- calidad y puntualidad de evidencia;
- disputas abiertas y resueltas;
- liberaciones aprobadas sin friccion;
- consistencia entre promesa y entrega;
- patrones de riesgo por actor, categoria y contexto.

Salida esperada:

- trust score explicable;
- reputacion basada en hechos;
- prevencion de fraude y abuso.

## 4.4 Prometeo

Objetivo: preservar un horizonte de gobernanza programable.

Todavia no toca construirlo completo, pero la IA actual debe dejar huellas compatibles con ese futuro:

- decisiones auditables;
- politicas evaluables;
- razonamientos resumidos;
- trazas por actor y por evento.

---

## 5. Modelo de activacion correcto

La IA debe activarse por eventos del dominio, no solo por chats manuales.

### Eventos clave

- `job.created`
- `job.updated`
- `bid.submitted`
- `contract.created`
- `milestone.submitted`
- `evidence.uploaded`
- `milestone.review_requested`
- `payment.deposit_requested`
- `payment.release_requested`
- `dispute.opened`
- `job.completed`
- `trust.recompute_requested`

### Pipeline recomendado

1. ocurre un evento del dominio;
2. se crea un `AgentRun` con contexto minimo suficiente;
3. el agente produce output estructurado;
4. `ecv` valida si la accion tiene impacto;
5. si la confianza es alta y la politica lo permite:
   - se genera recomendacion aplicable o automatizacion limitada;
6. si la confianza es media o el riesgo es alto:
   - se enruta a operador;
7. todo queda auditado.

Esto vuelve a la IA una capa de orquestacion del ecosistema, no una feature aislada.

---

## 6. Matriz de decisiones: que puede automatizarse y que no

### Automatable con bajo riesgo

- resumir jobs;
- sugerir milestones;
- sugerir checklist de evidencia;
- clasificar tickets ops;
- detectar ausencia de campos o adjuntos;
- redactar notificaciones;
- proponer ranking preliminar de matches.

### Asistido con revision humana

- score de riesgo con recomendacion;
- propuesta de resolucion de disputa;
- recomendacion de liberacion o retencion;
- deteccion de fraude;
- ajustes de trust score con impacto visible;
- politicas operativas sugeridas.

### Nunca autonomo en MVP

- resolver disputa final;
- mover dinero sin politica dura previa;
- bloquear permanentemente cuentas;
- ejecutar acciones legales concluyentes;
- reescribir contratos aprobados.

---

## 7. Memoria correcta para SEMSE

SEMSE necesita tres memorias distintas.

### 7.1 Memoria conversacional

Contexto corto de cada thread.
Sirve para continuidad UX.

### 7.2 Memoria operativa

Resumen vivo por entidad:

- job;
- contract;
- milestone;
- dispute;
- user;
- professional profile;
- organization.

Debe guardar:

- estado actual;
- ultimos eventos relevantes;
- riesgos abiertos;
- decisiones pendientes;
- resumen ejecutable.

### 7.3 Memoria de aprendizaje del ecosistema

No es "recordar conversaciones".
Es aprender patrones:

- que tipo de jobs generan mas disputa;
- que evidencia predice aprobacion;
- que perfiles entregan mejor por categoria;
- que secuencias terminan en atraso o conflicto.

Esta memoria luego alimenta:

- trust;
- risk;
- pricing;
- matching;
- ops intelligence.

---

## 8. El rol de cada agente dentro de la logica de negocio

### Agentes nombrados

- `SEMSE`: router principal, explicador del sistema y siguiente paso.
- `Planner`: convierte demanda ambigua en trabajo ejecutable.
- `Marta`: copiloto del ciclo contractual y de milestones.
- `Felix`: copiloto de campo, evidencia y worklogs.
- `Escrow`: copiloto financiero con lenguaje claro y trazable.
- `Justus` y `Legal`: copilotos de estructura contractual y compliance.
- `Vesper`: copiloto de riesgo y confiabilidad.
- `Pulse`: copiloto de metricas, salud operativa y lectura del negocio.
- `Binary` y `Tech`: copilotos internos de integracion y arquitectura.

### Agentes especializados

- `pricing`: estima rango y justifica.
- `job-planner`: descompone alcance.
- `trust-match`: prioriza oferta confiable.
- `evidence-coach`: previene rechazo por evidencia pobre.
- `risk`: anticipa dano antes de pago o escalacion.
- `dispute`: ordena hechos y propone salida.
- `orchestrator`: coordina varios agentes en flujos complejos.
- `ecv`: valida seguridad, consistencia y gobernanza del output.

---

## 9. Idea fuerte: SEMSE como sistema de copilotos por momento

La mejor logica no es un solo asistente gigante.
Es un ecosistema de copilotos activados por momento del journey.

### Momento 1: definir trabajo

Copilotos:

- Planner
- pricing
- trust-match

### Momento 2: contratar y arrancar

Copilotos:

- Marta
- Justus
- risk

### Momento 3: ejecutar y documentar

Copilotos:

- Felix
- Evidence Coach
- Marta

### Momento 4: revisar y pagar

Copilotos:

- Escrow
- risk
- ecv

### Momento 5: cerrar, aprender y reputar

Copilotos:

- Vesper
- Pulse
- trust-match

Esto le da logica al ecosistema porque cada inteligencia aparece donde existe una decision real.

---

## 10. Roadmap recomendado de implementacion

### Fase A - IA util sin complejidad excesiva

Construir primero lo que reduce friccion inmediata:

- `job-planner`
- `pricing`
- `evidence-coach`
- resumen inteligente de timelines y contratos

Meta:

- mejorar definicion de jobs;
- mejorar calidad de evidencia;
- reducir pasos manuales.

### Fase B - IA de control operativo

- `risk`
- alerting inteligente
- clasificacion ops
- priorizacion de casos

Meta:

- detectar temprano los casos malos;
- reducir carga de operadores.

### Fase C - IA de confianza estructural

- `trust-match`
- trust score explicable
- analitica de disputas
- memoria de patrones

Meta:

- crear una ventaja estructural del ecosistema.

### Fase D - Orquestacion multiagente

- `orchestrator`
- `ecv`
- politicas por tipo de accion

Meta:

- convertir agentes aislados en sistema coherente.

---

## 11. KPI correctos para medir si la IA sirve

No medir solo uso de chat.
Medir impacto operativo:

- porcentaje de jobs creados con scope suficiente;
- tiempo medio para aceptar o corregir un milestone;
- tasa de rechazo de evidencia;
- tasa de disputa por categoria;
- precision de alertas de riesgo;
- tiempo de resolucion ops;
- porcentaje de pagos liberados sin friccion;
- mejora del match quality;
- reduccion de retrabajo manual.

Si esos indicadores no mejoran, la IA no esta dando logica al ecosistema; solo esta generando texto.

---

## 12. Decisiones concretas para SEMSE ahora

1. Tratar a la IA como capa de decision asistida sobre eventos del dominio.
2. Priorizar 4 agentes utiles antes que expandir el catalogo:
   - `job-planner`
   - `pricing`
   - `evidence-coach`
   - `risk`
3. Introducir `ecv` antes de automatizar acciones sensibles.
4. Crear memoria operativa por entidad, no solo chat history.
5. Hacer que cada output importante del agente termine en:
   - recomendacion;
   - confianza;
   - razon corta;
   - siguiente accion;
   - audit log.
6. Diseñar la UI de agentes por momento del workflow, no por "persona hablando".

---

## 13. Formula resumida

La logica de IA para SEMSE debe ser:

**evento del dominio -> agente especializado -> validacion -> recomendacion o escalacion -> auditoria -> aprendizaje**

Si mantienes esa formula, la IA fortalece el ecosistema.
Si la rompes, SEMSE corre el riesgo de convertirse en un dashboard con chat.
