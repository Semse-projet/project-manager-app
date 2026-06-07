import test from "node:test";
import assert from "node:assert/strict";
import { AnatomyService } from "../dist/modules/anatomy/anatomy.service.js";

test("anatomy service returns canonical tree and node detail", async () => {
  const service = new AnatomyService();

  const tree = await service.getTree();
  const node = await service.getNode("mouth");

  assert.equal(tree.node.id, "body");
  assert.equal(node.id, "mouth");
});

test("anatomy service answers structured tutor queries", async () => {
  const service = new AnatomyService();

  const result = await service.query({
    search: "partes de la mano",
    includeRelations: true,
    includePath: true,
    maxDepth: 4
  });

  assert.equal(result.node?.id, "hand");
  assert.deepEqual(result.children.map((child) => child.id), ["fingers"]);
});

test("anatomy service validates the domain", async () => {
  const service = new AnatomyService();
  const result = await service.validate({});

  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
});
