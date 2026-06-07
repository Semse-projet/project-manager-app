# Reanudacion Smart Intake

## Fecha
2026-05-11

## Contexto
Se retomó el trabajo abierto de `smart-intake` después de una interrupción por apagado de la computadora.
El estado local mostraba cambios sin terminar en:

- `apps/api/src/modules/smart-intake/*`
- `apps/web/components/landing/landing-intake.tsx`
- `apps/web/app/(app)/client/jobs/new/page.tsx`
- `apps/web/app/api/semse/public/intake/*`
- `apps/web/app/api/semse/intake/*`
- `packages/db/prisma/schema.prisma`

## Hallazgos al retomar

1. El motor unitario de `smart-intake` ya estaba funcional.
2. Faltaba cerrar el puente real entre:
   - landing publica
   - cookie de sesion del intake
   - claim del draft al entrar al wizard autenticado
3. Faltaba migracion para persistir `ProjectIntake`.
4. El wizard nuevo tenia errores de typecheck y una fuga funcional:
   - intentaba leer en cliente una cookie `httpOnly`
   - no limpiaba el `intake_draft_id` despues de publicar
   - al recuperar el intake no forzaba el avance al paso correcto del wizard

## Cambios hechos

### 1. Recuperacion real del draft

Se corrigio el proxy `claim` para que lea `semse_intake_session` en servidor y no dependa de `document.cookie`.

Archivos:

- `apps/web/app/api/semse/intake/[id]/claim/route.ts`
- `apps/web/hooks/use-intake.ts`
- `apps/web/app/(app)/client/jobs/new/page.tsx`

Resultado:

- el draft anonimo puede reclamarse al iniciar sesion;
- el wizard puede recuperar el intake persistido;
- ya no se rompe por intentar leer una cookie `httpOnly` desde el navegador.

### 2. Reanudacion correcta del wizard

Se ajusto `client/jobs/new` para:

- hidratar usando el draft persistido sin requerir token visible en cliente;
- mover el wizard al paso 3 cuando el intake fue recuperado;
- limpiar `intake_draft_id` al publicar el trabajo.

Resultado:

- el usuario vuelve al wizard con contexto real;
- no queda un draft viejo reaplicandose en futuras publicaciones.

### 3. Correccion de typecheck del proxy publico

Se normalizo el envelope del helper de intake publico.

Archivo:

- `apps/web/app/api/semse/public/intake/_shared.ts`

### 4. Migracion de persistencia

Se agrego la migracion faltante para `ProjectIntake`.

Archivo:

- `packages/db/prisma/migrations/20260511000000_project_intake/migration.sql`

### 5. Regeneracion Prisma

Se regenero Prisma Client para incluir el nuevo modelo.

## Validacion ejecutada

Comandos verificados:

```bash
node --experimental-strip-types --test tests/unit/smart-intake.test.mjs
npm run typecheck
npm run prisma:generate --workspace @semse/db
npm run build:api
npm run build:web
```

Estado:

- unit tests `smart-intake`: OK
- typecheck global: OK
- prisma generate: OK
- build API: OK
- build Web: OK

## Advertencias no bloqueantes observadas

`build:web` sigue mostrando warnings viejos de hooks en otras pantallas no tocadas hoy:

- `app/(app)/admin/travel/page.tsx`
- `app/(app)/client/disputes/page.tsx`
- `app/(app)/client/leads/page.tsx`
- `app/(app)/layout.tsx`
- `app/(app)/worker/disputes/page.tsx`
- `app/(app)/worker/evidence/page.tsx`
- `app/components/disputes/DisputeResolutionWorkspace.tsx`

No bloquean build y no pertenecen al flujo `smart-intake`.

## Estado de salida

El flujo `landing -> smart-intake -> claim -> wizard -> publish` queda integrado y validado a nivel de compilacion y tipado.

## Siguiente foco sugerido

1. aplicar la migracion en base local / entorno activo;
2. correr smoke manual del flujo end-to-end:
   - landing publica
   - responder preguntas
   - subir imagen
   - desbloquear estimate
   - iniciar sesion
   - recuperar draft
   - publicar job
3. si el smoke confirma UX estable, extender `smart-intake` mas alla de `Pintura interior`.
