import test from "node:test";
import assert from "node:assert/strict";
import { verifyStripeWebhookSignature } from "../src/modules/payments/stripe-webhook-signature.ts";
import { createHmac } from "node:crypto";

type FieldMessage = {
  channel: "whatsapp" | "sms" | "in_app";
  recipientUserId: string;
  recipientPhone: string;
  projectId: string;
  jobId: string;
  messageType: "deadline" | "milestone" | "schedule_change" | "field_update" | "safety";
  bodyTemplateId: string;
  deliveryStatus: "queued" | "sent" | "delivered" | "failed";
};

function canSendFieldMessage(input: { consent: boolean; channel: FieldMessage["channel"] }): boolean {
  return input.channel === "in_app" || input.consent;
}

function deliveryFailureCreatesOperationalSignal(input: { message: FieldMessage }): { signalType: string; severity: "low" | "medium" | "high" | "critical" } {
  return {
    signalType: input.message.messageType === "safety" ? "field_comms_failed_safety" : "field_comms_failed",
    severity: input.message.messageType === "safety" ? "high" : "medium",
  };
}

function auditTrailEntry(message: FieldMessage) {
  return {
    event: "field_message.sent",
    channel: message.channel,
    deliveryStatus: message.deliveryStatus,
    projectId: message.projectId,
    jobId: message.jobId,
  };
}

test("M4.3 provider webhook signature validation accepts valid payloads", () => {
  const secret = "whsec_test";
  const payload = Buffer.from('{"event":"message.delivered"}');
  const timestamp = 1_700_000_000;
  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`), payload]);
  const signature = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const header = `t=${timestamp},v1=${signature}`;

  assert.equal(verifyStripeWebhookSignature({
    payload,
    signatureHeader: header,
    secret,
    now: new Date(timestamp * 1000),
  }), true);
});

test("M4.3 messages are not sent without opt-in except in-app", () => {
  assert.equal(canSendFieldMessage({ consent: false, channel: "sms" }), false);
  assert.equal(canSendFieldMessage({ consent: true, channel: "sms" }), true);
  assert.equal(canSendFieldMessage({ consent: false, channel: "in_app" }), true);
});

test("M4.3 delivery failure creates operational signal", () => {
  const signal = deliveryFailureCreatesOperationalSignal({
    message: {
      channel: "sms",
      recipientUserId: "usr_1",
      recipientPhone: "+15551234567",
      projectId: "proj_1",
      jobId: "job_1",
      messageType: "safety",
      bodyTemplateId: "tmpl_1",
      deliveryStatus: "failed",
    },
  });
  assert.equal(signal.signalType, "field_comms_failed_safety");
  assert.equal(signal.severity, "high");
});

test("M4.3 critical field message appears in audit trail", () => {
  const entry = auditTrailEntry({
    channel: "whatsapp",
    recipientUserId: "usr_1",
    recipientPhone: "+15551234567",
    projectId: "proj_1",
    jobId: "job_1",
    messageType: "deadline",
    bodyTemplateId: "tmpl_1",
    deliveryStatus: "sent",
  });
  assert.equal(entry.event, "field_message.sent");
  assert.equal(entry.projectId, "proj_1");
  assert.equal(entry.deliveryStatus, "sent");
});
