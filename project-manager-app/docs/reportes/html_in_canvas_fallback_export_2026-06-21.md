# Reporte: HTML-in-Canvas con fallback DOM para exportar PNG

Fecha local del workspace: 2026-06-21

## Resumen

Se cerro la feature de exportacion PNG para `HtmlInCanvasPanel` como progressive enhancement:

- Si el navegador expone HTML-in-Canvas nativo, el componente usa `layoutsubtree`, `canvas.requestPaint()` y `ctx.drawElementImage(...)`.
- Si el navegador no expone la API nativa, el componente mantiene DOM normal y `capture()` usa fallback DOM con SVG `foreignObject` para generar PNG.
- La pagina `/admin/html-in-canvas` ya no presenta el fallback como error. El estado normal sin flag es `Modo fallback DOM activo`.
- El error visible solo debe aparecer si `capture()` devuelve `null`.

## Archivos relevantes

- `project-manager-app/packages/ui/src/components/HtmlInCanvasPanel.tsx`
- `project-manager-app/apps/web/app/(app)/admin/html-in-canvas/page.tsx`
- `project-manager-app/docs/frontend/html-in-canvas-fallback.md`

## Estado del workspace

Estado al guardar este reporte:

```text
 M project-manager-app/packages/ui/src/components/HtmlInCanvasPanel.tsx
?? project-manager-app/docs/frontend/html-in-canvas-fallback.md
```

Nota: no se hizo commit.

## Cambios funcionales confirmados

### Fallback DOM

El fallback ya no depende de `chrome://flags/#canvas-draw-element`.

El flujo de `capture()` en fallback:

1. Clona el elemento DOM visible.
2. Copia estilos computados al clon.
3. Sincroniza estado de inputs, textareas y selects.
4. Serializa el clon dentro de un SVG `foreignObject`.
5. Usa `data:image/svg+xml` en vez de `blob:` URL para evitar canvas tainted en Chromium.
6. Dibuja la imagen SVG en un canvas temporal.
7. Exporta PNG con `canvas.toBlob()`.

Hallazgo importante:

- `blob:` URL + SVG `foreignObject` cargo la imagen, pero `canvas.toBlob()` fallo con `SecurityError: Tainted canvases may not be exported`.
- `data:image/svg+xml;charset=utf-8,...` si permitio `toBlob()` en Chromium.

### Modo nativo

Con `--enable-blink-features=CanvasDrawElement`, Chromium expone:

```json
{
  "requestPaint": "function",
  "drawElementImage": "function",
  "layoutSubtree": true
}
```

Se agrego manejo defensivo porque `drawElementImage(...)` puede lanzar:

```text
No cached paint record for element.
```

El componente ahora:

- reintenta el paint nativo brevemente;
- evita propagar pageerrors;
- marca el canvas nativo como listo solo cuando `drawElementImage` termina sin error;
- si `capture()` se llama antes de que el paint nativo este listo, cae al fallback DOM en vez de fallar.

## Validaciones realizadas

### TypeScript

Comando:

```bash
pnpm exec tsc --noEmit --project apps/web/tsconfig.json
```

Resultado:

```text
OK
```

### Chromium normal, sin flag

Prueba Playwright local con login demo admin por API:

- URL: `http://localhost:3000/admin/html-in-canvas`
- Credenciales demo usadas: `admin@demo.semse` / `demo1234`

Resultado:

```json
{
  "ok": true,
  "modeBefore": {
    "enabledPanels": 0,
    "fallbackPanels": 4,
    "fallbackText": true
  },
  "errorCount": 0,
  "downloadHrefPrefix": "blob:http://localhos"
}
```

Conclusion:

- fallback activo;
- exportacion PNG funcional;
- aparece link `Descargar PNG`;
- no aparece error de exportacion.

### Chromium con CanvasDrawElement

Prueba Playwright local con:

```text
--enable-blink-features=CanvasDrawElement
```

Resultado de activacion:

```json
{
  "requestPaint": "function",
  "drawElementImage": "function",
  "enabledPanels": 4,
  "fallbackPanels": 0,
  "fallbackText": false,
  "nativeText": true
}
```

Resultado de exportacion:

```json
{
  "ok": true,
  "modeBefore": {
    "enabledPanels": 4,
    "fallbackPanels": 0,
    "nativeText": true
  },
  "errorCount": 0,
  "pageErrors": [],
  "downloadHrefPrefix": "blob:http://localhos"
}
```

Conclusion:

- modo nativo activo;
- exportacion PNG funcional;
- no se propagaron pageerrors;
- aparece link `Descargar PNG`.

## Pendientes separados

### Build Next

Comando investigado:

```bash
timeout 180s pnpm --filter @semse/web exec next build --debug
```

Resultado:

```text
Creating an optimized production build ...
```

El proceso expiro sin logs adicionales.

Conclusion:

- Se mantiene como problema global separado del feature.
- No se mezclo fix de build con este cambio.

### Lint

El lint sigue bloqueado por configuracion global:

```text
ESLint 10 / eslint-config-next / @rushstack/eslint-patch
Failed to patch ESLint because the calling module was not recognized.
```

Conclusion:

- No se modifico configuracion de lint en este feature.
- Debe tratarse como fix separado.

### Warnings no relacionados vistos en dev

Durante las pruebas aparecieron warnings/errores no relacionados con `HtmlInCanvasPanel`:

- `Each child in a list should have a unique "key" prop` en `AppLayoutInner`.
- `metadataBase property in metadata export is not set`.
- CSP bloqueando Google Fonts:

```text
Loading the stylesheet 'https://fonts.googleapis.com/...' violates Content Security Policy "style-src 'self' 'unsafe-inline'".
```

- Endpoints locales de notificaciones/SSE devolviendo `502`/`503` en dev.

Estos puntos no se arreglaron en este cambio.

## Limites documentados del fallback

Se agrego nota en:

```text
docs/frontend/html-in-canvas-fallback.md
```

Limites principales:

- imagenes cross-origin pueden fallar o contaminar el canvas si no hay CORS;
- fuentes web pueden variar si no estan cargadas;
- pseudo-elementos `::before` / `::after` no se clonan como nodos reales;
- `<canvas>`, `<video>` y media animada no siempre serializan bien;
- efectos complejos como `filter`, `backdrop-filter`, blend modes y animaciones pueden degradarse;
- Safari puede ser mas estricto con `foreignObject`.

## Proximo paso recomendado al volver

1. Revisar el diff final:

```bash
git diff -- project-manager-app/packages/ui/src/components/HtmlInCanvasPanel.tsx
git diff -- project-manager-app/docs/frontend/html-in-canvas-fallback.md
```

2. Agregar los archivos:

```bash
git add project-manager-app/packages/ui/src/components/HtmlInCanvasPanel.tsx
git add project-manager-app/docs/frontend/html-in-canvas-fallback.md
git add project-manager-app/docs/reportes/html_in_canvas_fallback_export_2026-06-21.md
```

3. Commit sugerido:

```bash
git commit -m "feat(ui): harden HTML canvas panel PNG export fallback"
```

4. Mantener build/lint como tareas separadas.

