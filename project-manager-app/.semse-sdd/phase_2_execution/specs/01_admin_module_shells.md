# Spec — Admin Module Shells

## Problema

El Admin de SEMSEproject contiene muchas rutas útiles, pero visualmente se sienten como páginas aisladas. El usuario necesita entrar a un módulo y entender qué submódulos existen, qué está activo y cuál es la siguiente acción.

## Objetivo

Crear shells por módulo que funcionen como hubs.

## Rutas objetivo

```txt
/admin/mission-control
/admin/workops
/admin/marketplace
/admin/finance
/admin/trust
/admin/intelligence
/admin/tool-hub
/admin/verticals
/admin/settings
```

En esta fase, solo crear shells nuevos para las rutas que no existen y actualizar Mission Control.

## Comportamiento esperado

Cuando el usuario selecciona un módulo:

1. Se resalta el módulo en el sidebar.
2. Se abre una pantalla hub.
3. La pantalla muestra las rutas hijas como tarjetas.
4. Cada tarjeta abre una ruta legacy existente o una nueva ruta shell.
5. El usuario puede volver al Mission Control.

## Datos mínimos del módulo

```ts
export type AdminModule = {
  id: string;
  label: string;
  href: string;
  description: string;
  status: 'operational' | 'attention' | 'planned' | 'disabled';
  metric?: {
    label: string;
    value: string;
  };
  children: Array<{
    label: string;
    href: string;
    description?: string;
    status?: 'operational' | 'attention' | 'planned' | 'disabled';
  }>;
};
```

## Criterios de aceptación

- TypeScript sin errores.
- No hay cambios destructivos.
- Rutas legacy siguen disponibles.
- Nuevas rutas muestran UI útil.
- Diseño mantiene estética dark enterprise.
