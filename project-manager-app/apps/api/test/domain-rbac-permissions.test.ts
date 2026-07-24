import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasPermission } from "../../../packages/auth/src/rbac.ts";
import { AUTHENTICATED_ACCESS_KEY, REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { RbacGuard } from "../dist/common/rbac.guard.js";
import { AnatomyController } from "../dist/modules/anatomy/anatomy.controller.js";
import { KnowledgeController } from "../dist/modules/knowledge/knowledge.controller.js";
import { RepoKnowledgeController } from "../dist/modules/repo-knowledge/repo-knowledge.controller.js";
import { RuntimeKnowledgeController } from "../dist/modules/runtime-knowledge/runtime-knowledge.controller.js";
import { ToolsController } from "../dist/modules/tools/tools.controller.js";
import { VisionController } from "../dist/modules/vision/vision.controller.js";

function classPermission(controller: Function): string[] | undefined {
  return Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, controller);
}

function methodPermission(controller: Function, methodName: string): string[] | undefined {
  return Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, controller.prototype[methodName]);
}

function classAuthenticatedAccess(controller: Function): string | undefined {
  return Reflect.getMetadata(AUTHENTICATED_ACCESS_KEY, controller);
}

function executionContext(handler: Function, controllerClass: Function, roles: string[]) {
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

test("domain RBAC: internal architecture graphs require an admin-only permission", () => {
  for (const controller of [AnatomyController, RepoKnowledgeController, RuntimeKnowledgeController]) {
    assert.deepEqual(classPermission(controller), ["internal:architecture:read"]);
    assert.equal(classAuthenticatedAccess(controller), undefined);
  }
});

test("domain RBAC: knowledge management separates read and write", () => {
  assert.deepEqual(classPermission(KnowledgeController), ["knowledge:read"]);
  assert.equal(classAuthenticatedAccess(KnowledgeController), undefined);
  assert.deepEqual(methodPermission(KnowledgeController, "domains"), ["internal:architecture:read"]);
  assert.deepEqual(methodPermission(KnowledgeController, "overview"), ["internal:architecture:read"]);

  for (const method of ["createSkill", "updateSkillProcedure", "recordSkillUse", "runCuration"]) {
    assert.deepEqual(methodPermission(KnowledgeController, method), ["knowledge:write"], `${method} should require knowledge:write`);
  }
});

test("domain RBAC: CLIENT, PRO, and WORKER receive 403 on internal architecture handlers", () => {
  const guard = new RbacGuard(new Reflector());
  const targets: Array<[Function, Function]> = [
    [AnatomyController.prototype.tree, AnatomyController],
    [RepoKnowledgeController.prototype.tree, RepoKnowledgeController],
    [RuntimeKnowledgeController.prototype.tree, RuntimeKnowledgeController],
    [KnowledgeController.prototype.domains, KnowledgeController],
    [KnowledgeController.prototype.overview, KnowledgeController],
  ];

  assert.equal(hasPermission(["OPS_ADMIN"], "internal:architecture:read"), true);
  for (const role of ["CLIENT", "PRO", "WORKER"]) {
    assert.equal(hasPermission([role], "internal:architecture:read"), false);
    for (const [handler, controller] of targets) {
      assert.throws(
        () => guard.canActivate(executionContext(handler, controller, [role])),
        (error) => error instanceof ForbiddenException && String(error.message).includes("Insufficient permissions"),
      );
    }
  }

  for (const [handler, controller] of targets) {
    assert.equal(guard.canActivate(executionContext(handler, controller, ["OPS_ADMIN"])), true);
  }
});

test("domain RBAC: tools read catalog but run calculators with tools:run", () => {
  assert.deepEqual(classPermission(ToolsController), ["tools:read"]);
  assert.equal(classAuthenticatedAccess(ToolsController), undefined);

  for (const method of [
    "calculate",
    "quote",
    "milestones",
    "evidence",
    "export",
    "escrow",
    "changeOrder",
    "disputeRisk",
    "aiAssist",
  ]) {
    assert.deepEqual(methodPermission(ToolsController, method), ["tools:run"], `${method} should require tools:run`);
  }
});

test("domain RBAC: vision reads results separately from running analysis", () => {
  assert.deepEqual(classPermission(VisionController), ["vision:read"]);
  assert.equal(classAuthenticatedAccess(VisionController), undefined);

  for (const method of [
    "analyze",
    "analyzeByEvidenceId",
    "blueprint",
    "perspectiveCorrect",
    "documentBinarize",
    "progressTimeline",
    "safetyCheck",
    "matchReference",
    "detectTrade",
    "estimateArea",
    "checkConsistency",
    "consistencyByIds",
    "batch",
    "batchByIds",
    "detectMaterial",
    "classifySpace",
    "analyzePortfolio",
    "safetyCheckEnriched",
  ]) {
    assert.deepEqual(methodPermission(VisionController, method), ["vision:run"], `${method} should require vision:run`);
  }
});
