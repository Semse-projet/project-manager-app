import test from "node:test";
import assert from "node:assert/strict";
import { entityIdMatchesExactCorrelation } from "../dist/modules/domain-events/domain-event-correlation.js";

test("#1156: correlation matches the full segment after the first colon", () => {
  assert.equal(entityIdMatchesExactCorrelation("qa.event:turno:inicio", "turno:inicio"), true);
  assert.equal(entityIdMatchesExactCorrelation("qa.event:manual:turno:inicio", "turno:inicio"), false);
  assert.equal(entityIdMatchesExactCorrelation("qa.event:manual:turno:inicio", "manual:turno:inicio"), true);
});

test("#1156: correlation wildcards are compared literally", () => {
  assert.equal(entityIdMatchesExactCorrelation("qa.event:turnoXinicio", "turno_inicio"), false);
  assert.equal(entityIdMatchesExactCorrelation("qa.event:turno_inicio", "turno_inicio"), true);
  assert.equal(entityIdMatchesExactCorrelation("qa.event:turno%inicio", "turno_inicio"), false);
  assert.equal(entityIdMatchesExactCorrelation("qa.event:turno%inicio", "turno%inicio"), true);
});

test("#1156: missing type prefix or empty correlation never matches", () => {
  assert.equal(entityIdMatchesExactCorrelation("turno:inicio", "inicio"), true);
  assert.equal(entityIdMatchesExactCorrelation(":turno:inicio", "turno:inicio"), false);
  assert.equal(entityIdMatchesExactCorrelation("qa.event", "qa.event"), false);
  assert.equal(entityIdMatchesExactCorrelation("qa.event:corr", ""), false);
});
