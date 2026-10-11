import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const bff = readFileSync(path.join(root, "apps/web/app/api/semse/uploads/files/[...key]/route.ts"), "utf8");
const server = readFileSync(path.join(root, "apps/web/app/api/semse/_server.ts"), "utf8");

test("file proxy GET/PUT require verified session cookie even if middleware is bypassed", () => {
  assert.match(bff, /export async function PUT/);
  assert.match(bff, /export async function GET/);
  assert.equal(bff.match(/resolveCookieRuntimeConfigForRequest\(request\)/g)?.length, 2);
  assert.equal(bff.match(/Authenticated SEMSE session required/g)?.length, 2);
  assert.doesNotMatch(bff, /resolveRuntimeConfigForRequest/);
});

test("file resolver does not trust proxy headers or fall back to a static admin identity", () => {
  const scoped = server.slice(server.indexOf("export async function resolveCookieRuntimeConfigForRequest"), server.indexOf("export function runtimeDisabledResponse"));
  assert.match(scoped, /return resolveConfigFromCookie\(req\)/);
  assert.doesNotMatch(scoped, /resolveRuntimeConfig\(\)/);
  assert.doesNotMatch(scoped, /resolveConfigFromRequest/);
  assert.match(server, /process\.env\.NODE_ENV === "production" \? undefined : "http:\/\/127\.0\.0\.1:4000"/);
});

test("authorized proxy keeps actual file PUT and GET while forwarding bearer credentials", () => {
  assert.match(bff, /buildAuthorizedHeaders\(config\)/);
  assert.match(bff, /method: "PUT"/);
  assert.match(bff, /method: "GET"/);
  assert.match(bff, /const body = await request\.arrayBuffer\(\)/);
});
