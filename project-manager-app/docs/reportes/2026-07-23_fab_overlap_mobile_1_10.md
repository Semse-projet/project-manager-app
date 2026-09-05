# Reporte — Remediación 1.10: FAB de asistente tapa propuesta en mobile

**Fecha:** 2026-07-23  
**Repositorio:** Semse-projet/project-manager-app  
**Ítem:** `docs/AUDIT_REMEDIATION_PLAN.md` — Sección 1, ítem 1.10 (MEDIO)  
**Autor:** Devin

## Problema

En `/client/jobs/[jobId]` el FAB flotante de Prometeo Copilot (`fixed bottom-24 right-6`, 56px de diámetro) quedaba posicionado sobre el contenido inferior de la página en viewports estrechos (~390-500px), pudiendo tapar el monto de una propuesta mostrado en la tarjeta de bid más baja.

## Solución

Se agregó padding inferior adicional al contenedor raíz de la página únicamente en mobile mediante la clase Tailwind `pb-24 md:pb-0` en `apps/web/app/(app)/client/jobs/[jobId]/page.tsx`.

- `pb-24` (padding-bottom 96px) aplica en viewports por debajo de `md` (768px), dejando espacio suficiente para que el FAB no se superponga con el último contenido.
- `md:pb-0` mantiene el padding normal del layout en desktop, donde el ancho disponible hace que la superposición no sea un problema.

## Archivos modificados

- `apps/web/app/(app)/client/jobs/[jobId]/page.tsx`
  - Agregado `className="pb-24 md:pb-0"` al `<div>` raíz de la página.
- `docs/AUDIT_REMEDIATION_PLAN.md`
  - Marcado 1.10 como `[x]`.

## Validación

| Comando | Resultado |
|---------|-----------|
| `pnpm --filter @semse/web lint` | 0 errores, 54 warnings preexistentes |
| `pnpm typecheck` | Pasa |
| `pnpm build:web` | Pasa (402/402 páginas estáticas) |
| `pnpm test:unit` | 944 pass / 0 fail |
| `pnpm spec:validate:strict` | 0 errores |

## Notas y riesgos

- El fix es local a la página de detalle del trabajo cliente; no afecta el posicionamiento del FAB en otras rutas.
- Queda **pendiente verificación en vivo** en un dispositivo/viewport de ~390-500px para confirmar que el monto de la última propuesta ya no queda detrás del FAB.
