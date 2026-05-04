# Diagnostico de Dependencias Labsemse - 2026-04-06

## Objetivo

Analizar toda la carpeta `labsemse` para localizar dónde viven realmente:

- `nest`
- `typescript`
- `node_modules/.bin`
- `package-lock` o fuente de instalación válida

y determinar si hace falta mover algo o reconstruir dependencias en el lugar correcto.

---

## Veredicto

El problema no es que falten dependencias en todo `labsemse`.
El problema es que el monorepo canónico:

- `/home/yoni/labsemse/project-manager-app`

tiene una instalación de `node_modules` incompleta o dañada.

Más específicamente:

- sí tiene paquetes como `@nestjs/cli`, `@nestjs/common`, `typescript`, `@semse/*`;
- no tiene `node_modules/.bin`;
- no tiene lockfile propio visible;
- no tiene `.package-lock.json` dentro de `node_modules`;
- por eso `npm run build:api` no encuentra `nest`.

---

## Hallazgos por zona

## 1. `labsemse/` raíz

Ruta:

- `/home/yoni/labsemse`

Estado:

- tiene `node_modules/.bin`
- tiene `typescript/bin/tsc`
- no tiene `nest`
- su `package.json` corresponde a una app Vite / React, no al monorepo canónico

Conclusión:

- no sirve como fuente correcta para el backend NestJS del core.

---

## 2. `labsemse_project/` raíz

Ruta:

- `/home/yoni/labsemse`

Estado:

- también corresponde a una app Vite
- su `package.json` y `package-lock.json` no son del monorepo `project-manager-app`

Conclusión:

- tampoco sirve como base de instalación del core.

---

## 3. Monorepo canónico actual

Ruta:

- `/home/yoni/labsemse/project-manager-app`

Estado:

- sí contiene `apps/api`, `apps/web`, `apps/worker`, `packages/*`
- sí tiene `node_modules` grande y con paquetes correctos
- sí tiene:
  - `node_modules/@nestjs/cli/package.json`
  - `node_modules/typescript/package.json`
- no tiene:
  - `node_modules/.bin`
  - `.package-lock.json`
  - `package-lock.json`
  - `pnpm-lock.yaml`
  - `yarn.lock`

Consecuencia:

- el repo tiene dependencias materiales pero sin los binarios enlazados del workspace;
- por eso scripts como `nest build` fallan aunque el paquete exista.

---

## 4. Satélite útil como referencia

Ruta:

- `/home/yoni/labsemse/app semse/_satellites-archive/project-manager-copi`

Estado:

- tiene el mismo tipo de monorepo `project-manager-app`
- tiene `package-lock.json`
- tiene `node_modules/.bin/nest`
- tiene `node_modules/.bin/tsc`
- tiene `.package-lock.json`

Conclusión:

- es la mejor referencia local para reconstruir la instalación del core;
- no debe convertirse en fuente canónica de código;
- sí puede usarse como referencia de dependencias y layout de instalación.

---

## Señal clave

El `node_modules` del core pesa casi lo mismo que el del satélite funcional.
Eso sugiere una instalación copiada o reconstruida sin archivos ocultos.

Archivos ocultos críticos ausentes en el core:

- `node_modules/.bin`
- `node_modules/.package-lock.json`

Es exactamente lo que rompe la ejecución de scripts CLI.

---

## Qué NO conviene hacer

1. No usar `labsemse/` raíz como fuente de `nest`.
2. No copiar todo el `node_modules` del satélite sobre el core.
3. No mezclar lockfiles de apps Vite con el monorepo Nest/Next.
4. No seguir avanzando builds del core sin arreglar antes la instalación del workspace.

---

## Qué sí conviene hacer

### Opción correcta preferida

Reconstruir el workspace de:

- `/home/yoni/labsemse/project-manager-app`

usando una instalación limpia de dependencias.

### Si se quiere evitar red o reinstalación completa

Usar el satélite `project-manager-copi` solo como referencia para restaurar:

- `package-lock.json`
- `node_modules/.bin`
- `node_modules/.package-lock.json`

pero esto debe hacerse con cuidado porque puede introducir drift de versiones.

### Opción más sólida

1. restaurar o crear lockfile del monorepo canónico;
2. correr instalación del workspace en el core;
3. validar que reaparezcan:
   - `node_modules/.bin/nest`
   - `node_modules/.bin/tsc`
4. recién después continuar con compilación y smoke tests.

---

## Recomendación ejecutiva

La necesidad real no es "mover nest".
La necesidad real es:

**reparar la instalación del workspace del monorepo canónico**

porque el core ya tiene casi todo el contenido, pero está incompleto a nivel de artefactos de instalación.

---

## Ejecución aplicada después del diagnóstico

### Reparación mínima ejecutada

En el core:

- `/home/yoni/labsemse/project-manager-app`

se recreó:

- `node_modules/.bin/nest`
- `node_modules/.bin/tsc`
- `node_modules/.bin/tsserver`
- `node_modules/.bin/prisma`

También se corrigió permiso de ejecución en:

- `node_modules/@nestjs/cli/bin/nest.js`

Resultado:

- el repo dejó de fallar por "nest not found";
- el build avanzó a errores reales del workspace.

### Reconstrucción completa ejecutada

Se ejecutó:

- `npm install --workspaces`
- `npm run build --workspace @semse/agents`
- `npm run prisma:generate --workspace @semse/db`

Resultado:

- el workspace quedó reinstalado;
- `@semse/agents` quedó compilado;
- Prisma Client se regeneró;
- se confirmó que el problema original ya no es ubicación de dependencias.

### Hallazgo final posterior

Tras reparar dependencias e instalación, el bloqueo residual es:

- `Maximum call stack size exceeded` en TypeScript / Nest build

Conclusión final actualizada:

- la fase de dependencias quedó sustancialmente corregida;
- el siguiente bloqueo ya no es de instalación sino de tipado/compilación del backend.
