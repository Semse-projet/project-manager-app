import { z } from "zod";

export const pushPlatformSchema = z.enum(["ios", "android"]);
export type PushPlatform = z.infer<typeof pushPlatformSchema>;

export const registerPushTokenSchema = z.object({
  deviceId: z.string().trim().min(1),
  expoPushToken: z.string().trim().min(1),
  platform: pushPlatformSchema,
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
