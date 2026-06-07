import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import prismaClientPackage from "../../../../../node_modules/.prisma/client/index.js";

const { PrismaClient } = prismaClientPackage as typeof import("../../../../../node_modules/.prisma/client/index.js");

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    super({
      datasources: {
        db: { url: configService.getOrThrow<string>("DATABASE_URL") }
      },
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
    });
  }

  async onModuleInit(): Promise<void> {
    // Non-blocking connect — Prisma reconnects lazily on first query.
    // Blocking $connect() caused NestJS startup to hang when DB was slow,
    // preventing Fastify from ever listening → Railway healthcheck 502.
    this.$connect()
      .then(() => this.logger.log("Prisma connected"))
      .catch((err: unknown) => {
        this.logger.error(`Prisma connect failed: ${(err as Error)?.message ?? String(err)}`);
      });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
