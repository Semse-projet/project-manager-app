import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import prismaClientPackage from "../../../../../node_modules/.prisma/client/index.js";

const { PrismaClient } = prismaClientPackage as typeof import("../../../../../node_modules/.prisma/client/index.js");

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    super({
      datasources: {
        db: { url: configService.getOrThrow<string>("DATABASE_URL") }
      },
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
