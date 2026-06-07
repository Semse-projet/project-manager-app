# dist/ — Audit Report

**Fecha:** 2026-04-27
**Ruta:** `/home/yoni/labsemse/dist/`
**Tamaño:** 1.7 MB

---

## Contenido

```
dist/
  assets/
    index-BDKQYlq7.css    ← CSS compilado (Tailwind purged)
    index-MNW0buFw.js     ← JS bundle minificado
  index.html              ← Entry point HTML de Vite
```

## Análisis

| Archivo | Tipo | Assets únicos | Source maps | Valor rescatable |
|---|---|---|---|---|
| `index-*.css` | Build artifact | No | No | Ninguno — reproducible desde `src/index.css` + `tailwind.config.js` |
| `index-*.js` | Build artifact | No | No | Ninguno — minificado sin mapas, no legible |
| `index.html` | Build artifact | No | N/A | Ninguno — boilerplate Vite standard |

## Conclusión

`dist/` es **100% reproducible** desde `src/` ejecutando `npm run build` en el Vite app raíz.

- No contiene imágenes, iconos ni assets únicos que no existan en `src/`
- No tiene source maps que permitan recuperar código perdido
- El CSS compilado no aporta tokens nuevos no presentes en `src/index.css`

## Recomendación

**Archivar o eliminar.** `dist/` no tiene valor documental ni técnico independiente.

Fue movido a: `/home/yoni/labsemse/archive/legacy-src/dist/`
