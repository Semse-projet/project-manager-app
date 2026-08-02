import { Injectable } from "@nestjs/common";
import { Resend } from "resend";
import nodemailer, { Transporter } from "nodemailer";
import { SemseLoggerService } from "../observability/semse-logger.service.js";

/**
 * Thin wrapper around Resend, with Gmail SMTP as a fallback provider.
 * Previously there was no email-sending infrastructure anywhere in this
 * backend (0.32 in docs/AUDIT_REMEDIATION_PLAN.md) — password reset
 * requests generated a real token but never delivered it to anyone, which
 * locked a real user out of their account twice in 24h.
 *
 * Resend requires RESEND_API_KEY (and optionally EMAIL_FROM, a verified
 * sender) as Railway service variables. Resend rejects sending from a
 * domain that hasn't completed DNS verification — while that's pending,
 * GMAIL_USER + GMAIL_APP_PASSWORD (a Google Account App Password, not the
 * real account password) let outgoing mail go out via Gmail SMTP instead.
 * Resend is tried first when configured (it's the intended production
 * path); Gmail is the fallback, tried if Resend is unconfigured or its
 * send attempt fails. Without either provider configured this degrades to
 * logging a warning and returning sent:false — callers must treat that as
 * a real failure, not swallow it, so the gap is visible instead of
 * silently repeating the original bug.
 */
/** Resend's default onboarding sender — issued automatically before any
 * custom domain is verified. In that state Resend's API returns a normal
 * success response for ANY recipient, but only actually delivers to the
 * email address of the account that owns the API key; every other
 * recipient silently gets nothing, with no error field to catch. This is
 * indistinguishable from a real send by inspecting the API response alone. */
const RESEND_SANDBOX_DOMAIN = "resend.dev";

@Injectable()
export class EmailService {
  private readonly resend: Resend | null;
  private readonly gmail: Transporter | null;
  private readonly from: string;
  private readonly gmailFrom: string;
  private readonly resendUsable: boolean;

  constructor(private readonly logger: SemseLoggerService) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = process.env.EMAIL_FROM?.trim() || "SEMSE <no-reply@semseproject.com>";
    this.resendUsable = this.resend !== null && !this.from.includes(RESEND_SANDBOX_DOMAIN);

    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();
    this.gmail = gmailUser && gmailAppPassword
      ? nodemailer.createTransport({
          service: "gmail",
          auth: { user: gmailUser, pass: gmailAppPassword }
        })
      : null;
    this.gmailFrom = gmailUser ? `SEMSE <${gmailUser}>` : "";

    this.logger.info("email.providers configured", {
      resend: this.resend !== null,
      resendUsable: this.resendUsable,
      gmail: this.gmail !== null,
      from: this.from,
    });
    if (this.resend && !this.resendUsable) {
      this.logger.warn("email.providers resend is on the sandbox domain (resend.dev) — it will only deliver to the API key owner, so it's skipped in favor of Gmail until a real domain is verified and EMAIL_FROM is updated", { from: this.from });
    }
    if (!this.resendUsable && !this.gmail) {
      this.logger.warn("email.providers none configured — outgoing emails will not be sent");
    }
  }

  get isConfigured(): boolean {
    return this.resendUsable || this.gmail !== null;
  }

  async send(input: { to: string; subject: string; html: string; text?: string }): Promise<{ sent: boolean; error?: string }> {
    if (!this.resendUsable && !this.gmail) {
      this.logger.warn("email.send skipped — provider not configured", { subject: input.subject, to: input.to });
      return { sent: false, error: "Email provider not configured (RESEND_API_KEY needs a verified non-sandbox domain, or GMAIL_USER+GMAIL_APP_PASSWORD missing)" };
    }

    let resendError: string | undefined;
    if (this.resend && this.resendUsable) {
      try {
        const result = await this.resend.emails.send({
          from: this.from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text
        });
        if (result.error) {
          resendError = result.error.message;
          this.logger.error("email.send resend rejected", { to: input.to, error: resendError });
        } else {
          this.logger.info("email.send delivered via resend", { to: input.to });
          return { sent: true };
        }
      } catch (error) {
        resendError = error instanceof Error ? error.message : String(error);
        this.logger.error("email.send resend threw", { to: input.to, error: resendError });
      }
    }

    if (this.gmail) {
      try {
        await this.gmail.sendMail({
          from: this.gmailFrom,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text
        });
        this.logger.info("email.send delivered via gmail", { to: input.to });
        return { sent: true };
      } catch (error) {
        const gmailError = error instanceof Error ? error.message : String(error);
        this.logger.error("email.send gmail failed", { to: input.to, error: gmailError });
        return { sent: false, error: resendError ? `resend: ${resendError}; gmail: ${gmailError}` : gmailError };
      }
    }

    return { sent: false, error: resendError };
  }
}
