import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import * as Brevo from '@getbrevo/brevo';

// Mock Brevo SDK
jest.mock('@getbrevo/brevo');

describe('EmailService', () => {
  let service: EmailService;
  let mockSendTransacEmail: jest.Mock;

  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = {
      ...originalEnv,
      BREVO_API_KEY: 'xkeysib-test-api-key',
      EMAIL_FROM: 'test@example.com',
      EMAIL_FROM_NAME: 'OurChat Test',
      EMAIL_VERIFICATION_URL: 'http://localhost:3002/verify-email',
    };

    // Mock Brevo API
    mockSendTransacEmail = jest.fn().mockResolvedValue({ messageId: 'test-id' });

    const mockApiInstance = {
      setApiKey: jest.fn(),
      sendTransacEmail: mockSendTransacEmail,
    };

    (Brevo.TransactionalEmailsApi as jest.Mock).mockImplementation(
      () => mockApiInstance,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();

      service = module.get<EmailService>(EmailService);
      expect(service).toBeDefined();
    });

    it('should throw error when BREVO_API_KEY is missing', async () => {
      delete process.env.BREVO_API_KEY;

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [EmailService],
        }).compile();
        service = module.get<EmailService>(EmailService);
      }).rejects.toThrow('BREVO_API_KEY is required');
    });

    it('should throw error when EMAIL_FROM is missing', async () => {
      delete process.env.EMAIL_FROM;

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [EmailService],
        }).compile();
        service = module.get<EmailService>(EmailService);
      }).rejects.toThrow('EMAIL_FROM is required');
    });

    it('should throw error when EMAIL_VERIFICATION_URL is missing', async () => {
      delete process.env.EMAIL_VERIFICATION_URL;

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [EmailService],
        }).compile();
        service = module.get<EmailService>(EmailService);
      }).rejects.toThrow('EMAIL_VERIFICATION_URL is required');
    });

    it('should use default EMAIL_FROM_NAME if not provided', async () => {
      delete process.env.EMAIL_FROM_NAME;

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();

      service = module.get<EmailService>(EmailService);
      expect(service).toBeDefined();
    });
  });

  describe('sendVerificationEmail', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();
      service = module.get<EmailService>(EmailService);
    });

    it('should reject invalid email format', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.sendVerificationEmail('invalid-email', 'token123');

      expect(mockSendTransacEmail).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid email format'),
      );
      loggerSpy.mockRestore();
    });

    it('should accept valid email format', async () => {
      await service.sendVerificationEmail('valid@example.com', 'token123');

      expect(mockSendTransacEmail).toHaveBeenCalled();
    });

    it('should send verification email with correct parameters', async () => {
      const email = 'user@example.com';
      const token = 'test-verification-token-123';

      await service.sendVerificationEmail(email, token);

      expect(mockSendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: { email: 'test@example.com', name: 'OurChat Test' },
          to: [{ email: 'user@example.com' }],
          subject: 'Verify your email - Chamo',
          htmlContent: expect.stringContaining(
            'http://localhost:3002/verify-email?token=test-verification-token-123',
          ),
          textContent: expect.stringContaining(
            'http://localhost:3002/verify-email?token=test-verification-token-123',
          ),
        }),
      );
    });

    it('should build correct verification URL', async () => {
      const email = 'user@example.com';
      const token = 'abc123';

      await service.sendVerificationEmail(email, token);

      const callArg = mockSendTransacEmail.mock.calls[0][0];
      expect(callArg.htmlContent).toContain(
        'http://localhost:3002/verify-email?token=abc123',
      );
    });

    it('should handle email sending errors gracefully', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      mockSendTransacEmail.mockRejectedValueOnce(
        new Error('Network error'),
      );

      // Should not throw
      await expect(
        service.sendVerificationEmail('user@example.com', 'token123'),
      ).resolves.not.toThrow();

      loggerSpy.mockRestore();
    });

    it('should retry once on transient network error', async () => {
      mockSendTransacEmail
        .mockRejectedValueOnce({
          response: { status: 500 },
          message: 'Server error',
        })
        .mockResolvedValueOnce({ messageId: 'retry-success' });

      await service.sendVerificationEmail('user@example.com', 'token123');

      expect(mockSendTransacEmail).toHaveBeenCalledTimes(2);
    });

    it('should not retry on rate limit error (429)', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      mockSendTransacEmail.mockRejectedValueOnce({
        response: { status: 429 },
        message: 'Rate limit exceeded',
      });

      await service.sendVerificationEmail('user@example.com', 'token123');

      expect(mockSendTransacEmail).toHaveBeenCalledTimes(1);
      loggerSpy.mockRestore();
    });

    it('should not retry on invalid API key error (401)', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      mockSendTransacEmail.mockRejectedValueOnce({
        response: { status: 401 },
        message: 'Invalid API key',
      });

      await service.sendVerificationEmail('user@example.com', 'token123');

      expect(mockSendTransacEmail).toHaveBeenCalledTimes(1);
      loggerSpy.mockRestore();
    });
  });

  describe('sendWelcomeEmail', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();
      service = module.get<EmailService>(EmailService);
    });

    it('should reject invalid email format', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.sendWelcomeEmail('not-an-email', 'John Doe');

      expect(mockSendTransacEmail).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid email format'),
      );
      loggerSpy.mockRestore();
    });

    it('should send welcome email with correct parameters', async () => {
      const email = 'user@example.com';
      const userName = 'John Doe';

      await service.sendWelcomeEmail(email, userName);

      expect(mockSendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: { email: 'test@example.com', name: 'OurChat Test' },
          to: [{ email: 'user@example.com' }],
          subject: 'Welcome to Chamo!',
          htmlContent: expect.stringContaining('John Doe'),
          textContent: expect.stringContaining('John Doe'),
        }),
      );
    });

    it('should include userName in email content', async () => {
      await service.sendWelcomeEmail('user@example.com', 'Alice Smith');

      const callArg = mockSendTransacEmail.mock.calls[0][0];
      expect(callArg.htmlContent).toContain('Alice Smith');
      expect(callArg.textContent).toContain('Alice Smith');
    });

    it('should handle email sending errors gracefully', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      mockSendTransacEmail.mockRejectedValueOnce(
        new Error('Network error'),
      );

      await expect(
        service.sendWelcomeEmail('user@example.com', 'John'),
      ).resolves.not.toThrow();

      loggerSpy.mockRestore();
    });
  });

  describe('sendInviteNotification', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();
      service = module.get<EmailService>(EmailService);
    });

    it('should reject invalid email format', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.sendInviteNotification('invalid', 'Family', 'CODE');

      expect(mockSendTransacEmail).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid email format'),
      );
      loggerSpy.mockRestore();
    });

    it('should send invite notification with correct parameters', async () => {
      const email = 'invitee@example.com';
      const familyName = 'Smith Family';
      const inviteCode = 'SMITH123';

      await service.sendInviteNotification(email, familyName, inviteCode);

      expect(mockSendTransacEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: { email: 'test@example.com', name: 'OurChat Test' },
          to: [{ email: 'invitee@example.com' }],
          subject: "You've been invited to join Smith Family on Chamo",
          htmlContent: expect.stringContaining('Smith Family'),
          textContent: expect.stringContaining('SMITH123'),
        }),
      );
    });

    it('should include familyName and inviteCode in content', async () => {
      await service.sendInviteNotification(
        'user@example.com',
        'Johnson Family',
        'INVITE789',
      );

      const callArg = mockSendTransacEmail.mock.calls[0][0];
      expect(callArg.htmlContent).toContain('Johnson Family');
      expect(callArg.htmlContent).toContain('INVITE789');
      expect(callArg.textContent).toContain('Johnson Family');
      expect(callArg.textContent).toContain('INVITE789');
    });

    it('should handle email sending errors gracefully', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      mockSendTransacEmail.mockRejectedValueOnce(
        new Error('Network error'),
      );

      await expect(
        service.sendInviteNotification('user@example.com', 'Family', 'CODE'),
      ).resolves.not.toThrow();

      loggerSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();
      service = module.get<EmailService>(EmailService);
    });

    it('should log rate limit errors with actionable message', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      mockSendTransacEmail.mockRejectedValueOnce({
        response: { status: 429 },
        message: 'Rate limit exceeded',
      });

      await service.sendVerificationEmail('user@example.com', 'token');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('rate limit'),
      );
      loggerSpy.mockRestore();
    });

    it('should log invalid API key errors', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      mockSendTransacEmail.mockRejectedValueOnce({
        response: { status: 401 },
        message: 'Invalid API key',
      });

      await service.sendVerificationEmail('user@example.com', 'token');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid Brevo API key'),
      );
      loggerSpy.mockRestore();
    });

    it('should retry on 500 server errors', async () => {
      mockSendTransacEmail
        .mockRejectedValueOnce({
          response: { status: 500 },
          message: 'Server error',
        })
        .mockResolvedValueOnce({ messageId: 'success' });

      await service.sendVerificationEmail('user@example.com', 'token');

      expect(mockSendTransacEmail).toHaveBeenCalledTimes(2);
    });

    it('should retry on ETIMEDOUT errors', async () => {
      mockSendTransacEmail
        .mockRejectedValueOnce({
          code: 'ETIMEDOUT',
          message: 'Timeout',
        })
        .mockResolvedValueOnce({ messageId: 'success' });

      await service.sendVerificationEmail('user@example.com', 'token');

      expect(mockSendTransacEmail).toHaveBeenCalledTimes(2);
    });
  });
});
