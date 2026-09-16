import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';

export type AuthEmailPayload = {
  to: string;
  name: string;
  url: string;
};

@Injectable()
export class AuthEmailService {
  private readonly logger = new Logger(AuthEmailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(payload: AuthEmailPayload): Promise<void> {
    await this.send({
      ...payload,
      subject: 'Verify your BotFlow email',
      intro: 'Thanks for signing up for BotFlow. Confirm your email to activate your account.',
      actionLabel: 'Verify email',
    });
  }

  async sendPasswordResetEmail(payload: AuthEmailPayload): Promise<void> {
    await this.send({
      ...payload,
      subject: 'Reset your BotFlow password',
      intro: 'We received a request to reset your BotFlow password.',
      actionLabel: 'Reset password',
    });
  }

  private async send(options: AuthEmailPayload & {
    subject: string;
    intro: string;
    actionLabel: string;
  }): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM') ?? 'BotFlow <noreply@botflow.ink>';
    const html = `
      <p>Hi ${escapeHtml(options.name)},</p>
      <p>${escapeHtml(options.intro)}</p>
      <p><a href="${escapeHtml(options.url)}">${escapeHtml(options.actionLabel)}</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `.trim();

    if (!this.isSmtpConfigured()) {
      this.logger.warn(
        `[Better Auth email] SMTP not configured — logging instead of sending to ${options.to}`,
      );
      this.logger.log(`Subject: ${options.subject}`);
      this.logger.log(`URL: ${options.url}`);
      return;
    }

    const transporter = await this.getTransporter();
    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html,
      text: `${options.intro}\n\n${options.url}`,
    });
  }

  private isSmtpConfigured(): boolean {
    return Boolean(
      this.config.get<string>('SMTP_HOST')?.trim() &&
        this.config.get<string>('SMTP_FROM')?.trim(),
    );
  }

  private async getTransporter(): Promise<Transporter> {
    if (this.transporter) return this.transporter;

    const host = this.config.getOrThrow<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass: pass ?? '' } : undefined,
    });

    return this.transporter;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
