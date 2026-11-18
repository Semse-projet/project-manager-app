import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { GUARDS_METADATA } from "@nestjs/common/constants.js";
import { LiensController } from "../dist/modules/liens/liens.controller.js";
import { NoticeController } from "../dist/modules/liens/notice.controller.js";
import { WaiverController } from "../dist/modules/liens/waiver.controller.js";
import { LienSchedulerController } from "../dist/modules/liens/lien-scheduler.controller.js";

// Regression: the lien controllers declared @UseGuards(AuthGuard('jwt')) from
// @nestjs/passport, but no passport "jwt" strategy is registered anywhere in
// the API, so every lien endpoint failed with 500 "Unknown authentication
// strategy". Authentication is the global APP_GUARD (common/auth.guard.ts);
// these controllers must not add a passport guard of their own.
for (const [name, controller] of Object.entries({ LiensController, NoticeController, WaiverController, LienSchedulerController })) {
  test(`${name} no declara guards propios (la autenticación es el APP_GUARD global)`, () => {
    // The passport mixin guard is an anonymous class with a hashed name, so
    // assert on the absence of any controller-level guard instead.
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, controller) ?? [], []);
  });
}
