import "reflect-metadata";
process.stdout.write(`[main] process started pid=${process.pid} node=${process.version} env=${process.env.NODE_ENV}\n`);
// Load .env before NestJS bootstraps so providers (LLM, etc.) get keys at construction time
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const _mainDir = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(_mainDir, "..", ".env"), override: false });
dotenvConfig({ path: resolve(_mainDir, "..", "..", "..", "packages", "db", ".env"), override: false });

import fastifyCors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SEMSE_BOOTSTRAP_HEADER_NAME, SEMSE_IDENTITY_HEADER_NAMES, SEMSE_REQUEST_HEADER_NAMES } from "@semse/shared";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./common/http-exception.filter.js";
import { MetricsService } from "./infrastructure/observability/metrics.service.js";
import { runWithObservabilityContext } from "./infrastructure/observability/request-context.store.js";
import { SemseLoggerService } from "./infrastructure/observability/semse-logger.service.js";
import { resolveRequestId } from "./common/request-id.js";

type ObservableRequest = FastifyRequest & {
  requestId?: string;
  startedAt?: number;
  routerPath?: string;
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false })
  );

  const logger = app.get(SemseLoggerService);
  const metricsService = app.get(MetricsService);
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";
  const corsOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  app.useGlobalFilters(new HttpExceptionFilter(logger));
  app.useLogger(false);
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  });
  await app.register(fastifyCors, {
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      SEMSE_REQUEST_HEADER_NAMES.authorization,
      SEMSE_BOOTSTRAP_HEADER_NAME,
      SEMSE_REQUEST_HEADER_NAMES.contentType,
      SEMSE_IDENTITY_HEADER_NAMES.orgId,
      SEMSE_REQUEST_HEADER_NAMES.requestId,
      SEMSE_IDENTITY_HEADER_NAMES.roles,
      SEMSE_IDENTITY_HEADER_NAMES.tenantId,
      SEMSE_IDENTITY_HEADER_NAMES.userId
    ]
  });
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook("onRequest", (request: ObservableRequest, reply: FastifyReply, done: () => void) => {
    const requestId = resolveRequestId(request.headers ?? {});
    request.requestId = requestId;
    request.startedAt = Date.now();
    reply.header("x-request-id", requestId);
    runWithObservabilityContext(
      {
        requestId,
        correlationId:
          typeof request.headers?.["x-correlation-id"] === "string"
            ? request.headers["x-correlation-id"]
            : undefined,
        method: request.method,
        path: request.url
      },
      () => done()
    );
  });
  fastify.addHook("onResponse", (request: ObservableRequest, reply: FastifyReply, done: () => void) => {
    const durationMs = Math.max(0, Date.now() - Number(request.startedAt ?? Date.now()));
    metricsService.recordHttpRequest({
      method: request.method,
      route: request.routerPath ?? request.url,
      statusCode: reply.statusCode,
      durationMs
    });
    logger.info("http_request_completed", {
      requestId: request.requestId,
      method: request.method,
      path: request.routerPath ?? request.url,
      statusCode: reply.statusCode,
      durationMs
    });
    done();
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("SEMSE API")
    .setDescription("Operational API for the SEMSE platform runtime")
    .setVersion("1.0.0")
    .addBearerAuth()
    .addSecurityRequirements("bearer")
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("v1/docs", app, swaggerDocument, {
    jsonDocumentUrl: "v1/docs-json"
  });

  await app.listen(port, host);
  logger.info("api_bootstrap_complete", { host, port, docsPath: "/v1/docs", docsJsonPath: "/v1/docs-json" });
}

bootstrap().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      message: "fatal_bootstrap_error",
      error: error instanceof Error ? error.message : String(error)
    })}\n`
  );
  process.exit(1);
});
