import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard, getOptionsToken, getStorageToken } from '@nestjs/throttler';
import type {
  ThrottlerModuleOptions,
  ThrottlerRequest,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TranslationThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(getStorageToken()) storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super(options, storageService, reflector);
  }

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const { context } = requestProps;

    const contextType = context.getType();

    if (contextType === 'http') {
      const req = context.switchToHttp().getRequest();
      const { messageId, targetLanguage } = req?.body ?? {};

      if (messageId && targetLanguage) {
        const cached = await this.prisma.messageTranslation.findUnique({
          where: {
            messageId_targetLanguage: {
              messageId,
              targetLanguage,
            },
          },
          select: { id: true },
        });

        if (cached) {
          return true; // cache hit, skip throttling entirely
        }
      }
    }

    return super.handleRequest(requestProps);
  }

  protected getRequestResponse(context: ExecutionContext) {
    const http = context.switchToHttp();
    const httpReq = http.getRequest();
    const httpRes = http.getResponse();

    if (httpReq && httpRes) {
      return {
        req: httpReq,
        res: this.ensureHeaderCapability(httpRes),
      };
    }

    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext<{ req?: any; res?: any }>() ?? {};

    const req = ctx.req ?? httpReq ?? { headers: {}, ip: undefined };
    const res = this.ensureHeaderCapability(ctx.res ?? httpRes ?? {});

    return { req, res };
  }

  private ensureHeaderCapability(res: any) {
    if (!res) {
      return {
        header: () => undefined,
      };
    }

    if (typeof res.header !== 'function' && typeof res.setHeader === 'function') {
      res.header = (name: string, value: string | number) => {
        res.setHeader(name, value);
        return res;
      };
    }

    if (typeof res.header !== 'function') {
      res.header = () => res;
    }

    return res;
  }
}
