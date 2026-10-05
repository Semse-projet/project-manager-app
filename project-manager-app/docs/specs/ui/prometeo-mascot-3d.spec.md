---
id: "ui.prometeo-mascot-3d"
title: "Mascota 3D interactiva de Prometeo y widget conectado al chat real"
sdd_version: "2.0"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
domain: "ui"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "medium"
date: "2026-10-05"
author: "Claude"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/web/app/components/prometeo/PrometeoCopilot.tsx
  - apps/web/app/components/prometeo/PrometeoMascot.tsx
  - apps/web/app/components/prometeo/PrometeoMascot3D.tsx
  - apps/web/lib/prometeo-mascot.ts
  - apps/web/lib/prometeo-mascot-scene.ts
  - apps/web/lib/prometeo-widget-chat.ts
  - docs/brand/prometeo/brand-album-source.png
related_tests:
  - tests/unit/prometeo-mascot.test.ts
  - tests/unit/prometeo-widget-real-chat.test.ts
  - tests/unit/prometeo-copilot-quick-actions.test.ts
related_endpoints:
  - "prometeo/chat"
related_events: []
related_agents:
  - prometeo
last_verified: "2026-10-05"
---

# Spec: Mascota 3D interactiva de Prometeo

> Metadata de entrega (2026-10-05): el código está completo y se verificó
> localmente (pruebas unitarias, `tsc`, eslint, `next build` y una revisión
> visual en un navegador real contra un servidor de desarrollo). `NOT_RUN`,
> `UNMERGED` y `NOT_DEPLOYED` declaran que aún no hay CI de este contrato ni
> despliegue; no se afirma evidencia de producción.

## 1. Propósito

El widget flotante de Prometeo debe (a) responder de verdad, conectado al chat
real del ecosistema, y (b) mostrar a la mascota de marca (robot con llama,
álbum en `docs/brand/prometeo/`) como un personaje 3D interactivo.

## 2. Comportamiento

### 2.1 Chat

- Sin intención de misión (`requiresWorkspace` falso), la pregunta se responde con
  el chat real (`/api/semse/cortex/chat` → `POST /v1/ai-models/prometeo/chat`),
  que arma el contexto operativo y llama al modelo. Antes el widget devolvía un
  texto fijo para toda pregunta general.
- Se envía `pageContext` (ruta y módulo) y `projectId` solo si la pantalla es de
  un proyecto; el API exige participación en el proyecto (hallazgo 0.36/0.37).
- Solo se acepta una respuesta con `mode: "runtime"`; la de demo nunca se muestra
  como respuesta de Prometeo. Si el chat real falla se conserva la respuesta del
  servidor del widget (sin regresión).

### 2.2 Mascota 3D

- Robot construido con three.js directo (sin modelos externos): cabeza, visor con
  rostro dibujado, audífonos, cuerpo con logo, brazos y llama animada con shader.
- Interacción: la cabeza sigue el cursor (con tope de giro), saluda con el brazo
  al pasar el cursor, se gira arrastrando y vuelve al frente al soltar; un clic
  abre el chat (también Enter/Espacio con foco).
- Expresiones de la marca según el estado del asistente: `feliz` (reposo),
  `pensando` (esperando respuesta), `guiando` (respondió), `sorprendido` (error o
  clic) y `confirmado` (misión creada, con marca de verificación).
- La llama se aviva al pensar y se apaga si hay error.

### 2.3 Degradación y rendimiento

- Sin WebGL, o con `prefers-reduced-motion: reduce`, se muestra la imagen de
  marca (`avatar-256.png`).
- three.js se carga bajo demanda (`next/dynamic`, `ssr: false`); el JS compartido
  de la aplicación no crece.
- Cada escena crea su propio `<canvas>` y libera sus recursos de GPU al
  desmontarse (React StrictMode monta, desmonta y vuelve a montar).
- Un error al crear la escena cae a la imagen de marca (error boundary).
- Hay una sola escena a la vez: lanzador cerrado o cabecera del panel abierto.

## 3. Fuera de alcance

- Respuesta del modelo en el widget más allá de texto (bloques, acciones
  propuestas y citas del chat real): el widget solo muestra el texto.
- Voz o animaciones por fonema.
- Verificación en vivo contra producción (ver sección 4).

## 4. Criterios de aceptación y estado

| Criterio | Estado |
|---|---|
| Lógica de estados, cursor, arrastre y rostro con pruebas unitarias | Verificado |
| `tsc`, eslint y `next build` sin errores | Verificado |
| Render 3D, saludo, clic y los 5 estados en un navegador real (servidor local) | Verificado visualmente |
| El chat real responde desde el widget en producción | Pendiente (requiere despliegue y sesión) |
| Rendimiento en móviles de gama baja | Pendiente |

## 5. Rollback

Revertir el PR restaura el lanzador de imagen y el widget anterior. No hay
migraciones ni cambios de API.
