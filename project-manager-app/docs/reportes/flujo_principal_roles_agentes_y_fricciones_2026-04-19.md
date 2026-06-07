# Flujo Principal, Roles, Agentes y Fricciones

- Fecha: 2026-04-19
- Estado: flujo principal validado, roles y fricciones mapeados
- Frente: `project-manager-app`
- Objetivo: describir el flujo principal del ecosistema, qué debe hacer cada rol, dónde duele la operación real y qué agentes ayudan de verdad contra cuáles siguen siendo decorativos o incompletos.

## 1. Flujo principal del sistema

### Flujo madre
1. Cliente crea job
2. Sistema emite evento de dominio
3. Se crean runs de agentes relacionados
4. Cola entrega trabajos al worker
5. Worker arranca run
6. Agente procesa señales reales
7. Resultado vuelve a la plataforma
8. Usuario u ops toma siguiente acción
9. Se actualizan proyecto, milestone, disputa o decisión

### Qué debe ocurrir para que el flujo sea real
- Los roles deben tener siguiente paso claro
- El agente debe producir una acción útil, no solo texto bonito
- El estado debe cambiar realmente en DB
- La cola y el worker deben completar el ciclo
- Debe existir auditoría del recorrido

### Estado validado en este bucle
- El flujo madre ya corrió de punta a punta con runs `completed`
- Agentes validados en ciclo real:
  - `pricing`
  - `risk`
  - `evidence-coach`
  - `dispute`

## 2. Rol cliente

### Qué debe hacer
- Crear job
- Revisar candidatos / pricing / señales de riesgo
- Aceptar reserva o propuesta
- Financiar / revisar contrato
- Aprobar milestone o abrir disputa
- Cerrar trabajo y calificar

### Qué necesita para operar bien
- Ver estado claro del job y proyecto
- Ver qué falta para avanzar
- Ver recomendaciones simples y accionables
- Entender riesgo, costo y evidencia

### Dónde duele hoy
- Falta que la UI traduzca mejor el resultado del agente en “haz esto ahora”
- El cliente todavía puede quedar viendo estado técnico en vez de acción concreta
- Hay que validar más recorrido visual de punta a punta en pantallas reales

## 3. Rol profesional / pro

### Qué debe hacer
- Encontrar jobs relevantes
- Reservar / postular
- Aceptar trabajo
- Ejecutar milestone
- Subir evidencia
- Pedir pago o responder disputa

### Qué necesita para operar bien
- Matching confiable
- Reglas claras de evidencia
- Estado del milestone sin ambigüedad
- Señales de riesgo antes de perder tiempo

### Dónde duele hoy
- `trust-match` todavía necesita más validación operativa en recorrido real de profesional
- La ayuda existe, pero falta empaquetarla como decisión inmediata para el pro
- Hay que medir mejor pasos manuales entre evidencia, aprobación y cobro

## 4. Rol ops / admin

### Qué debe hacer
- Ver runs de agentes
- Ver colas, fallos y reintentos
- Aprobar acciones sensibles
- Resolver disputas y bloqueos
- Reintentar procesos muertos
- Detectar incidentes operativos

### Qué necesita para operar bien
- Visibilidad real del runtime
- Auditoría completa
- Herramientas de retry / reclaim / inspección
- Flujo terminal / consola realmente útil

### Dónde duele hoy
- La consola operativa todavía no está cerrada como producto final
- Ops aún necesita vista más clara de:
  - runs atascados
  - workers vivos
  - retries
  - divergencia Redis vs DB
- La fricción fuerte de escala es convertir señal técnica en acción operativa simple

## 5. Rol worker / system

### Qué debe hacer
- Tomar trabajos de Redis
- Resolver identidad del tenant correcto
- Marcar `start`
- Emitir heartbeat
- Completar o fallar run
- No dejar estados fantasmas

### Qué necesita para operar bien
- Redis estable
- API viva
- Mapeo correcto tenant/org/user/roles
- Concurrencia segura
- Estado consistente entre Redis y DB

### Dónde duele hoy
- El frente roto principal ya quedó cerrado en modo seguro
- El peligro real ahora es:
  - worker duplicado consumiendo cola
  - reabrir la herida al subir concurrencia sin control
- El worker necesita guardarraíles operativos para no volver a contaminar el loop

## 6. Agentes: cuáles ayudan y cuáles todavía no cierran valor

### Agentes con valor real ya visible
- `pricing`
  - completó run en flujo real
  - entrega baseline y recomendación operativa
- `risk`
  - completó run en flujo real
  - ya dejó de ser bloqueo del loop principal
- `dispute`
  - usa señales reales como evidencia, contrato y milestone
- `evidence-coach`
  - usa tipos reales de evidencia y cobertura
- `trust-match`
  - ya consume candidatos reales

### Agentes todavía no cerrados al 100%
- `trust-match`
  - motor y datos reales existen
  - falta validación más fuerte en recorrido producto/negocio
- `pricing`, `risk`, `dispute`, `evidence-coach`
  - ya sirven en runtime
  - falta convertir mejor su salida en UX accionable por rol

### Lectura honesta
- varios agentes ya dejaron de ser adorno
- el loop runtime principal ya cierra
- ahora el problema no es “si corre”, sino:
  - si ayuda de forma clara
  - si reduce pasos manuales
  - si escala sin romperse

## 7. Dónde duele la operación real

### Dolor 1 — quiebre en el ciclo principal
- La operación real necesita:
  - evento
  - run
  - cola
  - worker
  - start
  - complete
- Ese quiebre ya se cerró en este bucle
- La causa raíz fue operativa: worker viejo duplicado consumiendo cola

### Dolor 2 — estado partido
- Redis puede marcar `failed`
- DB puede dejar `queued`
- Eso confunde tanto a ops como a UI

### Dolor 3 — roles con intención correcta, pero loop no siempre cerrado
- Los permisos y recorridos están más definidos que antes
- Pero la validación por rol todavía no está completa en todos los casos reales

### Dolor 4 — fricción de escala
- La concurrencia mayor a `1` sigue siendo zona a revalidar
- Más paralelismo todavía no equivale automáticamente a más throughput útil
- Sin guardarraíl contra duplicados, escalar multiplica ruido y fallos fantasma

## 8. Fricciones que impiden escalar

### Técnica
- Riesgo de workers duplicados
- Concurrencia no revalidada bajo carga controlada
- Estado divergente Redis vs DB si un worker cae mal

### Producto
- Aún falta convertir recomendaciones en acciones guiadas para cada rol
- La terminal / consola todavía no centraliza la operación de forma madura

### Operación
- Falta mapa definitivo de bloqueos por rol y por estado
- Falta drill completo por recorrido:
  - cliente
  - pro
  - ops
  - worker

## 9. Acción siguiente recomendada

### Corto plazo
1. Mantener smoke principal como gate
2. Agregar guardarraíl contra worker duplicado
3. Revalidar worker con concurrencia `2`
4. Mapear resultados de agentes a siguiente acción visible por rol

### Mediano plazo
1. Validar flujo por rol
2. Mapear siguiente acción de cada pantalla
3. Medir fricción por paso operativo
4. Endurecer agentes con salida accionable

## 10. Resumen cavernícola

- Cliente, pro, ops y worker ya tienen contorno más claro
- `pricing` ya ayuda de verdad
- `risk` también ya cerró run real
- La fricción de escala más fuerte ahora es worker duplicado + concurrencia sin revalidar
- Primero blindar operación
- Después acelerar
