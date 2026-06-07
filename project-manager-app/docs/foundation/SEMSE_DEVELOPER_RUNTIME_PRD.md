# SEMSE Developer Runtime PRD

## Proposito

Este documento fija el marco de producto del **SEMSE Developer Runtime** dentro del monorepo canonico. Su rol es convertir intencion tecnica en ejecucion real, verificable, gobernada y auditable.

Complementos:

- blueprint de ecosistema: `/home/yoni/labsemse/program/architecture/SEMSE_DEVELOPER_RUNTIME_BLUEPRINT.md`
- spec tecnica monorepo: [SEMSE_DEVELOPER_RUNTIME_SPEC.md](/home/yoni/labsemse/project-manager-app/docs/foundation/SEMSE_DEVELOPER_RUNTIME_SPEC.md)
- prompt maestro operativo: [PROMPT_MAESTRO_SEMSE_DEVELOPER_RUNTIME.md](/home/yoni/labsemse/project-manager-app/docs/foundation/PROMPT_MAESTRO_SEMSE_DEVELOPER_RUNTIME.md)

## Resumen ejecutivo

SEMSE Developer Runtime no es un chat con terminal embebida. Es la capa operativa para developers dentro de SEMSEproject.

Debe:

- interpretar objetivos tecnicos;
- generar planes ejecutables;
- usar herramientas reales como shell, file ops, git, lint, test y build;
- coordinar agentes especializados;
- pedir aprobacion cuando una accion sea sensible;
- validar resultados antes de declarar exito;
- registrar evidencia, artefactos y contexto persistente.

## Problema

Hoy los developers operan con piezas fragmentadas:

- terminal manual;
- IDE;
- asistentes IA aislados;
- scripts ad hoc;
- documentacion dispersa;
- validaciones manuales;
- poca trazabilidad.

Eso genera:

- perdida de contexto;
- baja gobernanza;
- ejecucion no auditable;
- acoplamiento a proveedores;
- fixes no verificados;
- dificultad para escalar autonomia.

## Vision

SEMSE Developer Runtime sera el entorno operativo inteligente donde developers y leads puedan construir, diagnosticar, ejecutar, validar y evolucionar software mediante una interfaz unificada, agentiva y gobernada.

## Objetivo principal

Permitir que un usuario exprese una intencion tecnica en lenguaje natural o semiestructurado y que el sistema la convierta en una mision ejecutable con:

- plan;
- herramientas;
- agentes;
- validacion;
- evidencia;
- cierre con trazabilidad.

## Objetivos de negocio

- aumentar productividad del developer;
- reducir tiempo de diagnostico y resolucion;
- estandarizar flujos tecnicos;
- crear memoria operativa del repo y del ecosistema;
- reducir errores por ejecucion impulsiva;
- mejorar trazabilidad tecnica y gobernanza;
- crear ventaja competitiva frente a copilotos aislados.

## Usuarios objetivo

Primarios:

- developers individuales;
- full-stack developers;
- backend developers;
- frontend developers;
- devops engineers;
- technical leads.

Secundarios:

- QA tecnico;
- arquitectos de software;
- admins tecnicos;
- equipos internos de producto e ingenieria.

## Casos de uso principales

- levantar un repo por primera vez;
- diagnosticar por que falla un proyecto;
- corregir errores de build, lint o tests;
- instalar dependencias y herramientas faltantes;
- crear un modulo nuevo siguiendo la arquitectura del repo;
- refactorizar una parte del sistema sin romper funcionalidad;
- auditar salud tecnica del proyecto;
- preparar una feature branch con cambios controlados;
- actualizar documentacion tecnica tras cambios;
- ejecutar una mision autonoma controlada con checkpoints.

## Jobs to be done

- "Quiero que este repo corra localmente."
- "Quiero entender por que falla el build."
- "Quiero crear este modulo sin romper la arquitectura."
- "Quiero que el sistema proponga y aplique fixes, pero con aprobaciones."
- "Quiero que todo quede documentado y validado."

## Propuesta de valor

SEMSE no solo ayuda a escribir codigo. Ayuda a operar trabajo tecnico de punta a punta.

Diferenciadores:

