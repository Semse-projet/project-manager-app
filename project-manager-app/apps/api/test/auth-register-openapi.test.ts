import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { authRegisterBodySchema } from "@semse/schemas";
import { AuthController } from "../dist/modules/auth/auth.controller.js";
import { AuthService } from "../dist/modules/auth/auth.service.js";

test("public registration exposes a JSON body matching its runtime schema and needs no bearer token", async () => {
  class RegistrationDocsModule {}
  Module({
    controllers: [AuthController],
    providers: [{ provide: AuthService, useValue: {} }],
  })(RegistrationDocsModule);

  const app = await NestFactory.create(RegistrationDocsModule, new FastifyAdapter(), { logger: false });
  try {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder()
      .setTitle("SEMSE API")
      .addBearerAuth()
      .addSecurityRequirements("bearer")
      .build());
    const operation = document.paths["/v1/auth/register"]?.post;
    assert.ok(operation);
    assert.deepEqual(document.security, [{ bearer: [] }]);
    assert.deepEqual(operation.security, []);
    const body = operation.requestBody;
    assert.ok(body && !("$ref" in body));
    assert.equal(body.required, true);
    const schema = body.content["application/json"]?.schema;
    assert.ok(schema && !("$ref" in schema));
    assert.equal(schema.type, "object");
    assert.deepEqual(schema.required, ["email", "password", "name"]);
    assert.deepEqual(schema.properties?.email, { type: "string", format: "email" });
    assert.deepEqual(schema.properties?.password, {
      type: "string", format: "password", minLength: 15, maxLength: 128, writeOnly: true,
    });
    const nameSchema = schema.properties?.name;
    assert.ok(nameSchema && !("$ref" in nameSchema));
    assert.equal(nameSchema.type, "string");
    assert.ok(nameSchema.pattern);
    const namePattern = new RegExp(nameSchema.pattern);
    assert.deepEqual(schema.properties?.role, { type: "string", enum: ["CLIENT", "PRO"], default: "CLIENT" });
    const input = { email: "worker-test@example.invalid", password: "synthetic-only-12345", name: "Pilot Test" };
    assert.equal(authRegisterBodySchema.parse(input).role, "CLIENT");
    for (const name of ["", "   ", "\t\n", "A", "  A  ", " Pilot Test ", "x".repeat(80), "x".repeat(81), "  " + "x".repeat(80) + "  "]) {
      assert.equal(namePattern.test(name), authRegisterBodySchema.safeParse({ ...input, name }).success, JSON.stringify(name));
    }
    assert.equal(authRegisterBodySchema.safeParse({ ...input, role: "PRO" }).success, true);
    assert.equal(authRegisterBodySchema.safeParse({ ...input, role: "WORKER" }).success, false);
    assert.equal(authRegisterBodySchema.safeParse({ ...input, password: "x".repeat(14) }).success, false);
    assert.equal(authRegisterBodySchema.safeParse({ ...input, password: "x".repeat(15) }).success, true);
    assert.equal(authRegisterBodySchema.safeParse({ ...input, password: "x".repeat(129) }).success, false);
  } finally {
    await app.close();
  }
});
