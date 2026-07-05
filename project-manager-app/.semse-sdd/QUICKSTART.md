# Quickstart — Cómo usar el kit en SEMSEproject

## 1. Ubicación recomendada

Dentro del repo `project-manager-app`, coloca el kit como carpeta oculta:

```bash
project-manager-app/
└── .semse-sdd/
```

## 2. Primer comando para Codex

Pega este objetivo:

```txt
Lee .semse-sdd/README.md, .semse-sdd/docs/00_ecosystem_architecture.md y .semse-sdd/prompts/00_codex_start_here.txt. No modifiques código todavía. Primero entrega una auditoría de rutas, módulos, layouts, navegación, imports frágiles y riesgos.
```

## 3. Orden obligatorio

```txt
1. Auditar
2. Crear spec de la fase
3. Crear plan técnico
4. Crear tasks
5. Implementar mínimo viable
6. Validar typecheck/build
7. Abrir PR pequeño
8. Esperar Railway verde
```

## 4. Qué NO debe hacer Codex en la primera fase

- No tocar Prisma.
- No cambiar backend.
- No borrar rutas viejas.
- No cambiar Railway.
- No hacer refactor masivo.
- No mover 100 archivos en un solo commit.

