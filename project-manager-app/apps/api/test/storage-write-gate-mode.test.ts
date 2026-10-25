import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { ServiceUnavailableException } from "@nestjs/common";
import { resolveStorageWriteGateScope } from "../dist/infrastructure/storage/storage-write-gate-scope.js";
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
  RAILWAY_PROJECT_ID: "95ad1b14-d1d9-467d-82d8-5354619ba873",
  RAILWAY_ENVIRONMENT_ID: "d682210a-956a-4508-9c5b-4ca5959278f9",
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


test("P1: production cannot share a durable write-gate row with staging under the same /data path", () => {
  const common = { SEMSE_STORAGE_ROOT: "/data/semse-storage",
    RAILWAY_PROJECT_ID: prod.RAILWAY_PROJECT_ID };
  const staging = resolveStorageWriteGateScope({
    ...common, NODE_ENV: "test", RAILWAY_ENVIRONMENT: "staging",
    RAILWAY_ENVIRONMENT_ID: "36f72c25-17ab-461f-99c2-9cb68ec81c53",
  });
  const production = resolveStorageWriteGateScope({
    ...common, NODE_ENV: "production",
    RAILWAY_ENVIRONMENT_ID: prod.RAILWAY_ENVIRONMENT_ID,
  });
  assert.notEqual(staging, production);
  assert.match(production, /d682210a-956a-4508-9c5b-4ca5959278f9/);
});

test("P1: production gate scope fails closed without both stable Railway IDs", () => {
  const cfg = { NODE_ENV: "production", SEMSE_STORAGE_ROOT: "/data/semse-storage",
    SEMSE_STORAGE_WRITE_GATE_MODE: "production" };
  assert.throws(() => resolveStorageWriteGateScope(cfg), ServiceUnavailableException);
  assert.throws(() => storageWriteGateRuntimeEnabled(cfg), ServiceUnavailableException);
  assert.throws(() => assertStorageWriteGateControl("observe", {
    ...cfg, SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE: "observe",
  }), ServiceUnavailableException);
  assert.throws(() => resolveStorageWriteGateScope({
    ...cfg, RAILWAY_PROJECT_ID: prod.RAILWAY_PROJECT_ID,
  }), ServiceUnavailableException);
});

test("P1: project identifier also isolates gates when two projects use the same environment ID and root", () => {
  const env = { NODE_ENV: "production", SEMSE_STORAGE_ROOT: "/data/semse-storage",
    RAILWAY_ENVIRONMENT_ID: prod.RAILWAY_ENVIRONMENT_ID };
  const a=resolveStorageWriteGateScope({...env,RAILWAY_PROJECT_ID: prod.RAILWAY_PROJECT_ID});
  const b=resolveStorageWriteGateScope({...env,RAILWAY_PROJECT_ID: "d8d7aa13-6e77-485e-8b46-523c16899134"});
  assert.notEqual(a,b);
});

test("a local staging gate without Railway IDs retains its previous key", () => {
  assert.equal(resolveStorageWriteGateScope({
    NODE_ENV: "test", SEMSE_STORAGE_ROOT: "/data/semse-storage",
  }), "storage:/data/semse-storage");
});
