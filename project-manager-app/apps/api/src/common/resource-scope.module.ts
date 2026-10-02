import { Module } from "@nestjs/common";
import { ResourceScopeResolver } from "./resource-scope.resolver.js";

/** C51 etapa 3 — expone el resolver canónico (PrismaService es @Global). */
@Module({
  providers: [ResourceScopeResolver],
  exports: [ResourceScopeResolver],
})
export class ResourceScopeModule {}
