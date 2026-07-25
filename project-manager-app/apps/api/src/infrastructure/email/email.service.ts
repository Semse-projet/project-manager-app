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
@Injectable()
export class EmailService {
  private readonly resend: Resend | null;
  private readonly gmail: Transporter | null;
  private readonly from: string;
  private readonly gmailFrom: string;

  constructor(private readonly logger: SemseLoggerService) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = process.env.EMAIL_FROM?.trim() || "SEMSE <no-reply@semseproject.com>";

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
      gmail: this.gmail !== null,
      from: this.from,
    });
    if (!this.resend && !this.gmail) {
      this.logger.warn("email.providers none configured — outgoing emails will not be sent");
    }
  }

  get isConfigured(): boolean {
    return this.resend !== null || this.gmail !== null;
  }

  async send(input: { to: string; subject: string; html: string; text?: string }): Promise<{ sent: boolean; error?: string }> {
    if (!this.resend && !this.gmail) {
      this.logger.warn("email.send skipped — provider not configured", { subject: input.subject, to: input.to });
      return { sent: false, error: "Email provider not configured (RESEND_API_KEY / GMAIL_USER+GMAIL_APP_PASSWORD missing)" };
    }

    let resendError: string | undefined;
    if (this.resend) {
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
