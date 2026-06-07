# Vision Decisions Locked

## Objetivo

Registrar las decisiones de alto nivel que ya no deben reabrirse sin una razon fuerte.

## Decisiones Bloqueadas

### 1. Fuente de verdad de implementacion

La base canonica es:

- [project-manager-app](/home/yoni/labsemse/project-manager-app)

No se trabaja sobre copias parciales como fuente final.

### 2. Tipo de arquitectura

La arquitectura objetivo es:

- monorepo modular

No:

- carpetas sueltas sin dominio comun;
- varios proyectos paralelos sin integracion;
- microservicios prematuros.

### 3. Orden de capas

El orden de construccion es:

1. `SEMSE Jobs`
2. `SEMSE Ops`
3. `SEMSE Trust`
4. `Prometeo`

Prometeo depende del core operativo.
No al reves.

### 4. Entidad principal del producto

La entidad canonica del flujo comercial es:

- `Job`

`Project` existe hoy en el sistema, pero no debe dominar la vision de producto futura.

### 5. Regla de ejecucion

No se construye todo ahora.

Se construye:

- lo minimo viable;
- lo trazable;
- lo seguro;
- lo compatible con la vision larga.

### 6. MVP inicial

El MVP debe ser:

- verticalizado;
- curado;
- geograficamente acotado;
- con pocas categorias;
- con escrow por hitos;
- con evidencia obligatoria.

### 7. Seguridad

No se acepta:

- autorizacion solo por tenantId;
- financial access abierto;
- cambios de estado ciegos;
- usar bootstrap tecnico como si fuera auth final.

### 8. Integracion entre clones

No se fusionan cambios copiando carpetas completas entre clones.

La integracion se hace:

- archivo por archivo;
- por cambios revisados;
- o por commits trazables.

### 9. Vision documental

La carpeta [docs/vision](/home/yoni/labsemse/project-manager-app/docs/vision) guarda direccion estrategica.

La carpeta [program](/home/yoni/labsemse/program) guarda ejecucion.

La carpeta [docs/foundation](/home/yoni/labsemse/project-manager-app/docs/foundation) guarda decisiones tecnicas y de dominio.

### 10. Prometeo

Prometeo no se elimina.
No se implementa completo ahora.
Se conserva como norte institucional.

## Regla de cambio

Estas decisiones solo deben cambiar si:

- cambia el modelo de negocio;
- cambia la fuente canonica;
- aparece una restriccion tecnica o legal real;
- o se documenta una mejora estructural superior.
