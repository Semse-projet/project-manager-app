import "reflect-metadata";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import ts from "typescript";
import { AUTHENTICATED_ACCESS_KEY, REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { IS_PUBLIC_KEY } from "../src/common/public.decorator.ts";
import { RbacGuard } from "../dist/common/rbac.guard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiSrcRoot = path.resolve(__dirname, "../src");
const httpDecorators = new Set(["Get", "Post", "Put", "Patch", "Delete", "Head", "Options", "All"]);
const accessDecorators = new Set(["Public", "RequirePermissions", "AuthenticatedAccess"]);

function walkControllers(dir: string): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkControllers(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".controller.ts")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function decoratorName(decorator: ts.Decorator): string | undefined {
  const expression = decorator.expression;
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isCallExpression(expression)) {
    const callee = expression.expression;
    if (ts.isIdentifier(callee)) {
      return callee.text;
    }
    if (ts.isPropertyAccessExpression(callee)) {
      return callee.name.text;
    }
  }

  return undefined;
}

function decorators(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
}

function hasDecorator(node: ts.Node, names: Set<string>): boolean {
  return decorators(node).some((decorator) => {
    const name = decoratorName(decorator);
    return name ? names.has(name) : false;
  });
}

function methodName(member: ts.MethodDeclaration, sourceFile: ts.SourceFile): string {
  return ts.isIdentifier(member.name) ? member.name.text : member.name.getText(sourceFile);
}

function executionContext(handler: Function, controllerClass: Function, roles = ["CLIENT"]) {
  return {
    getHandler: () => handler,
    getClass: () => controllerClass,
    switchToHttp: () => ({
      getRequest: () => ({
        authContext: {
          tenantId: "tenant_1",
          orgId: "org_1",
          userId: "usr_1",
          roles,
        },
      }),
    }),
  } as never;
}

test("rbac audit: every non-public HTTP handler declares explicit access metadata", () => {
  const missing: string[] = [];
  let handlers = 0;

  for (const file of walkControllers(apiSrcRoot)) {
    const sourceFile = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );

    function visit(node: ts.Node) {
      if (ts.isClassDeclaration(node) && node.name && hasDecorator(node, new Set(["Controller"]))) {
        const classHasAccess = hasDecorator(node, accessDecorators);

        for (const member of node.members) {
          if (!ts.isMethodDeclaration(member) || !hasDecorator(member, httpDecorators)) {
            continue;
          }

          handlers += 1;
          if (!classHasAccess && !hasDecorator(member, accessDecorators)) {
            missing.push(`${path.relative(apiSrcRoot, file)}:${node.name.text}.${methodName(member, sourceFile)}`);
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  assert.ok(handlers > 0, "audit should inspect controller HTTP handlers");
  assert.deepEqual(missing, []);
});

test("rbac guard denies authenticated routes without explicit metadata", () => {
  class TestController {
    noMetadata() {}
    authenticated() {}
    readJob() {}
    publicRoute() {}
  }

  Reflect.defineMetadata(AUTHENTICATED_ACCESS_KEY, "test authenticated access", TestController.prototype.authenticated);
  Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, ["jobs:read"], TestController.prototype.readJob);
  Reflect.defineMetadata(IS_PUBLIC_KEY, true, TestController.prototype.publicRoute);

  const guard = new RbacGuard(new Reflector());

  assert.throws(
    () => guard.canActivate(executionContext(TestController.prototype.noMetadata, TestController)),
    (error) => error instanceof ForbiddenException && String(error.message).includes("RBAC metadata required"),
  );
  assert.equal(guard.canActivate(executionContext(TestController.prototype.authenticated, TestController)), true);
  assert.equal(guard.canActivate(executionContext(TestController.prototype.readJob, TestController)), true);
  assert.equal(guard.canActivate(executionContext(TestController.prototype.publicRoute, TestController, [])), true);

  assert.throws(
    () => guard.canActivate(executionContext(TestController.prototype.readJob, TestController, ["WORKER"])),
    (error) => error instanceof ForbiddenException && String(error.message).includes("Insufficient permissions"),
  );
});
