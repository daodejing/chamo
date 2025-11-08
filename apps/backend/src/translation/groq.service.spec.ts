import { HttpException, HttpStatus } from '@nestjs/common';
import { GroqService } from './groq.service';

describe('GroqService', () => {
  let service: GroqService;
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;
  const originalEnv = process.env.GROQ_API_KEY;

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'gsk-test';
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new GroqService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GROQ_API_KEY = originalEnv;
  });

  it('throws when API key is missing', async () => {
    process.env.GROQ_API_KEY = '';
    service = new GroqService();

    await expect(service.translateText('Hola', 'en')).rejects.toThrow(
      'Translation service unavailable',
    );
  });

  it('returns trimmed translation from Groq API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: ' Bonjour ' ,
            },
          },
        ],
      }),
    });

    const result = await service.translateText('Hello', 'fr');

    expect(result).toBe('Bonjour');
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: expect.stringContaining('Bearer') }),
    }));
  });

  it('throws rate limit exception on HTTP 429', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: HttpStatus.TOO_MANY_REQUESTS,
      text: async () => 'rate limited',
    });

    try {
      await service.translateText('Hola', 'en');
      fail('Expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('throws timeout exception on AbortError', async () => {
    const abortError = new Error('timed out');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);

    try {
      await service.translateText('Hola', 'en');
      fail('Expected to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.REQUEST_TIMEOUT);
    }
  });
});
