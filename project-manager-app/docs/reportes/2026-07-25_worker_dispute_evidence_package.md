# Worker 2.45 — paquete real de evidencia de disputa

Fecha: 2026-07-25
Plan: `2.45 MEDIO`
Specs: `api-evidence-upload-review` v1.1, `ui.pro-flows-remediation` v1.7

## Resultado

- El nombre y el tamaño declarados manualmente se reemplazaron por
  `<input type="file">`.
- `planUpload` recibe nombre, MIME y bytes del `File` seleccionado.
- La estrategia `single_put` usa la `key` real y envía el archivo como cuerpo
  al proxy BFF autenticado.
- La UI solo confirma éxito y muestra el enlace después de un `PUT` exitoso.
- `external_transfer` falla con una explicación honesta mientras el multipart
  del backend no persista bytes.
- Se eliminaron la creación de partes y los ETags ficticios del workspace.

## Validación

- [x] 4/4 pruebas focales.
- [x] TypeScript web.
- [x] ESLint focal: 0 errores; 3 advertencias preexistentes del componente.
- [x] ESLint web completo: 0 errores; 54 advertencias preexistentes.
- [x] Validación estricta de specs: 105 archivos, 0 errores y 0 advertencias.
- [x] Cobertura del plan: 159/159 hallazgos, sin faltantes ni extras.
- [ ] Verificación live del objeto en storage.

No se hizo push, deploy ni mutación de producción.
