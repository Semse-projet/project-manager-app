import https from "node:https";
import { resolveSafeUrl } from "@semse/shared";

const DELIVERY_TIMEOUT_MS = 10_000;

export type SatelliteWebhookDeliveryOutcome =
  | { delivered: true; statusCode: number }
  | { delivered: false; reason: string };

/**
 * Delivers one signed webhook body to `url`. Re-runs `resolveSafeUrl()`
 * immediately before connecting (SAT-007 spec §8 point 2 — DNS rebinding
 * defense: the registration-time check is not enough, since DNS can
 * change between registration and every later delivery), then pins the
 * TCP connection to that resolved IP so nothing re-resolves DNS between
 * the check and the connect. TLS hostname verification still runs against
 * the real hostname via `servername`/the `Host` header, not the IP.
 *
 * Never follows redirects — a 3xx response is reported as a plain
 * delivery failure like any other non-2xx status, exactly like an
 * unreachable endpoint. That failure feeds the per-webhook consecutive
 * failure counter (SatelliteWebhooksService.recordDeliveryFailure), which
 * is independent from the outbox consumer's own attempt/backoff/dead
 * letter bookkeeping — see domain-event-consumer.service.ts.
 */
export async function deliverSatelliteWebhook(
  url: string,
  body: string,
  signature: string,
): Promise<SatelliteWebhookDeliveryOutcome> {
  const safeUrl = await resolveSafeUrl(url);
  if (!safeUrl.safe) {
    return { delivered: false, reason: `ssrf_rejected:${safeUrl.reason}` };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { delivered: false, reason: "invalid_url" };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome: SatelliteWebhookDeliveryOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const req = https.request(
      {
        hostname: safeUrl.ip,
        servername: safeUrl.hostname,
        port: safeUrl.port,
        path: `${parsed.pathname}${parsed.search}`,
        method: "POST",
        headers: {
          Host: safeUrl.hostname,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-Semse-Signature": signature,
        },
        timeout: DELIVERY_TIMEOUT_MS,
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          const statusCode = res.statusCode ?? 0;
          if (statusCode >= 200 && statusCode < 300) {
            finish({ delivered: true, statusCode });
          } else {
            finish({ delivered: false, reason: `http_${statusCode}` });
          }
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("satellite webhook delivery timed out"));
    });
    req.on("error", (err) => {
      finish({ delivered: false, reason: `request_error:${err.message}` });
    });

    req.write(body);
    req.end();
  });
}
