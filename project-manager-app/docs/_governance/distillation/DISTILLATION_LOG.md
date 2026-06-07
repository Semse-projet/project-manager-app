# DISTILLATION LOG — Historial de Destilaciones

> Registro permanente de qué fue destilado, cuándo, qué se rompió, cómo se solucionó.
> Nunca borrar entradas. Solo agregar.

---

## FORMATO DE ENTRADA

```markdown
### [FECHA] — [Origen] → [Destino] — [ESTADO]

**Qué se destiló:** descripción
**Sprint:** X.X
**Build tras destilación:** ✅ Limpio / ❌ Roto
**Smokes tras destilación:** ✅ Pasaron / ❌ Fallaron / ⏳ No ejecutados
**Problemas encontrados:** descripción o "Ninguno"
**Solución:** descripción o "N/A"
**Por qué se hizo:** motivación
**Qué mejoró:** resultado concreto
**Residuos identificados:** qué quedó en el satellite sin usar
```

---

## HISTORIAL

*(Vacío — primer ítem se agregará cuando se ejecute la primera destilación)*

---

## NOTAS PARA AGENTES

- Si completas una destilación exitosa → agrega entrada aquí con estado `EXITOSA`.
- Si algo se rompe → agrega entrada con estado `PARCIAL` o `REVERTIDA` y documenta la solución.
- Si el satellite quedó sin más valor rescatable → actualiza su `STATUS.md` a `FULLY_DISTILLED`.
- Si la destilación descubre nuevo valor en el satellite → agregar ítem a `DISTILLATION_QUEUE.md`.
