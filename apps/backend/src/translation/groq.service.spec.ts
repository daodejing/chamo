import { HttpException, HttpStatus } from '@nestjs/common';
import { GroqService } from './groq.service';
import { SupportedLanguageCode } from './dto/translate.dto';

const buildResponse = (overrides: Partial<Response> = {}) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: 'Translated text',
          },
        },
      ],
    }),
    text: async () => 'error',
    ...overrides,
  }) as Response;

describe('GroqService', () => {
  const originalEnv = process.env.GROQ_API_KEY;
  let service: GroqService;

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-key';
    service = new GroqService();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    process.env.GROQ_API_KEY = originalEnv;
  });

  it('returns translation when Groq responds successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      buildResponse({
        json: async () => ({
          choices: [
            {
              message: {
                content: 'こんにちは',
              },
            },
          ],
        }),
      }),
    );

    const result = await service.translateText('Hello', 'ja');

    expect(result).toBe('こんにちは');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    );
  });

  it('throws 429 when Groq returns rate limit response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      buildResponse({
        ok: false,
        status: HttpStatus.TOO_MANY_REQUESTS,
      }),
    );

    await expect(service.translateText('Hello', 'ja')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('throws service unavailable when Groq returns unexpected response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      buildResponse({
        ok: false,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      }),
    );

    await expect(service.translateText('Hello', 'ja')).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('throws when GROQ_API_KEY is missing', async () => {
    process.env.GROQ_API_KEY = '';
    service = new GroqService();

    await expect(service.translateText('Hello', 'ja')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('throws timeout error when fetch aborts', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    (global.fetch as jest.Mock).mockRejectedValue(abortError);

    await expect(service.translateText('Hello', 'ja')).rejects.toMatchObject({
      status: HttpStatus.REQUEST_TIMEOUT,
    });
  });

  it('throws service unavailable when translation payload empty', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      buildResponse({
        json: async () => ({
          choices: [
            {
              message: {
                content: '',
              },
            },
          ],
        }),
      }),
    );

    await expect(
      service.translateText('Hello', 'ja' as SupportedLanguageCode),
    ).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });
});
