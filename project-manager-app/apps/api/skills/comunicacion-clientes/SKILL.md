---
name: comunicacion-clientes
description: "Redactar mensajes profesionales para clientes: WhatsApp, email, cotizaciones, seguimiento, retrasos."
version: 1.0.0
author: SEMSE OS
metadata:
  semse:
    tags: [mensaje, cliente, comunicacion, whatsapp, email, follow-up, update]
    intents: [client_message, project_summary_client]
    related_skills: [cotizacion-construccion, gestion-proyectos]
---

# Skill: Comunicación con Clientes

## Tipos de mensajes y plantillas

### 1. Confirmación de trabajo / Inicio de proyecto

**WhatsApp (informal):**
```
Hola [Nombre] 👋 Confirmado el trabajo para el [día] a las [hora].
Estaré con mi equipo de [N] personas.
Necesitamos: [acceso a agua / electricidad / que limpien el área].
¿Alguna pregunta antes de llegar?
```

**Email (formal):**
```
Estimado/a [Nombre],

Confirmo que iniciaremos los trabajos el [fecha] a las [hora].

Detalle del alcance acordado:
- [Item 1]
- [Item 2]

Condiciones de pago: [X]% al inicio, [Y]% al terminar.

Para cualquier consulta: [teléfono] o este correo.

Saludos,
[Tu nombre]
[Empresa]
```

### 2. Actualización de avance (progress update)

**WhatsApp:**
```
Hola [Nombre]! Actualización del proyecto:
✅ Completado: [lo que se hizo]
🔨 En progreso: [lo que está en curso]
📅 Próximo paso: [qué sigue + cuándo]

¿Alguna duda? Aquí estamos.
```

### 3. Retraso / problema

**Clave: ser directo, dar solución, no excusas largas**

```
Hola [Nombre], te escribo sobre el proyecto de [dirección].

Hay un retraso por [razón concisa: clima/material demorado/inspector]. 

Nueva fecha estimada de término: [fecha].

Estamos tomando estas medidas: [acción concreta].

No hay cambio en el precio acordado. Disculpa el inconveniente, te mantengo informado.
```

### 4. Solicitar pago / recordatorio

**Primera solicitud (tono amigable):**
```
Hola [Nombre]! El trabajo de [descripción] está completado.
Adjunto fotos del resultado final.

El balance pendiente es: $[monto]
Puedes pagar por: [Zelle/Venmo/efectivo/check]

Gracias por confiar en nosotros!
```

**Segundo recordatorio (más directo):**
```
Hola [Nombre], te recuerdo el balance pendiente de $[monto] por el trabajo de [descripción] completado el [fecha].

Por favor confirma cuándo podemos arreglar el pago.
```

### 5. Cierre del proyecto

```
Hola [Nombre]! 🎉 El proyecto de [descripción] está 100% completado.

Resumen:
- Trabajo realizado: [lista breve]
- Fecha de terminación: [fecha]
- Garantía: [período] en mano de obra

Fue un placer trabajar con usted. Si necesita algo más, estamos a sus órdenes.

Si quedó satisfecho/a, ¡una reseña en [Google/Yelp] nos ayuda mucho! 🙏
```

### 6. Responder queja o inconformidad

```
Hola [Nombre], gracias por comunicarse.

Entiendo su preocupación sobre [el tema]. Quiero resolver esto correctamente.

Propongo: [ir a revisar / rehacer el trabajo / solución concreta] el [fecha/hora].

Mi compromiso es que quede satisfecho/a con el resultado. ¿Le parece bien?
```

## Reglas de comunicación con clientes

1. **Responder en < 2 horas** durante horario laboral (muestra profesionalismo)
2. **Usar WhatsApp para todo rápido**, email para contratos/estimados formales
3. **Fotos siempre**: antes, durante, después del trabajo
4. **Nunca discutir por mensaje**: llamar si hay desacuerdo
5. **Confirmar por escrito** cualquier cambio de alcance o precio

## Señales de alerta en clientes

🚩 Pide comenzar sin contrato claro  
🚩 Quiere "hablar el precio" después de terminar  
🚩 No confirma citas 2+ veces  
🚩 Pide trabajos extra sin hablar de precio adicional  
🚩 Referido de alguien con historial de no pago  
