import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";
import { AUTHENTICATED_ACCESS_KEY, REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
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

test("domain RBAC: knowledge graph controllers require internal:architecture:read (0.21)", () => {
  // Estos tres controllers son 100% herramientas de arquitectura interna (árbol
  // del repo, runtime, anatomía del dominio) — nunca datos de negocio de un
  // tenant — así que quedan exclusivos de roles internos/admin, no de
  // `knowledge:read` (que todos los roles reciben).
  for (const controller of [AnatomyController, RepoKnowledgeController, RuntimeKnowledgeController]) {
    assert.deepEqual(classPermission(controller), ["internal:architecture:read"]);
    assert.equal(classAuthenticatedAccess(controller), undefined);
  }
});

test("domain RBAC: knowledge management separates architecture-only, read and write", () => {
  // El controller mezcla endpoints de arquitectura (domains/overview) con
  // endpoints funcionales multi-rol (workspace-memory, skills, curate) — solo
  // los primeros se restringen a internal:architecture:read; el resto sigue
  // en knowledge:read/knowledge:write a nivel de clase.
  assert.deepEqual(classPermission(KnowledgeController), ["knowledge:read"]);
  assert.equal(classAuthenticatedAccess(KnowledgeController), undefined);

  for (const method of ["domains", "overview"]) {
    assert.deepEqual(
      methodPermission(KnowledgeController, method),
      ["internal:architecture:read"],
      `${method} should require internal:architecture:read`
    );
  }

  for (const method of ["createSkill", "updateSkillProcedure", "recordSkillUse", "runCuration"]) {
    assert.deepEqual(methodPermission(KnowledgeController, method), ["knowledge:write"], `${method} should require knowledge:write`);
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

