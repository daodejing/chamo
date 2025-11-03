import 'reflect-metadata';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { Reflector } from '@nestjs/core';
import { TranslationThrottlerGuard } from './translation-throttler.guard';
import { PrismaService } from '../prisma/prisma.service';

class DummyController {
  handler() {
    return undefined;
  }
}

const createContext = (body: Record<string, unknown>) => {
  const req = {
    body,
    ip: '127.0.0.1',
    headers: {},
  };
  const res = {
    header: jest.fn(),
  };
  const controller = new DummyController();
  const context = new ExecutionContextHost(
    [req, res],
    controller.constructor,
    controller.handler,
  );
  context.setType('http');
  return context;
};

describe('TranslationThrottlerGuard', () => {
  const prismaMock = {
    messageTranslation: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  const createGuard = () =>
    new TranslationThrottlerGuard(
      [
        {
          name: 'short',
          limit: 1,
          ttl: 1_000,
        },
      ],
      new ThrottlerStorageService(),
      new Reflector(),
      prismaMock,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips throttling when cache hit is detected', async () => {
    (prismaMock.messageTranslation.findUnique as jest.Mock).mockResolvedValue({
      id: 'cached',
    });

    const context = createContext({
      messageId: 'msg-1',
      targetLanguage: 'en',
    });

    const guard = createGuard();
    await guard.onModuleInit();

    await expect(guard.canActivate(context)).resolves.toBeTruthy();
    await expect(guard.canActivate(context)).resolves.toBeTruthy();

    expect(
      prismaMock.messageTranslation.findUnique as jest.Mock,
    ).toHaveBeenCalledTimes(2);
  });

  it('enforces throttling when cache miss occurs', async () => {
    (prismaMock.messageTranslation.findUnique as jest.Mock).mockResolvedValue(
      null,
    );

    const context = createContext({
      messageId: 'msg-1',
      targetLanguage: 'en',
    });

    const guard = createGuard();
    await guard.onModuleInit();

    await expect(guard.canActivate(context)).resolves.toBeTruthy();
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ThrottlerException,
    );
  });
});
