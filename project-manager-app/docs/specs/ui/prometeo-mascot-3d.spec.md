---
id: "ui.prometeo-mascot-3d"
title: "Mascota 3D interactiva de Prometeo y widget conectado al chat real"
sdd_version: "2.0"
code_status: "COMPLETE"
ci_status: "PASS"
merge_status: "MERGED"
deploy_status: "DEPLOYED"
activation_status: "ACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
verification_scope: "partial:base-mascot-and-widget-real-chat-merged-deployed-and-smoked-2026-10-05:markdown-in-floating-widget-h06-h09-pending-merge-and-deploy"
production_evidence:
  - github:pr:785:merge:c13b0d2e0786cc27bbbbdf4f4904abda20c34933
  - github:pr:786:merge:b6efb0b1f5fcd9ecb0a05c9854b56deffdce72d6
  - github:pr:788:merge:8dc119a24a8ac9ac60a0fd841a65806aa17c92f6
  - railway:web:deployment:e114d011-8b5b-42bf-a285-8e3a91721553:success:sha:cc50b657a9b3c0f26bf5309f92dba27dd9871c6f:includes-c13b0d2e-b6efb0b1-8dc119a2
  - smoke:2026-10-05:production:web:sha:d72e6764bb41d2d383f5582e7ad618bb6d7800dd:mascot-3d-renders-hover-wave-click-opens-panel:authenticated-client
  - smoke:2026-10-05:production:web:sha:d72e6764bb41d2d383f5582e7ad618bb6d7800dd:widget-answers-with-real-account-data-not-fixed-text:authenticated-client
  - smoke:2026-10-05:production:web:sha:d72e6764bb41d2d383f5582e7ad618bb6d7800dd:project-copilot-input-visible-and-table-formatted:authenticated-client
domain: "ui"
version: "1.1"
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

> Metadata de entrega (2026-10-05, reconciliación H10): evidencia **por artefacto y por
> conducta**, sin convertir toda la feature en `VERIFIED`.
>
> - **Desplegado y comprobado** (web `e114d011`, SHA `cc50b657`, que incluye #785, #786 y #788;
>   humo manual con sesión de cliente sobre el SHA `d72e6764`): la mascota se renderiza en 3D, saluda al pasar
>   el cursor y el clic abre el panel; el widget responde con datos reales de la cuenta (ya no un texto fijo);
>   el campo del copiloto de proyecto es visible y la tabla de pilares se muestra con formato.
> - **Pendiente de mergear y desplegar:** formato markdown en el widget flotante (#790) y las correcciones
>   H06/H09 (fallo del chat visible con reintento, foco visible, "reducir movimiento" dinámico, pérdida de WebGL).
> - **No comprobado:** móviles de gama baja, español/inglés en móvil, roles distintos de cliente, pérdida de
>   WebGL y teclado en producción, y que los estados de la mascota vengan de eventos del runtime (hoy son
>   locales: `pending` y reacciones). La verificación del chat real es de un solo tenant y un solo rol.

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
| Mascota 3D, saludo y clic en producción (cliente) | Verificado 2026-10-05 (SHA `d72e6764`) |
| El chat real responde desde el widget en producción | Verificado 2026-10-05, un tenant y un rol |
| Formato markdown de las respuestas del widget flotante | Pendiente de despliegue (#790) |
| Fallo del chat visible con reintento, timeout y cancelación al cambiar de página | Implementado (H06); pendiente de mergear y desplegar |
| Foco visible, "reducir movimiento" dinámico y pérdida de WebGL con respaldo | Implementado (H09); pendiente de mergear y desplegar |
| Estados de la mascota alimentados por eventos del runtime y "completado" solo con recibo | Pendiente (depende de la observabilidad por tool call, H05) |
| Rendimiento en móviles de gama baja; humo ES/EN móvil y escritorio con roles autorizados | Pendiente |

## 5. Rollback

Revertir el PR restaura el lanzador de imagen y el widget anterior. No hay
migraciones ni cambios de API.
