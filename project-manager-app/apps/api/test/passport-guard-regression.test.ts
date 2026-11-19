import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { GUARDS_METADATA } from "@nestjs/common/constants.js";
import { CapabilityRegistryController } from "../dist/modules/capability-registry/capability-registry.controller.js";
import { WeatherController } from "../dist/modules/weather/weather.controller.js";

// Regression: these controllers declared @UseGuards(AuthGuard('jwt')) from
// @nestjs/passport, but no passport strategy is registered anywhere in the API,
// so every request failed with 500 "Unknown authentication strategy". Same
// defect fixed for liens in #1150. Authentication is the global APP_GUARD
// (common/auth.guard.ts); authorization stays with @AuthenticatedAccess /
// @RequirePermissions via RbacGuard. The passport mixin guard is an anonymous
// class with a hashed name, so assert there is no controller-level guard.
for (const [name, controller] of Object.entries({ CapabilityRegistryController, WeatherController })) {
  test(`${name} no declara un guard de passport sin estrategia`, () => {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, controller) ?? [], []);
  });
}
