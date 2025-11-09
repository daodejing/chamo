import { buildCorsOptions } from './cors.config';

describe('buildCorsOptions', () => {
  const allowedOrigins = [
    'http://localhost:3002',
    'https://ourchat.pages.dev',
  ];
  const corsOptions = buildCorsOptions(allowedOrigins);

  const evaluateOrigin = (origin?: string | null) =>
    new Promise((resolve, reject) => {
      corsOptions.origin?.(origin ?? undefined, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });

  it('allows Cloudflare Pages static frontend origin', async () => {
    await expect(
      evaluateOrigin('https://ourchat.pages.dev'),
    ).resolves.toBe(true);
  });

  it('allows requests without explicit origin (mobile/native clients)', async () => {
    await expect(evaluateOrigin(undefined)).resolves.toBe(true);
    await expect(evaluateOrigin(null)).resolves.toBe(true);
  });

  it('rejects disallowed origins with actionable error message', async () => {
    await expect(
      evaluateOrigin('https://malicious.example.com'),
    ).rejects.toThrow(/not allowed by CORS/);
  });

  it('enables credentialed requests so cookies/JWT headers flow', () => {
    expect(corsOptions.credentials).toBe(true);
  });
});
