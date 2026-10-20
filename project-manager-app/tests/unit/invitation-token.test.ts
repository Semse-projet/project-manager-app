import assert from "node:assert/strict";
import test from "node:test";
import { invitationLink, consumeInvitationToken } from "../../apps/web/lib/invitation-token.ts";

test("invitation secret is in fragment only, scrubbed before use", () => {
  const token = "invitation_id." + "a".repeat(43);
  const link = invitationLink("https://example.invalid", token);
  const url = new URL(link);
  assert.equal(url.search, "");
  let scrubbed = "";
  assert.equal(consumeInvitationToken(url, value => { scrubbed = value; }), token);
  assert.equal(scrubbed, "/invitations/accept");
});

test("legacy/ambiguous and invalid tokens fail closed and are scrubbed", () => {
  for (const suffix of ["?token=secret", "?token=legacy#token=" + "a".repeat(30), "#token=short", "#token=" + "a".repeat(30) + "&token=" + "b".repeat(30)]) {
    let clean = false;
    assert.equal(consumeInvitationToken(new URL("https://example.invalid/invitations/accept" + suffix), () => { clean = true; }), null);
    assert.equal(clean, true);
  }
});
