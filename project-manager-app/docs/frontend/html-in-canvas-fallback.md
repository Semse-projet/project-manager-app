# HTML-in-Canvas fallback

`HtmlInCanvasPanel` is a progressive enhancement wrapper:

- Browsers with native HTML-in-Canvas support use `layoutsubtree`, `canvas.requestPaint()`, and `ctx.drawElementImage(...)`.
- Browsers without native support render the same children as normal DOM.
- `capture()` returns a PNG in both modes when possible. Native mode uses `canvas.toBlob()`. Fallback mode serializes the visible DOM into an SVG `foreignObject`, draws that SVG into a temporary canvas, and calls `toBlob()`.

## Fallback limits

The DOM fallback is intended for operational UI cards, panels, and reports. It is not a full browser screenshot engine.

Known limits:

- Cross-origin images can fail or taint the temporary canvas unless the remote server allows CORS.
- Web fonts may render differently if they are not fully loaded when `capture()` runs.
- Pseudo-elements such as `::before` and `::after` are not cloned as real DOM nodes.
- Nested `<canvas>`, `<video>`, and animated media may not serialize reliably.
- Complex effects such as `filter`, `backdrop-filter`, blend modes, and active animations may degrade by browser.
- Safari can be stricter with SVG `foreignObject` rendering than Chromium.

The fallback is defensive: image load failures, tainted canvas errors, missing dimensions, and oversized captures return `null` instead of throwing. Callers should show an export error only when `capture()` returns `null`.
