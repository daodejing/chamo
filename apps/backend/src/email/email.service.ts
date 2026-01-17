import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  getInviteEmailTranslation,
  formatTranslation,
  InviteEmailTranslation,
} from './templates/invite-email.translations';
import {
  getInviteNotificationTranslation,
  InviteNotificationTranslation,
} from './templates/invite-notification.translations';
import {
  getVerificationEmailTranslation,
  VerificationEmailTranslation,
} from './templates/verification-email.translations';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly emailFrom: string;
  private readonly emailFromName: string;
  private readonly emailVerificationUrl: string;
  private readonly appBaseUrl: string;

  constructor() {
    // Validate required configuration - fail fast
    const config = this.validateAndGetConfig();

    this.emailFrom = config.emailFrom;
    this.emailFromName = config.emailFromName;
    this.emailVerificationUrl = config.emailVerificationUrl;
    this.appBaseUrl = config.appBaseUrl;

    this.transporter = nodemailer.createTransport(config.smtp);
  }

  private validateAndGetConfig(): {
    smtp: SmtpConfig;
    emailFrom: string;
    emailFromName: string;
    emailVerificationUrl: string;
    appBaseUrl: string;
  } {
    const missing: string[] = [];

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const emailFrom = process.env.EMAIL_FROM;
    const emailVerificationUrl = process.env.EMAIL_VERIFICATION_URL;

    if (!smtpHost) missing.push('SMTP_HOST');
    if (!smtpPort) missing.push('SMTP_PORT');
    if (!emailFrom) missing.push('EMAIL_FROM');
    if (!emailVerificationUrl) missing.push('EMAIL_VERIFICATION_URL');

    if (missing.length > 0) {
      throw new Error(
        `Missing required email configuration: ${missing.join(', ')}. ` +
          'All email settings must be explicitly configured.',
      );
    }

    const port = parseInt(smtpPort!, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(
        `Invalid SMTP_PORT: "${smtpPort}". Must be a valid port number (1-65535).`,
      );
    }

    // Auth is optional (not needed for local mailhog/mailpit)
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    // If one auth credential is provided, both must be provided
    if ((smtpUser && !smtpPass) || (!smtpUser && smtpPass)) {
      throw new Error(
        'SMTP authentication incomplete: both SMTP_USER and SMTP_PASS must be set, or neither.',
      );
    }

    const smtp: SmtpConfig = {
      host: smtpHost!,
      port,
      secure: port === 465, // TLS on port 465, STARTTLS on 587
    };

    if (smtpUser && smtpPass) {
      smtp.auth = { user: smtpUser, pass: smtpPass };
    }

    return {
      smtp,
      emailFrom: emailFrom!,
      emailFromName: process.env.EMAIL_FROM_NAME || 'Chamo',
      emailVerificationUrl: emailVerificationUrl!,
      appBaseUrl:
        process.env.APP_BASE_URL ||
        emailVerificationUrl!.replace(/\/verify-email.*$/, '') ||
        'http://localhost:3002',
    };
  }

  async onModuleInit() {
    this.logger.log('EmailService initialized');
    this.logger.log(`Sender: ${this.emailFromName} <${this.emailFrom}>`);
    this.logger.log(`Verification URL: ${this.emailVerificationUrl}`);

    // Verify SMTP connection on startup
    try {
      await this.transporter.verify();
      this.logger.log(
        `SMTP connected: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`,
      );
    } catch (error) {
      this.logger.error(
        `SMTP connection failed: ${error.message}. Emails will not be sent.`,
      );
      // Don't throw - allow app to start, but log the error clearly
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Send email with retry logic (1 retry on network failure)
   */
  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    const mailOptions = {
      from: `"${this.emailFromName}" <${this.emailFrom}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      // Retry once on transient errors
      if (this.isRetryableError(error)) {
        this.logger.warn(`Email send failed, retrying: ${error.message}`);
        await this.delay(1000);
        await this.transporter.sendMail(mailOptions);
      } else {
        throw error;
      }
    }
  }

  private isRetryableError(error: any): boolean {
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNREFUSED'
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send verification email with token
   */
  async sendVerificationEmail(
    email: string,
    token: string,
    language: string = 'en',
  ): Promise<void> {
    if (!this.isValidEmail(email)) {
      this.logger.error(`Invalid email format: ${email}`);
      return;
    }

    const verificationLink = `${this.emailVerificationUrl}?token=${token}&lang=${encodeURIComponent(language)}`;
    const translations = getVerificationEmailTranslation(language);

    try {
      await this.sendEmail({
        to: email,
        subject: translations.subject,
        html: this.getVerificationEmailHtml(verificationLink, translations),
        text: this.getVerificationEmailText(verificationLink, translations),
      });
      this.logger.debug(`Verification email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}: ${error.message}`);
    }
  }

  /**
   * Send welcome email after successful verification
   */
  async sendWelcomeEmail(email: string, userName: string): Promise<void> {
    if (!this.isValidEmail(email)) {
      this.logger.error(`Invalid email format: ${email}`);
      return;
    }

    try {
      await this.sendEmail({
        to: email,
        subject: 'Welcome to Chamo!',
        html: this.getWelcomeEmailHtml(userName),
        text: this.getWelcomeEmailText(userName),
      });
      this.logger.debug(`Welcome email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}: ${error.message}`);
    }
  }

  /**
   * Send invite notification
   */
  async sendInviteNotification(
    email: string,
    familyName: string,
    inviteCode: string,
    language: string = 'en',
  ): Promise<void> {
    if (!this.isValidEmail(email)) {
      this.logger.error(`Invalid email format: ${email}`);
      return;
    }

    const translations = getInviteNotificationTranslation(language);
    const replacements = { familyName };
    const acceptUrl = `${this.getAppBaseUrl()}/accept-invite?code=${encodeURIComponent(inviteCode)}`;

    try {
      await this.sendEmail({
        to: email,
        subject: formatTranslation(translations.subject, replacements),
        html: this.getInviteNotificationHtml(familyName, inviteCode, acceptUrl, translations),
        text: this.getInviteNotificationText(familyName, inviteCode, acceptUrl, translations),
      });
      this.logger.debug(`Invite notification sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send invite notification to ${email}: ${error.message}`);
    }
  }

  /**
   * Send registration invitation to unregistered users
   */
  async sendRegistrationInviteEmail(
    inviteeEmail: string,
    familyName: string,
    inviterName: string,
    language: string = 'en',
  ): Promise<void> {
    if (!this.isValidEmail(inviteeEmail)) {
      this.logger.error(`Invalid email format: ${inviteeEmail}`);
      return;
    }

    const registerUrl = `${this.getAppBaseUrl()}/login?mode=create&lockMode=invitee&email=${encodeURIComponent(inviteeEmail)}&lang=${encodeURIComponent(language)}`;
    const translations = getInviteEmailTranslation(language);
    const replacements = { familyName, inviterName };

    try {
      await this.sendEmail({
        to: inviteeEmail,
        subject: formatTranslation(translations.subject, replacements),
        html: this.getRegistrationInviteHtml(familyName, inviterName, registerUrl, translations),
        text: this.getRegistrationInviteText(familyName, inviterName, registerUrl, translations),
      });
      this.logger.debug(`Registration invite sent to ${inviteeEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send registration invite to ${inviteeEmail}: ${error.message}`);
    }
  }

  /**
   * Notify inviter that invitee has completed registration
   */
  async sendInviteeRegistrationNotification(
    inviterEmail: string,
    inviteeEmail: string,
    familyName: string,
  ): Promise<void> {
    if (!this.isValidEmail(inviterEmail)) {
      this.logger.error(`Invalid inviter email format: ${inviterEmail}`);
      return;
    }

    const reviewUrl = `${this.getAppBaseUrl()}/login?returnUrl=${encodeURIComponent(`/family/settings?completeInvite=${encodeURIComponent(inviteeEmail)}`)}`;

    try {
      await this.sendEmail({
        to: inviterEmail,
        subject: `${inviteeEmail} is ready to join ${familyName}`,
        html: this.getInviteeRegisteredHtml(inviteeEmail, familyName, reviewUrl),
        text: this.getInviteeRegisteredText(inviteeEmail, familyName, reviewUrl),
      });
      this.logger.debug(`Registration notification sent to ${inviterEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send registration notification to ${inviterEmail}: ${error.message}`);
    }
  }

  // =============================================================================
  // Email Templates
  // =============================================================================

  private getVerificationEmailHtml(
    verificationLink: string,
    translations: VerificationEmailTranslation,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${translations.subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${translations.title}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">${translations.greeting}</h2>

    <p>${translations.instruction}</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationLink}"
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
        ${translations.buttonText}
      </a>
    </div>

    <p>${translations.linkIntro}</p>
    <p style="background: #f5f5f5; padding: 12px; border-radius: 4px; word-break: break-all; font-size: 14px; color: #666;">
      ${verificationLink}
    </p>

    <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #856404;">
        ⏰ <strong>${translations.expirationWarning}</strong>
      </p>
    </div>

    <p style="margin-top: 30px; font-size: 14px; color: #666;">
      ${translations.ignoreNote}
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Chamo. ${translations.footer}</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getVerificationEmailText(
    verificationLink: string,
    translations: VerificationEmailTranslation,
  ): string {
    return `
${translations.greeting} - ${translations.title}

${translations.instruction}

${verificationLink}

⏰ ${translations.expirationWarning}

${translations.ignoreNote}

---
© ${new Date().getFullYear()} Chamo. ${translations.footer}
    `.trim();
  }

  private getWelcomeEmailHtml(userName: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Chamo!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome to Chamo!</h1>
  </div>

  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Hello, ${userName}!</h2>

    <p>Your email has been verified successfully. You're now ready to connect with your family on Chamo!</p>

    <h3 style="color: #667eea; margin-top: 30px;">Quick Start Guide</h3>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 10px 0;"><strong>📱 Send Messages</strong><br/>Chat with your family in real-time across channels</p>
      <p style="margin: 10px 0;"><strong>📸 Share Photos</strong><br/>Create albums and share memories together</p>
      <p style="margin: 10px 0;"><strong>📅 Family Calendar</strong><br/>Keep everyone updated on important events</p>
      <p style="margin: 10px 0;"><strong>🌍 Translation</strong><br/>Break language barriers with automatic translation</p>
    </div>

    <p style="margin-top: 30px; font-size: 14px; color: #666;">
      Need help? Just reply to this email and we'll get back to you.
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Chamo. Family communication made simple.</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getWelcomeEmailText(userName: string): string {
    return `
Welcome to Chamo! - Hello, ${userName}!

Your email has been verified successfully. You're now ready to connect with your family on Chamo!

Quick Start Guide:

📱 Send Messages
Chat with your family in real-time across channels

📸 Share Photos
Create albums and share memories together

📅 Family Calendar
Keep everyone updated on important events

🌍 Translation
Break language barriers with automatic translation

Need help? Just reply to this email and we'll get back to you.

---
© ${new Date().getFullYear()} Chamo. Family communication made simple.
    `.trim();
  }

  private getInviteNotificationHtml(
    familyName: string,
    inviteCode: string,
    acceptUrl: string,
    translations: InviteNotificationTranslation,
  ): string {
    const replacements = { familyName };
    const title = formatTranslation(translations.title, replacements);
    const heading = formatTranslation(translations.heading, replacements);
    const intro = formatTranslation(translations.intro, replacements);
    const body = formatTranslation(translations.body, replacements);
    const codeLabel = formatTranslation(translations.codeLabel, replacements);
    const cta = formatTranslation(translations.cta, replacements);
    const note = formatTranslation(translations.note, replacements);
    const footer = formatTranslation(translations.footer, replacements);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">👋 ${heading}</h1>
  </div>

  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">${intro}</h2>

    <p>${body}</p>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 30px 0; text-align: center;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">${codeLabel}</p>
      <p style="margin: 0; font-size: 24px; font-weight: bold; color: #667eea; letter-spacing: 2px; font-family: monospace;">
        ${inviteCode}
      </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptUrl}"
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
        ${cta}
      </a>
    </div>

    <p style="margin-top: 30px; font-size: 14px; color: #666;">
      ${note}
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Chamo. ${footer}</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getInviteNotificationText(
    familyName: string,
    inviteCode: string,
    acceptUrl: string,
    translations: InviteNotificationTranslation,
  ): string {
    const replacements = { familyName };
    const heading = formatTranslation(translations.heading, replacements);
    const intro = formatTranslation(translations.intro, replacements);
    const body = formatTranslation(translations.body, replacements);
    const codeLabel = formatTranslation(translations.codeLabel, replacements);
    const cta = formatTranslation(translations.cta, replacements);
    const note = formatTranslation(translations.note, replacements);
    const footer = formatTranslation(translations.footer, replacements);

    return `
${heading} - ${intro}

${body}

${codeLabel} ${inviteCode}

${cta}:
${acceptUrl}

${note}

---
© ${new Date().getFullYear()} Chamo. ${footer}
    `.trim();
  }

  private getRegistrationInviteHtml(
    familyName: string,
    inviterName: string,
    registerUrl: string,
    translations: InviteEmailTranslation,
  ): string {
    const replacements = { familyName, inviterName };
    const greeting = formatTranslation(translations.greeting, replacements);
    const intro = formatTranslation(translations.intro, replacements);
    const body = formatTranslation(translations.body, replacements);
    const cta = formatTranslation(translations.cta, replacements);
    const note = formatTranslation(translations.note, replacements);
    const footer = formatTranslation(translations.footer, replacements);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${formatTranslation(translations.subject, replacements)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #B5179E 0%, #5518C1 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 26px;">${greeting}</h1>
  </div>
  <div style="background: #fff; padding: 32px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="margin-top: 0;">${intro}</h2>
    <p>${body}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${registerUrl}" style="background: linear-gradient(135deg, #B5179E 0%, #5518C1 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
        ${cta}
      </a>
    </div>
    <p style="font-size: 14px; color: #666;">
      ${note}
    </p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Chamo. ${footer}</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getRegistrationInviteText(
    familyName: string,
    inviterName: string,
    registerUrl: string,
    translations: InviteEmailTranslation,
  ): string {
    const replacements = { familyName, inviterName };
    const intro = formatTranslation(translations.intro, replacements);
    const body = formatTranslation(translations.body, replacements);
    const cta = formatTranslation(translations.cta, replacements);
    const footer = formatTranslation(translations.footer, replacements);

    return `
${intro}

${body}

${cta}:
${registerUrl}

© ${new Date().getFullYear()} Chamo - ${footer}
    `.trim();
  }

  private getInviteeRegisteredHtml(
    inviteeEmail: string,
    familyName: string,
    reviewUrl: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${inviteeEmail} is ready to join ${familyName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 30px;">
    <h2 style="margin-top: 0;">${inviteeEmail} just completed registration</h2>
    <p>They're now ready for you to finish their encrypted invite to <strong>${familyName}</strong>.</p>
    <p style="margin-bottom: 24px;">Open Chamo → Family Settings to complete the invite in one click.</p>
    <a href="${reviewUrl}" style="background: linear-gradient(135deg, #12c2e9 0%, #c471ed 50%, #f64f59 100%); color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
      Complete invite now
    </a>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Chamo</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getInviteeRegisteredText(
    inviteeEmail: string,
    familyName: string,
    reviewUrl: string,
  ): string {
    return `
${inviteeEmail} just completed registration and is ready to join ${familyName}.

Finish their encrypted invite from the Pending Invitations section:
${reviewUrl}

© ${new Date().getFullYear()} Chamo
    `.trim();
  }

  private getAppBaseUrl(): string {
    return this.appBaseUrl.replace(/\/$/, '');
  }
}
