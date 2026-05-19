import { z } from "zod";

export const communicationProviderSchema = z.enum([
  "WHATSAPP_CLOUD",
  "OPENWA_LAB",
  "SMS",
  "EMAIL",
  "WEB_CHAT",
]);

export const communicationThreadStatusSchema = z.enum([
  "OPEN",
  "PENDING",
  "CLOSED",
  "ARCHIVED",
]);

export const communicationDirectionSchema = z.enum(["INBOUND", "OUTBOUND"]);

export const communicationMessageStatusSchema = z.enum([
  "RECEIVED",
  "QUEUED",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
]);

export const communicationChannelAccountCreateSchema = z.object({
  provider: communicationProviderSchema.default("WHATSAPP_CLOUD"),
  label: z.string().trim().min(1),
  externalAccountId: z.string().trim().min(1).optional(),
  phoneNumberId: z.string().trim().min(1).optional(),
  displayPhone: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).default("active"),
  settingsJson: z.record(z.unknown()).optional(),
  secretRef: z.string().trim().min(1).optional(),
});

export const communicationSendMessageSchema = z.object({
  channel: communicationProviderSchema.default("WHATSAPP_CLOUD"),
  threadId: z.string().trim().min(1).optional(),
  recipientPhone: z.string().trim().min(1).optional(),
  templateKey: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1),
  payload: z.record(z.unknown()).optional(),
  jobId: z.string().trim().min(1).optional(),
  projectId: z.string().trim().min(1).optional(),
  contractorLeadId: z.string().trim().min(1).optional(),
});

export const communicationInboundMessageSchema = z.object({
  channel: communicationProviderSchema.default("WHATSAPP_CLOUD"),
  externalThreadId: z.string().trim().min(1).optional(),
  externalMessageId: z.string().trim().min(1).optional(),
  contactPhone: z.string().trim().min(1),
  contactName: z.string().trim().min(1).optional(),
  body: z.string().trim().optional(),
  media: z.array(z.record(z.unknown())).optional(),
  rawPayload: z.record(z.unknown()).optional(),
  receivedAt: z.string().datetime().optional(),
  jobId: z.string().trim().min(1).optional(),
  projectId: z.string().trim().min(1).optional(),
  contractorLeadId: z.string().trim().min(1).optional(),
});

export const communicationMessageTemplateCreateSchema = z.object({
  key: z.string().trim().min(1),
  name: z.string().trim().min(1),
  channel: communicationProviderSchema.default("WHATSAPP_CLOUD"),
  locale: z.string().trim().min(1).default("es"),
  category: z.string().trim().min(1).default("utility"),
  body: z.string().trim().min(1),
  status: z.string().trim().min(1).default("draft"),
  variablesJson: z.record(z.unknown()).optional(),
});

export type CommunicationProviderInput = z.infer<typeof communicationProviderSchema>;
export type CommunicationThreadStatusInput = z.infer<typeof communicationThreadStatusSchema>;
export type CommunicationDirectionInput = z.infer<typeof communicationDirectionSchema>;
export type CommunicationMessageStatusInput = z.infer<typeof communicationMessageStatusSchema>;
export type CommunicationChannelAccountCreateInput = z.infer<typeof communicationChannelAccountCreateSchema>;
export type CommunicationSendMessageInput = z.infer<typeof communicationSendMessageSchema>;
export type CommunicationInboundMessageInput = z.infer<typeof communicationInboundMessageSchema>;
export type CommunicationMessageTemplateCreateInput = z.infer<typeof communicationMessageTemplateCreateSchema>;
