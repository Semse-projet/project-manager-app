# SEMSE Mobile Authority Map

## Que decide esta app

- layout movil;
- jerarquia de navegacion movil;
- composicion visual de flujos worker, client y dev;
- adaptacion ergonomica para uso en pantallas pequenas;
- orchestration local de vistas y widgets.

## Que no decide esta app

- modelo final de dominio;
- permisos canonicos;
- lifecycle de jobs, milestones, disputes o travel;
- contratos API;
- politicas de memoria y auditoria;
- estructura soberana del ecosistema.

## Fuentes de autoridad

| Capa | Autoridad |
|---|---|
| Vision y estrategia | `/home/yoni/labsemse/vision`, `/home/yoni/labsemse/program` |
| Constitucion del ecosistema | `/home/yoni/labsemse/constitution` |
| Tipos y contratos | `/home/yoni/labsemse/project-manager-app/packages/schemas/src` |
| Dominio persistente | `/home/yoni/labsemse/project-manager-app/packages/db/prisma/schema.prisma` |
| API y auth | `/home/yoni/labsemse/project-manager-app/apps/api/src` |
| Frontend canonico web | `/home/yoni/labsemse/project-manager-app/apps/web` |
| Canon movil local | `semse-mobile-app/canon/` |

## Mando operativo por superficie

| Superficie | Autoridad primaria |
|---|---|
| Worker mobile | `FieldOps`, `Travel`, `Evidence`, `Tasks`, `Incidents`, `Payments` |
| Client mobile | `Jobs`, `Matching`, `Projects`, `Milestones`, `Disputes`, `Ratings` |
| Dev portal | `docs/`, `ops`, `domain-events`, `agents`, `autonomy`, `knowledge` |
