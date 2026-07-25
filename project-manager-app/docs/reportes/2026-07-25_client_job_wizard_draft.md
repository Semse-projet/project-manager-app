# Client 1.14 — borrador del wizard de publicación

Fecha: 2026-07-25
Plan: `1.14 MEDIO`
Spec primaria: `ui.client-flows-remediation` v1.7

## Resultado

- El wizard guarda paso, intake y campos serializables en `sessionStorage`.
- La clave incluye el `userId`; una cuenta no restaura el borrador de otra.
- El payload tiene versión, validación defensiva y caduca a las 24 horas.
- Un paso guardado se reduce automáticamente si sus prerequisitos no están
  completos.
- El prefill explícito de una URL nueva tiene precedencia sobre el borrador.
- Publicar o usar "Cancelar" elimina el borrador.
- Los archivos locales no se serializan: el navegador advierte antes de un
  refresh y la pantalla informa que deben seleccionarse otra vez si el usuario
  decide continuar.
- La hidratación ocurre después del mount, evitando divergencias SSR/cliente.

## Validación

- [x] 6/6 pruebas focales de parseo, expiración, aislamiento, limpieza y wiring.
- [x] TypeScript web.
- [x] ESLint focal: 0 errores y 0 advertencias.
- [x] ESLint web completo: 0 errores; 54 advertencias preexistentes.
- [x] Plan y spec alineados con 1.14/G-CLI-03.
- [x] Specs estrictas: 105 specs, 0 errores y 0 advertencias.
- [x] Cobertura del plan: 159/159, sin faltantes ni extras.

No se hizo deploy ni consulta a producción.
