import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import {
  INestApplication,
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { ThrottlerModule } from '@nestjs/throttler';
import { TranslationController } from '../src/translation/translation.controller';
import { TranslationService } from '../src/translation/translation.service';
import { TranslationThrottlerGuard } from '../src/translation/translation-throttler.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { GroqService } from '../src/translation/groq.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { buildCorsOptions } from '../src/config/cors.config';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';

type PrismaMock = {
  messageTranslation: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
  };
  message: {
    findUnique: jest.Mock;
  };
};

const createPrismaMock = (): PrismaMock => ({
  messageTranslation: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn(),
  },
  message: {
    findUnique: jest.fn().mockResolvedValue({
      channel: { familyId: 'family-1' },
    }),
  },
});

const createGroqMock = () => ({
  translateText: jest.fn().mockResolvedValue('Bonjour'),
});

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];
    if (authHeader === 'Bearer test-token') {
      req.user = {
        id: 'user-1',
        activeFamilyId: 'family-1',
        emailVerified: true,
      };
      return true;
    }

    throw new UnauthorizedException();
  }
}

type AppBuilderOptions = {
  throttleLimit?: number;
  throttleTtl?: number;
  allowedOrigins?: string[];
};

async function createApp(opts: AppBuilderOptions = {}) {
  const prismaMock = createPrismaMock();
  const groqMock = createGroqMock();

  const testingModuleBuilder = Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot([
        {
          name: 'short',
          limit: opts.throttleLimit ?? 10,
          ttl: opts.throttleTtl ?? 60_000,
        },
      ]),
    ],
    controllers: [TranslationController],
    providers: [
      TranslationService,
      TranslationThrottlerGuard,
      { provide: PrismaService, useValue: prismaMock },
      { provide: GroqService, useValue: groqMock },
      {
        provide: APP_GUARD,
        useExisting: TranslationThrottlerGuard,
      },
    ],
  });

  const moduleRef = await testingModuleBuilder
    .overrideGuard(JwtAuthGuard)
    .useClass(MockJwtAuthGuard)
    .compile();

  const app = moduleRef.createNestApplication();
  app.enableCors(
    buildCorsOptions(opts.allowedOrigins ?? ['http://localhost:3002']),
  );
  await app.init();

  return { app, prismaMock, groqMock };
}

describe('TranslationController (integration)', () => {
  afterEach(async () => {
    jest.clearAllMocks();
  });

  it('translates text and returns Groq response when authenticated', async () => {
    const { app, prismaMock, groqMock } = await createApp();

    prismaMock.messageTranslation.findUnique
      .mockResolvedValueOnce(null) // guard check
      .mockResolvedValueOnce(null); // service check

    const res = await request(app.getHttpServer())
      .post('/api/translate')
      .set('Authorization', 'Bearer test-token')
      .send({
        messageId: 'msg-1',
        text: 'Hello world',
        targetLanguage: 'ja',
      })
      .expect(200);

    expect(res.body).toEqual({
      messageId: 'msg-1',
      cached: false,
      translation: 'Bonjour',
      targetLanguage: 'ja',
    });
    expect(groqMock.translateText).toHaveBeenCalledWith(
      'Hello world',
      'ja',
    );

    await app.close();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const { app } = await createApp();

    await request(app.getHttpServer())
      .post('/api/translate')
      .send({
        messageId: 'msg-unauth',
        text: 'Hola',
        targetLanguage: 'en',
      })
      .expect(401);

    await app.close();
  });

  it('returns 429 after exceeding rate limit', async () => {
    const handler = TranslationController.prototype.translate;
    const shortLimitKey = `${THROTTLER_LIMIT}short`;
    const shortTtlKey = `${THROTTLER_TTL}short`;
    const originalLimit = Reflect.getMetadata(shortLimitKey, handler);
    const originalTtl = Reflect.getMetadata(shortTtlKey, handler);
    Reflect.defineMetadata(shortLimitKey, 1, handler);
    Reflect.defineMetadata(shortTtlKey, 60_000, handler);

    const { app, prismaMock } = await createApp({
      throttleLimit: 1,
      throttleTtl: 60_000,
    });

    try {
      prismaMock.messageTranslation.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/translate')
        .set('Authorization', 'Bearer test-token')
        .send({
          messageId: 'msg-rl-1',
          text: 'Bonjour',
          targetLanguage: 'en',
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/translate')
        .set('Authorization', 'Bearer test-token')
        .send({
          messageId: 'msg-rl-2',
          text: 'Hola',
          targetLanguage: 'en',
        })
        .expect(429);
    } finally {
      await app.close();

      if (typeof originalLimit !== 'undefined') {
        Reflect.defineMetadata(shortLimitKey, originalLimit, handler);
      }
      if (typeof originalTtl !== 'undefined') {
        Reflect.defineMetadata(shortTtlKey, originalTtl, handler);
      }
    }
  });

  it('bypasses rate limit for cached translations', async () => {
    const { app, prismaMock, groqMock } = await createApp({
      throttleLimit: 1,
      throttleTtl: 60_000,
    });

    prismaMock.messageTranslation.findUnique
      .mockResolvedValueOnce(null) // guard first request
      .mockResolvedValueOnce(null) // service first request
      .mockResolvedValueOnce({ id: 'cached' }) // guard second request
      .mockResolvedValueOnce({ encryptedTranslation: 'cipher' }); // service second request

    await request(app.getHttpServer())
      .post('/api/translate')
      .set('Authorization', 'Bearer test-token')
      .send({
        messageId: 'msg-cache',
        text: 'Hola mundo',
        targetLanguage: 'en',
      })
      .expect(200);

    groqMock.translateText.mockClear();

    const res = await request(app.getHttpServer())
      .post('/api/translate')
      .set('Authorization', 'Bearer test-token')
      .send({
        messageId: 'msg-cache',
        text: 'Hola mundo',
        targetLanguage: 'en',
      })
      .expect(200);

    expect(res.body.cached).toBe(true);
    expect(res.body.encryptedTranslation).toBe('cipher');
    expect(groqMock.translateText).not.toHaveBeenCalled();

    await app.close();
  });

  it('sets Access-Control-Allow-Origin header for allowed origins', async () => {
    const { app, prismaMock } = await createApp({
      allowedOrigins: ['http://localhost:3002'],
    });

    prismaMock.messageTranslation.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const res = await request(app.getHttpServer())
      .post('/api/translate')
      .set('Authorization', 'Bearer test-token')
      .set('Origin', 'http://localhost:3002')
      .send({
        messageId: 'msg-cors',
        text: 'Hallo',
        targetLanguage: 'en',
      })
      .expect(200);

    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:3002',
    );

    await app.close();
  });
});
