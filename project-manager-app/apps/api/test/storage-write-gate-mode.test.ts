import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { ServiceUnavailableException } from "@nestjs/common";
import {
  assertStorageWriteGateControl,
  storageWriteGateRuntimeEnabled,
} from "../dist/infrastructure/storage/storage-write-gate-mode.js";

const nonprod = {
  NODE_ENV: "test",
  SEMSE_STORAGE_WRITE_GATE_MODE: "off",
};

const prod = {
  NODE_ENV: "production",
  SEMSE_STORAGE_WRITE_GATE_MODE: "off",
};

test("runtime mode off is inert in every environment", () => {
  assert.equal(storageWriteGateRuntimeEnabled({...nonprod}), false);
  assert.equal(storageWriteGateRuntimeEnabled({...prod}), false);
});

test("staging runtime mode is accepted only outside production", () => {
  assert.equal(storageWriteGateRuntimeEnabled({
    ...nonprod,
    SEMSE_STORAGE_WRITE_GATE_MODE: "staging",
  }), true);
  assert.throws(
    () => storageWriteGateRuntimeEnabled({
      ...prod,
      SEMSE_STORAGE_WRITE_GATE_MODE: "staging",
    }),
    ServiceUnavailableException,
  );
});

test("production runtime mode is accepted only in production", () => {
  assert.equal(storageWriteGateRuntimeEnabled({
    ...prod,
    SEMSE_STORAGE_WRITE_GATE_MODE: "production",
  }), true);
  assert.throws(
    () => storageWriteGateRuntimeEnabled({
      ...nonprod,
      SEMSE_STORAGE_WRITE_GATE_MODE: "production",
    }),
    ServiceUnavailableException,
  );
});

test("staging retains full control-plane capability", () => {
  const env = {
    ...nonprod,
    SEMSE_STORAGE_WRITE_GATE_MODE: "staging",
  };
  assert.doesNotThrow(() => assertStorageWriteGateControl("observe", env));
  assert.doesNotThrow(() => assertStorageWriteGateControl("provision", env));
  assert.doesNotThrow(() => assertStorageWriteGateControl("mutate", env));
});

test("production observe/provision can be prepared while runtime remains off", () => {
  const observe = {
    ...prod,
    SEMSE_STORAGE_WRITE_GATE_MODE: "off",
    SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE: "observe",
  };
  assert.doesNotThrow(() => assertStorageWriteGateControl("observe", observe));
  assert.throws(
    () => assertStorageWriteGateControl("provision", observe),
    ServiceUnavailableException,
  );
  assert.throws(
    () => assertStorageWriteGateControl("mutate", observe),
    ServiceUnavailableException,
  );

  const provision = {
    ...observe,
    SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE: "provision",
  };
  assert.doesNotThrow(() => assertStorageWriteGateControl("observe", provision));
  assert.doesNotThrow(() => assertStorageWriteGateControl("provision", provision));
  assert.throws(
    () => assertStorageWriteGateControl("mutate", provision),
    ServiceUnavailableException,
  );
});

test("production transition authority remains unavailable even with runtime enabled", () => {
  const env = {
    ...prod,
    SEMSE_STORAGE_WRITE_GATE_MODE: "production",
    SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE: "provision",
  };
  assert.doesNotThrow(() => assertStorageWriteGateControl("observe", env));
  assert.doesNotThrow(() => assertStorageWriteGateControl("provision", env));
  assert.throws(
    () => assertStorageWriteGateControl("mutate", env),
    ServiceUnavailableException,
  );
});

test("production rejects staging runtime even if control mode is present", () => {
  const env = {
    ...prod,
    SEMSE_STORAGE_WRITE_GATE_MODE: "staging",
    SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE: "provision",
  };
  assert.throws(
    () => assertStorageWriteGateControl("observe", env),
    ServiceUnavailableException,
  );
});
