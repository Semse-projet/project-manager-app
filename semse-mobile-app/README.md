# SEMSE Mobile App

- Estado: activo como base movil extraida desde `Agent_Desarrollo SEMSEapp.zip`
- Ubicacion estable: `labsemse/semse-mobile-app`
- Tipo: app Vite + React + TypeScript independiente del monorepo canonico

## Proposito

Esta app funciona como superficie movil de `SEMSEproject`.

Hoy no reemplaza al frontend canonico de `project-manager-app/apps/web`.
Su funcion actual es:

- preservar y evolucionar la experiencia movil;
- servir como fuente de extraccion UX;
- integrarse por partes con el backend real de `SEMSE`;
- converger despues hacia una integracion mas formal dentro del ecosistema.

## Superficies incluidas

- `professional / worker`
- `client`
- `dev portal`

## Stack

- Vite
- React 19
- TypeScript
- React Router
- Zustand
- Tailwind CSS
- shadcn/ui + Radix

## Ejecutar localmente

```bash
cd /home/yoni/labsemse/semse-mobile-app
npm install
npm run dev -- --host 127.0.0.1 --port 4173
```

## Notas tecnicas

- la app fue corregida para evitar doble `BrowserRouter`
- hoy usa `mockData.ts` y `clientMockData.ts` como fuente principal
- no esta conectada aun al backend canonico
- la integracion debe hacerse de forma quirurgica para reutilizar toda la UX sin duplicar dominio

## Documentos utiles

- [`SEMSE_MOBILE_INTEGRATION_AUDIT.md`](/home/yoni/labsemse/semse-mobile-app/SEMSE_MOBILE_INTEGRATION_AUDIT.md)
- [`/home/yoni/labsemse/project-manager-app/docs/SOURCE_OF_TRUTH.md`](/home/yoni/labsemse/project-manager-app/docs/SOURCE_OF_TRUTH.md)
- [`/home/yoni/labsemse/README.md`](/home/yoni/labsemse/README.md)