- mision end-to-end, no solo sugerencias;
- terminal + herramientas + agentes + gobernanza;
- memoria persistente por repo y ecosistema;
- validacion obligatoria antes de declarar exito;
- evidencia completa de lo ejecutado;
- abstraccion de proveedores de IA;
- alineacion con arquitectura canonica de SEMSEproject.

## Alcance inicial

Incluye:

- input de intencion tecnica;
- interpretacion y clasificacion de tarea;
- planeacion de ejecucion;
- terminal embebida con logs;
- tool registry basico;
- agente de diagnostico;
- agente runtime;
- validacion de build/lint/tests;
- diff viewer;
- aprobaciones para acciones sensibles;
- bitacora de sesion;
- memoria contextual basica del repo.

No incluye al inicio:

- despliegue automatico a produccion;
- autonomia total sin checkpoints;
- gestion multi-repo avanzada;
- edicion visual estilo IDE completo;
- orquestacion distribuida de gran escala.

## Experiencia ideal

1. El usuario elige repo y branch.
2. Escribe una intencion o selecciona una mision sugerida.
3. SEMSE interpreta la intencion.
4. SEMSE presenta plan, riesgo y agentes involucrados.
5. El usuario aprueba si aplica.
6. SEMSE ejecuta herramientas y muestra salida viva.
7. SEMSE aplica cambios y muestra diff.
8. SEMSE valida build/tests/lint/health.
9. SEMSE entrega resumen, evidencia y siguiente paso.

## Requisitos funcionales

- RF-01 Intencion: aceptar intencion tecnica en lenguaje natural.
- RF-02 Clasificacion: clasificar la intencion en categorias operativas.
- RF-03 Planeacion: descomponer la mision en pasos verificables.
- RF-04 Orquestacion: coordinar agentes y herramientas segun contexto.
- RF-05 Terminal: ejecutar comandos y mostrar logs.
- RF-06 Archivos: leer, escribir y parchear archivos bajo politicas definidas.
- RF-07 Aprobacion: pedir aprobacion para acciones sensibles.
- RF-08 Validacion: ejecutar validaciones antes de cerrar.
- RF-09 Evidencia: registrar acciones, outputs, diffs y resultados.
- RF-10 Memoria: persistir contexto por repo y por sesion.
- RF-11 Provider abstraction: enrutar tareas por capacidad, no por proveedor fijo.
- RF-12 Historial: guardar sesiones y artefactos.

## Requisitos no funcionales

- seguridad por defecto;
- trazabilidad completa;
- respuesta clara y estructurada;
- diseño modular;
- soporte para sandboxing;
- observabilidad de herramientas;
- reintentos controlados;
- latencia razonable en tareas interactivas;
- robustez ante errores parciales.

## Metricas de exito

Producto:

- tiempo medio para levantar repo;
- tiempo medio para resolver build roto;
- tasa de exito por mision;
- tasa de aprobacion requerida por tipo de tarea;
- porcentaje de sesiones con validacion exitosa;
- reduccion de tiempo manual de diagnostico.

Calidad:

- porcentaje de misiones con evidencia completa;
- porcentaje de cierres con validacion real;
- porcentaje de acciones revertibles;
- ratio de errores por acciones automaticas.

Adopcion:

- sesiones por developer por semana;
- repeticion de uso;
- numero de misiones completadas;
- tiempo de permanencia en interfaz.

## Riesgos

- sobreautonomia sin control;
- acoplamiento a un proveedor;
- confianza excesiva en outputs no validados;
- cambios destructivos sin rollback o evidencia;
- crecimiento de complejidad del sistema;
- mala UX si la terminal domina demasiado la experiencia.

## Mitigaciones

- niveles de autonomia;
- approval gateway;
- verify-before-claim;
- tool contracts tipados;
- auditoria por accion;
- politica por herramienta y contexto;
- resumen claro de mision y resultado.

## Roadmap

Fase 1:

- intencion;
- clasificacion;
- agente diagnostico;
- agente runtime;
- tool registry base;
- terminal viva;
- validacion build/lint/tests;
- bitacora de sesion.

Fase 2:

- diff viewer;
- aprobaciones;
- patch engine;
- memoria por repo;
- historial persistente.

Fase 3:

- agentes backend/frontend/QA/doc/devops;
- policy engine mas rico;
- mejor routing de proveedores.

Fase 4:

- autonomia supervisada madura;
- reintentos inteligentes;
- auditoria avanzada;
- flujos multiagente profundos.
