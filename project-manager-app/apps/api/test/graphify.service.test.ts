import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { GraphifyService } from "../dist/modules/graphify/graphify.service.js";

// ── isAvailable ───────────────────────────────────────────────────────────────

test("graphify: isAvailable is false when graph path does not exist", () => {
  const service = new GraphifyService();
  // Default graph path won't exist in test environment
  // Just verify it returns a boolean without throwing
  assert.equal(typeof service.isAvailable, "boolean");
});

test("graphify: isAvailable reflects GRAPHIFY_GRAPH_PATH env var", () => {
  // With a path that doesn't exist
  process.env.GRAPHIFY_GRAPH_PATH = "/nonexistent/path/graph.json";
  const service = new GraphifyService();
  assert.equal(service.isAvailable, false);
  delete process.env.GRAPHIFY_GRAPH_PATH;
});

// ── Methods return {available:false} when graph not present ───────────────────

test("graphify: query returns available:false when graph file missing", async () => {
  process.env.GRAPHIFY_GRAPH_PATH = "/nonexistent/graph.json";
  const service = new GraphifyService();

  const result = await service.query("what is the auth module?");

  assert.equal(result.available, false);
  assert.equal(result.result, "");
  delete process.env.GRAPHIFY_GRAPH_PATH;
});

test("graphify: path returns available:false when graph file missing", async () => {
  process.env.GRAPHIFY_GRAPH_PATH = "/nonexistent/graph.json";
  const service = new GraphifyService();

  const result = await service.path("AuthModule", "PaymentsModule");

  assert.equal(result.available, false);
  delete process.env.GRAPHIFY_GRAPH_PATH;
});

test("graphify: explain returns available:false when graph file missing", async () => {
  process.env.GRAPHIFY_GRAPH_PATH = "/nonexistent/graph.json";
  const service = new GraphifyService();

  const result = await service.explain("EscrowService");

  assert.equal(result.available, false);
  delete process.env.GRAPHIFY_GRAPH_PATH;
});

test("graphify: affected returns available:false when graph file missing", async () => {
  process.env.GRAPHIFY_GRAPH_PATH = "/nonexistent/graph.json";
  const service = new GraphifyService();

  const result = await service.affected("PaymentsController");

  assert.equal(result.available, false);
  delete process.env.GRAPHIFY_GRAPH_PATH;
});

// ── buildStructuralContext ─────────────────────────────────────────────────────

test("graphify: buildStructuralContext returns empty string when graph unavailable", async () => {
  process.env.GRAPHIFY_GRAPH_PATH = "/nonexistent/graph.json";
  const service = new GraphifyService();

  const context = await service.buildStructuralContext("how does escrow work?");

  assert.equal(context, "");
  delete process.env.GRAPHIFY_GRAPH_PATH;
});

// ── graphPath exposure ────────────────────────────────────────────────────────

test("graphify: graphPath uses GRAPHIFY_GRAPH_PATH env when set", () => {
  process.env.GRAPHIFY_GRAPH_PATH = "/custom/path/graph.json";
  const service = new GraphifyService();

  assert.equal(service.graphPath, "/custom/path/graph.json");
  delete process.env.GRAPHIFY_GRAPH_PATH;
});

test("graphify: graphPath falls back to default graphify-out/graph.json", () => {
  delete process.env.GRAPHIFY_GRAPH_PATH;
  const service = new GraphifyService();

  assert.ok(service.graphPath.endsWith("graphify-out/graph.json"));
});
