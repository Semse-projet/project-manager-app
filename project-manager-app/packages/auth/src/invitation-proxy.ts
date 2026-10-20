import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export function signInvitationProxy(key: string, ip: string, method: string, path: string, now = Math.floor(Date.now() / 1000)): Record<string, string> {
  if (key.length < 32 || !isIP(ip)) throw new Error("Invitation proxy is not configured");
  const timestamp = String(now);
  const signature = createHmac("sha256", key).update(`${timestamp}\n${method}\n${path}\n${ip}`).digest("hex");
  return { "x-semse-invitation-client": ip, "x-semse-invitation-time": timestamp, "x-semse-invitation-signature": signature };
}

export function verifyInvitationProxy(key: string, headers: Record<string, unknown>, method: string, path: string, now = Math.floor(Date.now() / 1000)): string | null {
  const ip = headers["x-semse-invitation-client"], timestamp = headers["x-semse-invitation-time"], signature = headers["x-semse-invitation-signature"];
  if (key.length < 32 || typeof ip !== "string" || !isIP(ip) || typeof timestamp !== "string" || !/^\d{10}$/.test(timestamp) ||
      Math.abs(now - Number(timestamp)) > 30 || typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const expected = createHmac("sha256", key).update(`${timestamp}\n${method}\n${path}\n${ip}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex")) ? ip : null;
}
