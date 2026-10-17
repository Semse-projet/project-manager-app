import test from "node:test";
import assert from "node:assert/strict";
import { HttpExceptionFilter } from "../dist/common/http-exception.filter.js";
import { StorageWriteGateUnavailableException } from "../dist/infrastructure/storage/storage.service.js";

test("storage gate rejection emits HTTP 503 with Retry-After", () => {
  const headers = new Map<string,string>();
  let statusCode = 0;
  let body: unknown;
  const response = {
    header(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    send(value: unknown) {
      body = value;
      return this;
    },
  };
  const request = { headers: {}, url: "/v1/uploads/plan", method: "POST" };
  const host = {
    switchToHttp() {
      return {
        getResponse: () => response,
        getRequest: () => request,
      };
    },
  };
  const logger = {
    warn() {},
    error() {},
  };
  const filter = new HttpExceptionFilter(logger as never);

  filter.catch(new StorageWriteGateUnavailableException(), host as never);

  assert.equal(statusCode, 503);
  assert.equal(headers.get("retry-after"), "5");
  assert.deepEqual(body, {
    requestId: assertRequestId(body),
    error: {
      status: 503,
      message: {
        message: "Storage write gate temporarily unavailable",
        error: "Service Unavailable",
        statusCode: 503,
      },
    },
  });
});

function assertRequestId(body: unknown): string {
  assert.equal(typeof body, "object");
  assert.ok(body !== null && "requestId" in body);
  const value = (body as {requestId: unknown}).requestId;
  assert.equal(typeof value, "string");
  assert.ok(value.length > 0);
  return value;
}
