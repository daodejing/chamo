import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Brevo from '@getbrevo/brevo';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  getInviteEmailTranslation,
  formatTranslation,
  InviteEmailTranslation,
} from './templates/invite-email.translations';
import {
  getVerificationEmailTranslation,
  VerificationEmailTranslation,
} from './templates/verification-email.translations';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private apiInstance: Brevo.TransactionalEmailsApi | null = null;
  private smtpTransporter: Transporter | null = null;
  private readonly useSmtp: boolean;
  private readonly emailFrom: string;
  private readonly emailFromName: string;
  private readonly emailVerificationUrl: string;
  private readonly appBaseUrl: string;

  constructor() {
    // Check if SMTP is configured (for test environments with MailHog)
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    this.useSmtp = Boolean(smtpHost && smtpPort);

    const emailFrom = process.env.EMAIL_FROM;
    if (!emailFrom) {
      throw new Error(
        'EMAIL_FROM is required. Please add it to your .env file.',
      );
    }
    this.emailFrom = emailFrom;

    this.emailFromName = process.env.EMAIL_FROM_NAME || 'Chamo';

    const emailVerificationUrl = process.env.EMAIL_VERIFICATION_URL;
    if (!emailVerificationUrl) {
      throw new Error(
        'EMAIL_VERIFICATION_URL is required. Please add it to your .env file.',
      );
    }
    this.emailVerificationUrl = emailVerificationUrl;
    this.appBaseUrl =
      process.env.APP_BASE_URL ||
      emailVerificationUrl.replace(/\/verify-email.*$/, '') ||
      'http://localhost:3002';

    if (this.useSmtp) {
      // Use nodemailer with SMTP (for MailHog in tests)
      this.smtpTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort!, 10),
        secure: false, // MailHog doesn't use TLS
      });
    } else {
      // Use Brevo API for production
      const brevoApiKey = process.env.BREVO_API_KEY;
      if (!brevoApiKey) {
        throw new Error(
          'BREVO_API_KEY is required. Please add it to your .env file. See docs/BREVO_SETUP.md for setup instructions.',
        );
      }

      this.apiInstance = new Brevo.TransactionalEmailsApi();
      this.apiInstance.setApiKey(
        Brevo.TransactionalEmailsApiApiKeys.apiKey,
        brevoApiKey,
      );
    }
  }

  onModuleInit() {
    this.logger.log('EmailService initialized successfully');
    this.logger.log(`Email sender: ${this.emailFromName} <${this.emailFrom}>`);
    this.logger.log(
      `Verification URL: ${this.emailVerificationUrl.replace(/\?.*$/, '')}`,
    );
    this.logger.log(
      `Transport: ${this.useSmtp ? `SMTP (${process.env.SMTP_HOST}:${process.env.SMTP_PORT})` : 'Brevo API'}`,
    );
  }

  /**
   * Validate email format
   * Returns true if valid, false otherwise
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Send verification email with token
   * Fires and forgets - logs errors but doesn't throw
   * @param language - Optional language code for localized email (defaults to 'en')
   */
  async sendVerificationEmail(
    email: string,
    token: string,
    language: string = 'en',
  ): Promise<void> {
    if (!this.isValidEmail(email)) {
      this.logger.error(
        `Invalid email format: ${email}. Skipping verification email.`,
      );
      return;
    }

    const verificationLink = `${this.emailVerificationUrl}?token=${token}&lang=${encodeURIComponent(language)}`;
    const translations = getVerificationEmailTranslation(language);

    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        email: this.emailFrom,
        name: this.emailFromName,
      };
      sendSmtpEmail.to = [{ email }];
      sendSmtpEmail.subject = translations.subject;
      sendSmtpEmail.htmlContent = this.getVerificationEmailHtml(
        verificationLink,
        translations,
      );
      sendSmtpEmail.textContent = this.getVerificationEmailText(
        verificationLink,
        translations,
      );

      await this.sendEmailWithRetry(sendSmtpEmail);
      this.logger.debug(
        `Verification email sent successfully to ${email} in language ${language} (token: ${token.substring(0, 8)}...)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send welcome email after successful verification
   * Fires and forgets - logs errors but doesn't throw
   */
  async sendWelcomeEmail(email: string, userName: string): Promise<void> {
    if (!this.isValidEmail(email)) {
      this.logger.error(
        `Invalid email format: ${email}. Skipping welcome email.`,
      );
      return;
    }

    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        email: this.emailFrom,
        name: this.emailFromName,
      };
      sendSmtpEmail.to = [{ email }];
      sendSmtpEmail.subject = 'Welcome to Chamo!';
      sendSmtpEmail.htmlContent = this.getWelcomeEmailHtml(userName);
      sendSmtpEmail.textContent = this.getWelcomeEmailText(userName);

      await this.sendEmailWithRetry(sendSmtpEmail);
      this.logger.debug(
        `Welcome email sent successfully to ${email} (user: ${userName})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${email}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send invite notification (future use for Story 1.5)
   * Fires and forgets - logs errors but doesn't throw
   */
  async sendInviteNotification(
    email: string,
    familyName: string,
    inviteCode: string,
  ): Promise<void> {
    if (!this.isValidEmail(email)) {
      this.logger.error(
        `Invalid email format: ${email}. Skipping invite notification.`,
      );
      return;
    }

    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        email: this.emailFrom,
        name: this.emailFromName,
      };
      sendSmtpEmail.to = [{ email }];
      const acceptUrl = `${this.getAppBaseUrl()}/accept-invite?code=${encodeURIComponent(
        inviteCode,
      )}`;
      sendSmtpEmail.subject = `You've been invited to join ${familyName} on Chamo`;
      sendSmtpEmail.htmlContent = this.getInviteEmailHtml(
        familyName,
        inviteCode,
        acceptUrl,
      );
      sendSmtpEmail.textContent = this.getInviteEmailText(
        familyName,
        inviteCode,
        acceptUrl,
      );

      await this.sendEmailWithRetry(sendSmtpEmail);
      this.logger.debug(
        `Invite notification sent successfully to ${email} (family: ${familyName})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send invite notification to ${email}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send registration invitation to unregistered users when an admin adds them
   * Story 1.13: Added language parameter for localized email content
   */
  async sendRegistrationInviteEmail(
    inviteeEmail: string,
    familyName: string,
    inviterName: string,
    language: string = 'en',
  ): Promise<void> {
    if (!this.isValidEmail(inviteeEmail)) {
      this.logger.error(
        `Invalid email format: ${inviteeEmail}. Skipping registration invite.`,
      );
      return;
    }

    const registerUrl = `${this.getAppBaseUrl()}/login?mode=create&lockMode=invitee&email=${encodeURIComponent(
      inviteeEmail,
    )}&lang=${encodeURIComponent(language)}`;

    // Story 1.13: Get translations for the specified language (with English fallback)
    const translations = getInviteEmailTranslation(language);
    const replacements = { familyName, inviterName };

    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        email: this.emailFrom,
        name: this.emailFromName,
      };
      sendSmtpEmail.to = [{ email: inviteeEmail }];
      sendSmtpEmail.subject = formatTranslation(translations.subject, replacements);
      sendSmtpEmail.htmlContent = this.getRegistrationInviteHtml(
        familyName,
        inviterName,
        registerUrl,
        translations,
      );
      sendSmtpEmail.textContent = this.getRegistrationInviteText(
        familyName,
        inviterName,
        registerUrl,
        translations,
      );

      await this.sendEmailWithRetry(sendSmtpEmail);
      this.logger.debug(
        `Registration invite email sent to ${inviteeEmail} for family ${familyName} in language ${language}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send registration invite to ${inviteeEmail}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Notify inviter that the pending invitee has completed registration
   */
  async sendInviteeRegistrationNotification(
    inviterEmail: string,
    inviteeEmail: string,
    familyName: string,
  ): Promise<void> {
    if (!this.isValidEmail(inviterEmail)) {
      this.logger.error(
        `Invalid inviter email format: ${inviterEmail}. Skipping notification.`,
      );
      return;
    }

    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        email: this.emailFrom,
        name: this.emailFromName,
      };
      sendSmtpEmail.to = [{ email: inviterEmail }];
      const reviewUrl = `${this.getAppBaseUrl()}/login?returnUrl=${encodeURIComponent(
        `/family/settings?completeInvite=${encodeURIComponent(inviteeEmail)}`,
      )}`;
      sendSmtpEmail.subject = `${inviteeEmail} is ready to join ${familyName}`;
      sendSmtpEmail.htmlContent = this.getInviteeRegisteredHtml(
        inviteeEmail,
        familyName,
        reviewUrl,
      );
      sendSmtpEmail.textContent = this.getInviteeRegisteredText(
        inviteeEmail,
        familyName,
        reviewUrl,
      );

      await this.sendEmailWithRetry(sendSmtpEmail);
      this.logger.debug(
        `Registration notification sent to inviter ${inviterEmail} about ${inviteeEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send registration notification to ${inviterEmail}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send email with retry logic (1 retry on network failure)
   * Supports both SMTP (for MailHog in tests) and Brevo API (for production)
   */
  private async sendEmailWithRetry(
    sendSmtpEmail: Brevo.SendSmtpEmail,
    retryCount = 0,
  ): Promise<void> {
    try {
      if (this.useSmtp && this.smtpTransporter) {
        // Use nodemailer for SMTP (MailHog in tests)
        await this.smtpTransporter.sendMail({
          from: `"${sendSmtpEmail.sender?.name}" <${sendSmtpEmail.sender?.email}>`,
          to: sendSmtpEmail.to?.map((t) => t.email).join(', '),
          subject: sendSmtpEmail.subject,
          html: sendSmtpEmail.htmlContent,
          text: sendSmtpEmail.textContent,
        });
      } else if (this.apiInstance) {
        // Use Brevo API for production
        await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      } else {
        throw new Error('No email transport configured');
      }
    } catch (error) {
      // Check for rate limit error (429) - Brevo specific
      if (error.response?.status === 429) {
        this.logger.error(
          'Brevo rate limit exceeded (300 emails/day on free tier). Consider upgrading to a paid plan.',
        );
        throw error;
      }

      // Check for invalid API key (401) - Brevo specific
      if (error.response?.status === 401) {
        this.logger.error(
          'Invalid Brevo API key. Please check your BREVO_API_KEY environment variable.',
        );
        throw error;
      }

      // Retry once on transient network errors
      if (retryCount === 0 && this.isRetryableError(error)) {
        this.logger.warn(
          `Network error sending email, retrying... (${error.message})`,
        );
        await this.delay(1000); // Wait 1 second before retry
        return this.sendEmailWithRetry(sendSmtpEmail, retryCount + 1);
      }

      this.logger.error(
        `Failed to send transactional email: ${error.message}`,
        error.stack,
      );
      return;
    }
  }

  /**
   * Check if error is retryable (network/timeout errors)
   */
  private isRetryableError(error: any): boolean {
    const retryableStatuses = [408, 500, 502, 503, 504]; // Timeout, server errors
    return (
      retryableStatuses.includes(error.response?.status) ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT'
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

    <div style="text-align: center; margin: 30px 0;">
      <a href="http://localhost:3002"
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
        Start Chatting with Your Family
      </a>
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

Visit http://localhost:3002 to start chatting with your family!

Need help? Just reply to this email and we'll get back to you.

---
© ${new Date().getFullYear()} Chamo. Family communication made simple.
    `.trim();
  }

  private getInviteEmailHtml(
    familyName: string,
    inviteCode: string,
    acceptUrl: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to ${familyName}!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">👋 You're Invited!</h1>
  </div>

  <div style="background: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Join ${familyName} on Chamo</h2>

    <p>You've been invited to join <strong>${familyName}</strong> on Chamo - a secure family communication platform.</p>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 30px 0; text-align: center;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your invite code:</p>
      <p style="margin: 0; font-size: 24px; font-weight: bold; color: #667eea; letter-spacing: 2px; font-family: monospace;">
        ${inviteCode}
      </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptUrl}"
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
        Accept Invitation
      </a>
    </div>

    <p style="margin-top: 30px; font-size: 14px; color: #666;">
      Don't have an account? You'll be able to create one when you accept the invitation.
    </p>
  </div>

  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Chamo. Family communication made simple.</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getInviteEmailText(
    familyName: string,
    inviteCode: string,
    acceptUrl: string,
  ): string {
    return `
You're Invited! - Join ${familyName} on Chamo

You've been invited to join ${familyName} on Chamo - a secure family communication platform.

Your invite code: ${inviteCode}

Visit ${acceptUrl} to accept the invitation.

Don't have an account? You'll be able to create one when you accept the invitation.

---
© ${new Date().getFullYear()} Chamo. Family communication made simple.
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
