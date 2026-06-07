# Logica de Agentes SEMSE

## Definicion

La logica del agente es el conjunto de reglas que gobiernan como razona, cuando actua, cuando se detiene y bajo que restricciones opera.

## Donde vive hoy

En `SEMSE`, la logica no esta concentrada en un solo archivo. Vive repartida entre:

- system prompt y roles
- seleccion de tools
- `ToolExecutor`
- validaciones por tool
- `ActionRiskClassifier`
- `eligibility` de acciones
- permisos del dominio
- politicas por modulo

## Componentes de la logica

### 1. Seleccion de capacidad

Que tool puede usar el agente segun rol y power level.

### 2. Control de iteracion

Hasta cuantas veces puede hacer `tool_use` antes de terminar o pausar.

### 3. Gobierno de riesgo

Que acciones requieren approval, audit o bloqueo.

### 4. Clarificacion

Cuando el agente debe pausar y pedir mas informacion.

### 5. Post-accion

Que refresh, journal o audit deben ejecutarse despues de actuar.

## Loop de logica actual

`ToolExecutor.agentLoop()` ya implementa:

- limite de iteraciones
- parseo de `tool_calls`
- `validateInput`
- `checkPermissions`
- `ask_for_clarification`
- `durationMs`
- `AbortSignal`

## Regla de precision

La precision del trabajo no mejora solo con mas contexto. Mejora cuando:

- el contexto correcto entra al loop
- la memoria correcta se hidrata
- la herramienta correcta se escoge
- la politica correcta limita la accion
- el resultado correcto se vuelve a observar y refrescar

## Regla de replicabilidad

Una tarea debe poder reproducirse con:

- mismo input
- mismo thread o plan
- mismo snapshot de contexto
- mismo set de tools
- misma memoria habilitada
- mismas politicas

Si eso no puede repetirse, la logica todavia depende demasiado de estado implicito.
