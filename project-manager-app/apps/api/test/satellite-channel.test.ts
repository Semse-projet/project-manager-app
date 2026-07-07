import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { SatellitesService } from "../dist/modules/satellites/satellites.service.js";
import { buildInitialIntake, buildVoicePrompt, getNextQuestion } from "../dist/modules/smart-intake/smart-intake.logic.js";

// ─────────────────────────────────────────────────────────────────────────────
// SAT-002 anillo 1 — canal Alexa: resolveChannel exige satellite token con
// scope, channel persiste en el intake, perfil voice devuelve texto hablable
// (docs/specs/satellites/SAT-002-alexa-voice-channel.spec.md)
// ─────────────────────────────────────────────────────────────────────────────

function makeServiceWithToken(scopes: string[]) {
  const fakePrisma = {
    satelliteToken: {
      async findUnique() {
        return {
          id: "sat_1",
          name: "alexa",
          tokenHash: "irrelevant",
          scopes,
          status: "ACTIVE",
          expiresAt: null,
          revokedAt: null,
          lastUsedAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      },
      async update() {
        return {};
      }
    }
  };
  return new SatellitesService(fakePrisma as never);
}

function withKillSwitchOn<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.SATELLITE_TOKENS_ENABLED;
  process.env.SATELLITE_TOKENS_ENABLED = "true";
  return fn().finally(() => {
    if (previous === undefined) delete process.env.SATELLITE_TOKENS_ENABLED;
    else process.env.SATELLITE_TOKENS_ENABLED = previous;
  });
}

test("SAT-002: sin header x-semse-channel ⇒ null sin exigir token", async () => {
  const service = makeServiceWithToken(["intake:write"]);
  assert.equal(await service.resolveChannel({}), null);
  assert.equal(await service.resolveChannel({ "x-semse-channel": "  " }), null);
});

test("SAT-002: header sin satellite token ⇒ 401", async () => {
  const service = makeServiceWithToken(["intake:write"]);
  await assert.rejects(
    () => service.resolveChannel({ "x-semse-channel": "alexa" }),
    UnauthorizedException
  );
});

test("SAT-002: token sin scope intake:write ⇒ 403", async () => {
  await withKillSwitchOn(async () => {
    const service = makeServiceWithToken(["jobs:read"]);
    await assert.rejects(
      () =>
        service.resolveChannel({
          "x-semse-channel": "alexa",
          authorization: "Bearer sst_valid"
        }),
      ForbiddenException
    );
  });
});

test("SAT-002: token válido con scope ⇒ canal normalizado", async () => {
  await withKillSwitchOn(async () => {
    const service = makeServiceWithToken(["intake:write"]);
    const channel = await service.resolveChannel({
      "x-semse-channel": " Alexa ",
      authorization: "Bearer sst_valid"
    });
    assert.equal(channel, "alexa");
  });
});

test("SAT-002: canal con formato inválido ⇒ 401", async () => {
  const service = makeServiceWithToken(["intake:write"]);
  await assert.rejects(
    () => service.resolveChannel({ "x-semse-channel": "bad channel!!", authorization: "Bearer sst_valid" }),
    UnauthorizedException
  );
});

test("SAT-002: buildInitialIntake persiste el canal (default web)", () => {
  const base = {
    id: "intk_test",
    tenantId: "tenant_default",
    sessionToken: "sess_1",
    rawDescription: "quiero remodelar mi baño completo con ducha nueva"
  };
  assert.equal(buildInitialIntake(base).channel, "web");
  assert.equal(buildInitialIntake({ ...base, channel: "alexa" }).channel, "alexa");
});

test("SAT-002: buildVoicePrompt devuelve texto hablable solo para canales de voz", () => {
  const alexaIntake = buildInitialIntake({
    id: "intk_voice",
    tenantId: "tenant_default",
    sessionToken: "sess_1",
    rawDescription: "necesito pintar mi casa por dentro, dos habitaciones",
    channel: "alexa"
  });
  const webIntake = { ...alexaIntake, channel: "web" };
  const nextQuestion = getNextQuestion(alexaIntake);
  assert.ok(nextQuestion, "el intake nuevo debe tener siguiente pregunta");

  const prompt = buildVoicePrompt(alexaIntake, nextQuestion);
  assert.equal(typeof prompt, "string");
  assert.ok(prompt!.length > 0);
  assert.ok(prompt!.split(" ").length <= 91, "≤ 90 palabras");
  assert.ok(!prompt!.includes("**") && !prompt!.includes("]("), "sin markdown ni links");

  assert.equal(buildVoicePrompt(webIntake, nextQuestion), null);
});

test("SAT-002: buildVoicePrompt sin pregunta pendiente ⇒ cierre hablado", () => {
  const intake = buildInitialIntake({
    id: "intk_done",
    tenantId: "tenant_default",
    sessionToken: "sess_1",
    rawDescription: "proyecto de pintura interior completo ya detallado",
    channel: "alexa"
  });
  const closing = buildVoicePrompt(intake, null);
  assert.ok(closing && closing.length > 0);
  assert.ok(/profesional/i.test(closing));
});
