import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import prismaClientPackage from "../../../../../node_modules/.prisma/client/index.js";

const { PrismaClient } = prismaClientPackage as typeof import("../../../../../node_modules/.prisma/client/index.js");

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    const baseUrl = configService.getOrThrow<string>("DATABASE_URL");
    // Add pool limits to prevent Railway Postgres connection exhaustion.
    // connection_limit=5: max connections per API instance
    // pool_timeout=8: fail-fast after 8s instead of hanging 15s+
    const url = baseUrl.includes("connection_limit")
      ? baseUrl
      : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}connection_limit=5&pool_timeout=8`;

    super({
      datasources: { db: { url } },
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
