# Guardrails — SEMSEproject SDD

## Reglas duras

- [ ] No borrar rutas legacy en Fase 1.
- [ ] No tocar Prisma en Fase 1.
- [ ] No tocar backend en Fase 1.
- [ ] No cambiar Railway en Fase 1.
- [ ] No mezclar refactor masivo con feature nueva.
- [ ] No instalar dependencias sin justificar.
- [ ] No romper TypeScript.
- [ ] No ocultar errores de lint/build.
- [ ] No eliminar tests para pasar CI.
- [ ] No cambiar auth/permisos sin spec.

## Si algo falla

1. Copiar error exacto.
2. Identificar archivo causante.
3. Hacer fix mínimo.
4. Re-ejecutar validación.
5. Documentar riesgo.

