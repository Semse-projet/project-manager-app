import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";

/**
 * Thin wrapper around Resend. Previously there was no email-sending
 * infrastructure anywhere in this backend (0.32 in
 * docs/AUDIT_REMEDIATION_PLAN.md) — password reset requests generated a
 * real token but never delivered it to anyone, which locked a real user
 * out of their account twice in 24h.
 *
 * Requires RESEND_API_KEY (and optionally EMAIL_FROM, a verified sender)
 * as Railway service variables for the API. Without RESEND_API_KEY this
 * degrades to logging a warning and returning sent:false — callers must
 * treat that as a real failure, not swallow it, so the gap is visible
 * instead of silently repeating the original bug.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = process.env.EMAIL_FROM?.trim() || "SEMSE <no-reply@semseproject.com>";

    if (!this.resend) {
      this.logger.warn("[EmailService] RESEND_API_KEY is not configured — outgoing emails will not be sent");
    }
  }

  get isConfigured(): boolean {
    return this.resend !== null;
  }

  async send(input: { to: string; subject: string; html: string; text?: string }): Promise<{ sent: boolean; error?: string }> {
    if (!this.resend) {
      this.logger.warn(`[EmailService] Skipped sending "${input.subject}" to ${input.to} — provider not configured`);
      return { sent: false, error: "Email provider not configured (RESEND_API_KEY missing)" };
    }

    try {
      const result = await this.resend.emails.send({
        from: this.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text
      });
      if (result.error) {
        this.logger.error(`[EmailService] Resend rejected email to ${input.to}: ${result.error.message}`);
        return { sent: false, error: result.error.message };
      }
      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[EmailService] Failed to send to ${input.to}: ${message}`);
      return { sent: false, error: message };
    }
  }
}
