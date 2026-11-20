# Preview estática de SEMSE Digital Twin

Genera una entrega navegable de la ruta histórica sin Next.js, Docker, API ni workspace pnpm. Reutiliza los componentes, la topología y los estilos del repositorio; no duplica ni sustituye sus datos.

```sh
npm ci
npm run typecheck
npm run build
npm run preview
```

`npm run typecheck` valida los componentes sincronizados con TypeScript estricto y sin emitir archivos. Tanto esta comprobación como el build vuelven a sincronizar las fuentes antes de ejecutarse.

El resultado predeterminado queda en `dist/` y usa rutas relativas. Para una integración que sirva los assets desde un prefijo:

```sh
SEMSE_PREVIEW_BASE=/static-preview/ \
SEMSE_PREVIEW_OUT_DIR=/ruta/de/salida \
npm run build
```

`SEMSE_REPO_ROOT` permite indicar otra raíz del monorepo. El script de sincronización copia únicamente los archivos declarados del gemelo y `globals.css` a `.sources/`, carpeta ignorada por Git. No lee variables de entorno de producción ni archivos `.env`.
